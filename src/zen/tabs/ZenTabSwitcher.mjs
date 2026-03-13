/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { nsZenDOMOperatedFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  PageThumbs: "resource://gre/modules/PageThumbs.sys.mjs",
});

class nsZenTabSwitcher extends nsZenDOMOperatedFeature {
  static CARD_WIDTH = 200;
  static MAX_VISIBLE_CARDS = 5;
  static MAX_RECENT_TABS = 20;
  static PANEL_HORIZONTAL_PADDING = 30;
  static PANEL_HEIGHT = 200;
  static THUMBNAIL_CANVAS_WIDTH = 320;
  static THUMBNAIL_CANVAS_HEIGHT = 180;

  #isOpen = false;
  #currentIndex = 0;
  #tabList = [];
  #thumbnailCache = new Map();
  #lazyPrefs = {};
  #recentlyUsedTabsByWorkspace = new Map();
  #actualVisibleCards = nsZenTabSwitcher.MAX_VISIBLE_CARDS;
  #firstPress = true;

  init() {
    this.#setupPreferences();
    this.#disableDefaultCtrlTab();
    this.#setupKeyboardListeners();
    this.#setupLazyGetters();
    this.#observeTabChanges();
    this.#setupShutdownObserver();
    this.#initializeRecentlyUsedTabs();
  }

  #setupLazyGetters() {
    ChromeUtils.defineLazyGetter(this, "panel", () =>
      document.getElementById("zen-tab-switcher-panel")
    );
    ChromeUtils.defineLazyGetter(this, "tabsContainer", () =>
      document.getElementById("zen-tab-switcher-tabs")
    );
  }

  /**
   * Initializes the recently used tabs list for the current workspace with the selected tab.
   *
   * @returns {void}
   */
  #initializeRecentlyUsedTabs() {
    if (!this.#lazyPrefs.useRecentOrder) {
      return;
    }
    
    if (gBrowser && gBrowser.selectedTab) {
      const workspaceId = gZenWorkspaces?.activeWorkspace || "default";
      this.#recentlyUsedTabsByWorkspace.set(workspaceId, [gBrowser.selectedTab]);
    }
  }

  /**
   * Registers an observer to handle application shutdown events.
   *
   * @returns {void}
   */
  #setupShutdownObserver() {
    try {
      Services.obs.removeObserver(this, "quit-application-granted");
    } catch (e) {
    }
    Services.obs.addObserver(this, "quit-application-granted");
  }

  /**
   * Disables or enables the default Firefox Ctrl+Tab behavior based on user preference.
   *
   * @returns {void}
   */
  #disableDefaultCtrlTab() {
    const enabled = Services.prefs.getBoolPref("zen.tabs.tab-switcher.enabled", true);
    const method = enabled ? "uninit" : "readPref";
    window.ctrlTab?.[method]?.();
  }

  #setupPreferences() {
    XPCOMUtils.defineLazyPreferenceGetter(
      this.#lazyPrefs,
      "enabled",
      "zen.tabs.tab-switcher.enabled",
      true
    );

    XPCOMUtils.defineLazyPreferenceGetter(
      this.#lazyPrefs,
      "useRecentOrder",
      "zen.tabs.tab-switcher.use-recent-order",
      false
    );

    try {
      Services.prefs.removeObserver("zen.tabs.tab-switcher.enabled", this);
      Services.prefs.removeObserver("zen.tabs.tab-switcher.use-recent-order", this);
    } catch (e) {
    }
    
    Services.prefs.addObserver("zen.tabs.tab-switcher.enabled", this);
    Services.prefs.addObserver("zen.tabs.tab-switcher.use-recent-order", this);
  }

  /**
   * Called when system events occur (browser shutdown or preference changes).
   * Handles cleanup on shutdown and preference change reactions.
   *
   * @param {nsISupports} subject
   * @param {string} topic
   * @param {string} data
   * @returns {void}
   */
  observe(subject, topic, data) {
    if (topic === "quit-application-granted") {
      this.#recentlyUsedTabsByWorkspace.clear();
    } else if (data === "zen.tabs.tab-switcher.enabled") {
      this.#disableDefaultCtrlTab();
      if (!this.#lazyPrefs.enabled) {
        this.#recentlyUsedTabsByWorkspace.clear();
        console.log("ZenTabSwitcher: Cleared recently used tabs lists and stopped tracking changes");
      }
    } else if (data === "zen.tabs.tab-switcher.use-recent-order") {
      this.#recentlyUsedTabsByWorkspace.clear();
      console.log("ZenTabSwitcher: Cleared recently used tabs lists and stopped tracking changes");
      if (this.#lazyPrefs.useRecentOrder) {
        this.#initializeRecentlyUsedTabs();
      }
    }
  }

  /**
   * Sets up keyboard event listeners for Ctrl+Tab navigation and Escape key handling.
   * Also handles window blur events to close the switcher when focus is lost.
   *
   * @returns {void}
   */
  #setupKeyboardListeners() {
    window.addEventListener("keydown", (e) => this.#handleKeyDown(e), true);
    window.addEventListener("keyup", (e) => this.#handleKeyUp(e), true);
    window.addEventListener("blur", () => this.#isOpen && this.close(false));
  }

  /**
   * Registers event listeners for various tab-related events.
   * Handles tab open, close, attribute changes, moves, and selections.
   *
   * @returns {void}
   */
  #observeTabChanges() {
    window.addEventListener("TabOpen", () => this.#thumbnailCache.clear());
    window.addEventListener("TabClose", () => {
      this.#thumbnailCache.clear();
      this.#cleanupRecentlyUsedTabs();
    });
    window.addEventListener("TabAttrModified", () => {
      this.#thumbnailCache.clear();
    });
    window.addEventListener("TabMove", () => this.#thumbnailCache.clear());
    window.addEventListener("TabSelect", (event) => this.#onTabSelect(event));
    window.addEventListener("ZenWorkspacesUIUpdate", () => {
      this.#thumbnailCache.clear();
    });
  }

  /**
   * Update recently-used order list for the current workspace whenever a user clicks/switches to tab.
   *
   * @param {Event} event - The tab selection event.
   * @returns {void}
   */
  #onTabSelect(event) {
    if (!this.#lazyPrefs.enabled || !this.#lazyPrefs.useRecentOrder) {
      return;
    }
    
    const tab = event.target;
    if (!tab || tab.closing || tab.hidden) {
      return;
    }

    const workspaceId = gZenWorkspaces?.activeWorkspace || "default";
    
    this.#updateWorkspaceRecentList(workspaceId, tab);
  }

  /**
   * Helper to update a specific workspace's recently used tabs list.
   *
   * @param {string} workspaceId - The workspace ID.
   * @param {Tab} tab - The tab to add.
   * @returns {void}
   */
  #updateWorkspaceRecentList(workspaceId, tab) {
    let recentTabs = this.#recentlyUsedTabsByWorkspace.get(workspaceId) || [];
    recentTabs = recentTabs.filter(t => t !== tab);
    recentTabs.unshift(tab);

    if (recentTabs.length > nsZenTabSwitcher.MAX_RECENT_TABS) {
      recentTabs.pop();
    }

    this.#recentlyUsedTabsByWorkspace.set(workspaceId, recentTabs);
    console.log(`ZenTabSwitcher: Updated and saved recently used tabs list for workspace ${workspaceId}`);
  }

  /**
   * Remove tabs that no longer exist or are unloaded from all workspace recently-used lists.
   *
   * @returns {void}
   */
  #cleanupRecentlyUsedTabs() {
    if (!this.#lazyPrefs.useRecentOrder) {
      return;
    }

    for (const [workspaceId, recentTabs] of this.#recentlyUsedTabsByWorkspace) {
      const cleanedTabs = recentTabs.filter(
        (tab) => tab && !tab.closing && !tab.hasAttribute("pending") && tab.isConnected
      );
      this.#recentlyUsedTabsByWorkspace.set(workspaceId, cleanedTabs);
    }
  }

  /**
   * Process keyboard input when keys are pressed down.
   * Handles Escape (to close panel) and Ctrl+Tab/Shift+Ctrl+Tab (to open/navigate panel).
   *
   * @param {KeyboardEvent} event - The key press event.
   * @returns {void}
   */
  #handleKeyDown(event) {
    if (!this.#lazyPrefs.enabled) {
      return;
    }

    if (event.key === "Escape" && this.#isOpen) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.close(false);
      return;
    }

    if (event.ctrlKey && event.key === "Tab") {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      if (!this.#isOpen) {
        this.open(event.shiftKey);
      } else {
        event.shiftKey ? this.#navigateBackward() : this.#navigateForward();
      }
    }
  }

  /**
   * Processes keyboard input when keys are released.
   * Detects when Control key is released to close the panel and switch to selected tab.
   *
   * @param {KeyboardEvent} event - The key release event.
   * @returns {void}
   */
  #handleKeyUp(event) {
    if (this.#isOpen && event.key === "Control") {
      this.close(document.hasFocus());
    }
  }

  /**
   * Initialize the panel UI. 
   *
   * @param {boolean} shiftKey - Whether Shift was pressed, determining initial navigation direction (false = forward, true = backward).
   * @returns {Promise<void>} Resolves when the panel is fully initialized and displayed.
   */
  async open(shiftKey = false) {
    if (this.#isOpen) {
      return;
    }
    this.#buildTabList();
    if (this.#tabList.length <= 1) {
      return;
    }
    this.#isOpen = true;

    if (this.#lazyPrefs.useRecentOrder) {
      this.#currentIndex = shiftKey ? this.#tabList.length - 1 : 1;
    } else {
      const currentTabIndex = this.#tabList.indexOf(gBrowser.selectedTab);
      
      if (shiftKey) {
        this.#currentIndex =
          currentTabIndex >= 0
            ? (currentTabIndex - 1 + this.#tabList.length) % this.#tabList.length
            : this.#tabList.length - 1;
      } else {
        this.#currentIndex =
          currentTabIndex >= 0 ? (currentTabIndex + 1) % this.#tabList.length : 0;
      }
    }

    this.#actualVisibleCards = Math.min(this.#tabList.length, nsZenTabSwitcher.MAX_VISIBLE_CARDS);

    await this.#preCacheThumbnailsForVisible();

    this.#renderTabs();

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    const containerWidth = nsZenTabSwitcher.CARD_WIDTH * this.#actualVisibleCards;
    // Ensure the panel doesn't get cut off by screen edge (always shows full panel on screen)
    const panelWidth = Math.min(containerWidth + nsZenTabSwitcher.PANEL_HORIZONTAL_PADDING, windowWidth);

    const centerX = (windowWidth - panelWidth) / 2;
    const centerY = (windowHeight - nsZenTabSwitcher.PANEL_HEIGHT) / 2;

    PanelMultiView.openPopup(this.panel, document.documentElement, {
      position: "overlap",
      triggerEvent: null,
      x: centerX,
      y: centerY,
    });

    setTimeout(() => this.#scrollToSelected(), 0);

    this.#tabList.forEach((tab) => this.#captureThumbnail(tab));
  }

  /**
   * Closes the tab switcher and optionally switches to the selected tab.
   *
   * @param {boolean} switchTab - Whether to switch to the selected tab.
   * @returns {void}
   */
  close(switchTab = true) {
    if (!this.#isOpen) {
      return;
    }

    if (switchTab) {
      const selectedTab = this.#tabList[this.#currentIndex];
      if (selectedTab && selectedTab !== gBrowser.selectedTab) {
        gBrowser.selectedTab = selectedTab;
      }
    }

    this.#resetState();
  }

  /**
   * Hides the panel and resets internal state variables.
   *
   * @returns {void}
   */
  #resetState() {
    this.panel.hidePopup();
    this.#isOpen = false;
    this.#currentIndex = 0;
    this.#tabList = [];
    this.#firstPress = true;
  }

  /**
   * Captures screenshots only for tabs that are currently visible on screen.
   * This is async so it waits for all thumbnails before showing the panel.
   *
   * @returns {Promise<void>} Resolves when all visible thumbnails are captured.
   */
  async #preCacheThumbnailsForVisible() {
    const pageStartIndex = this.#getPageStartIndex(this.#currentIndex);
    const endIndex = Math.min(this.#tabList.length, pageStartIndex + this.#actualVisibleCards);
    const tabsToCache = this.#tabList.slice(pageStartIndex, endIndex);
    await Promise.all(tabsToCache.map((tab) => this.#captureThumbnail(tab)));
  }

  /**
   * Captures a screenshot of the given tab and stores it in the thumbnail cache.
   *
   * @param {object} tab - The tab to capture a thumbnail for.
   * @returns {Promise<void>} Resolves when the thumbnail is captured or skipped.
   */
  async #captureThumbnail(tab) {
    if (tab.hasAttribute("pending")) {
      return;
    }
    const tabId = tab.linkedPanel;
    if (this.#thumbnailCache.has(tabId)) {
      return;
    }
    const browser = tab.linkedBrowser;
    if (!browser) {
      return;
    }

    try {
      const canvas = document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
      canvas.width = nsZenTabSwitcher.THUMBNAIL_CANVAS_WIDTH;
      canvas.height = nsZenTabSwitcher.THUMBNAIL_CANVAS_HEIGHT;

      await lazy.PageThumbs.captureToCanvas(browser, canvas, {
        fullViewport: true,
      });
      const dataUrl = canvas.toDataURL("image/png");
      this.#thumbnailCache.set(tabId, dataUrl);

      if (this.#isOpen) {
        this.#updateCardThumbnail(tabId, dataUrl);
      }
    } catch (e) {
      console.warn("ZenTabSwitcher: Failed to cache thumbnail:", e);
    }
  }

  /**
   * Updates the thumbnail for a specific card without re-rendering all cards.
   *
   * @param {string} tabId - The linkedPanel ID of the tab.
   * @param {string} dataUrl - The thumbnail data URL.
   * @returns {void}
   */
  #updateCardThumbnail(tabId, dataUrl) {
    const card = this.tabsContainer?.querySelector(`[data-tab-id="${tabId}"]`);
    const thumbnailContainer = card?.querySelector(".zen-tab-switcher-thumbnail");
    
    if (!thumbnailContainer) {
      return;
    }

    thumbnailContainer.innerHTML = "";
    card.classList.remove("zen-tab-switcher-no-thumbnail");

    const img = document.createXULElement("image");
    img.setAttribute("src", dataUrl);
    thumbnailContainer.appendChild(img);
  }

  /**
   * Creates the list of tabs to show in the switcher.
   *
   * @returns {void}
   */
  #buildTabList() {
    if (this.#lazyPrefs.useRecentOrder) {
      this.#cleanupRecentlyUsedTabs();
    }

    let tabs;
    if (this.#lazyPrefs.useRecentOrder) {
      const currentWorkspace = gZenWorkspaces?.activeWorkspace || "default";
      const workspaceTabs = this.#recentlyUsedTabsByWorkspace.get(currentWorkspace) || [];
      
      tabs = [...workspaceTabs];
      
      if (tabs.length > nsZenTabSwitcher.MAX_RECENT_TABS) {
        tabs = tabs.slice(0, nsZenTabSwitcher.MAX_RECENT_TABS);
      }
    } else {
      tabs = gBrowser.tabs;
    }

    this.#tabList = [...tabs].filter((tab) => {
      if (tab.closing || tab.hidden || tab.hasAttribute("zen-empty-tab")) {
        return false;
      }
      if (this.#lazyPrefs.useRecentOrder && tab.hasAttribute("pending")) {
        return false;
      }
      return true;
    });
  }

  /**
   * Creates the visual tab cards and adds them to the DOM.
   * Clears existing cards and renders new ones based on the current tab list.
   *
   * @returns {void}
   */
  #renderTabs() {
    if (!this.tabsContainer) {
      return;
    }

    this.tabsContainer.innerHTML = "";
    const containerWidth = `${nsZenTabSwitcher.CARD_WIDTH * this.#actualVisibleCards}px`;
    this.tabsContainer.style.width = containerWidth;

    this.#tabList.forEach((tab, index) => {
      const tabCard = this.#createTabCard(tab, index);

      if (index === this.#currentIndex) {
        tabCard.classList.add("zen-tab-switcher-selected");
      }

      this.tabsContainer.appendChild(tabCard);
    });
  }

  /**
   * Creates a single tab card element with thumbnail, favicon, and title.
   *
   * @param {object} tab - The tab to create a card for.
   * @param {number} index - The index of the tab in the list.
   * @returns {Element} XUL <vbox> element representing the tab card.
   */
  #createTabCard(tab, index) {
    const card = document.createXULElement("vbox");
    card.className = "zen-tab-switcher-card";
    card.setAttribute("data-index", index);
    card.setAttribute("data-tab-id", tab.linkedPanel);

    const thumbnailContainer = document.createXULElement("box");
    thumbnailContainer.className = "zen-tab-switcher-thumbnail";

    const thumbnail = this.#getTabThumbnail(tab);

    if (thumbnail) {
      const img = document.createXULElement("image");
      img.setAttribute("src", thumbnail);
      thumbnailContainer.appendChild(img);
    } else {
      card.classList.add("zen-tab-switcher-no-thumbnail");
    }

    card.appendChild(thumbnailContainer);

    const infoContainer = document.createXULElement("hbox");
    infoContainer.className = "zen-tab-switcher-info";

    const favicon = document.createXULElement("image");
    favicon.className = "zen-tab-switcher-favicon";

    const defaultFavicon = PlacesUtils.favicons.defaultFavicon.spec;
    let iconSrc = gBrowser.getIcon(tab) || defaultFavicon;

    if (iconSrc.startsWith("chrome://branding/content/")) {
      iconSrc = "chrome://browser/skin/zen-icons/new-tab-image.svg";
    }

    favicon.setAttribute("src", iconSrc);

    if (
      iconSrc === defaultFavicon ||
      iconSrc.startsWith("page-icon:") ||
      iconSrc === "chrome://browser/skin/zen-icons/new-tab-image.svg" ||
      iconSrc === "chrome://global/skin/icons/settings.svg" ||
      iconSrc === "chrome://browser/skin/zen-icons/settings.svg"
    ) {
      favicon.classList.add("zen-tab-switcher-favicon-zen");
    }

    infoContainer.appendChild(favicon);
    const title = document.createXULElement("label");
    title.className = "zen-tab-switcher-title";
    title.setAttribute("value", tab.label || "");
    title.setAttribute("crop", "end");
    infoContainer.appendChild(title);
    card.appendChild(infoContainer);

    if (tab.hasAttribute("pending")) {
      card.classList.add("zen-tab-switcher-pending");
    }

    card.addEventListener("click", (event) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        event.stopPropagation();
        this.#currentIndex = index;
        this.close();
      }
    });

    return card;
  }

  /**
   * Retrieves a cached screenshot for a tab.
   *
   * @param {object} tab - The tab to get the thumbnail for.
   * @returns {string|null} The thumbnail data URL, or null if not available.
   */
  #getTabThumbnail(tab) {
    if (tab.hasAttribute("pending")) {
      return null;
    }
    return this.#thumbnailCache.get(tab.linkedPanel);
  }

  /**
   * Updates the card appearance when selection changes.
   *
   * @returns {void}
   */
  #updateSelection() {
    if (!this.tabsContainer) {
      return;
    }

    this.tabsContainer.querySelectorAll(".zen-tab-switcher-card").forEach((card) => {
      const cardIndex = parseInt(card.getAttribute("data-index"), 10);
      const isSelected = cardIndex === this.#currentIndex;
      card.classList.toggle("zen-tab-switcher-selected", isSelected);
    });

    this.#scrollToSelected();
  }

  /**
   * Scrolls the tab container to show the selected card.
   * First press uses instant scroll, subsequent ones use smooth.
   *
   * @returns {void}
   */
  #scrollToSelected() {
    if (!this.tabsContainer) {
      return;
    }
    const selectedCard = this.tabsContainer.querySelector(".zen-tab-switcher-selected");
    if (!selectedCard) {
      return;
    }

    const cardIndex = parseInt(selectedCard.getAttribute("data-index"), 10);
    const pageStartIndex = this.#getPageStartIndex(cardIndex);
    const scrollPosition = pageStartIndex * nsZenTabSwitcher.CARD_WIDTH;

    this.tabsContainer.scrollTo({
      left: scrollPosition,
      behavior: this.#firstPress ? "auto" : "smooth",
    });

    this.#firstPress = false;
  }

  /**
   * Calculates which card should be at the left edge for pagination logic.
   *
   * @param {number} cardIndex - The index of the card.
   * @returns {number} The start index for the current page.
   */
  #getPageStartIndex(cardIndex) {
    const totalTabs = this.#tabList.length;
    const maxVisible = this.#actualVisibleCards;
    const currentPage = Math.floor(cardIndex / maxVisible);
    let pageStartIndex = currentPage * maxVisible;

    const remainingCards = totalTabs - pageStartIndex;

    // Adjust for last page to always show full page of cards
    if (remainingCards < maxVisible && totalTabs > maxVisible) {
      pageStartIndex = Math.max(0, totalTabs - maxVisible);
    }

    return pageStartIndex;
  }

  /**
   * Navigates forward to the next tab in the list.
   * Wraps around to the first tab if at the end of the list.
   *
   * @returns {void}
   */
  #navigateForward() {
    this.#currentIndex = (this.#currentIndex + 1) % this.#tabList.length;
    this.#updateSelection();
  }

  /**
   * Navigates backward to the previous tab in the list.
   * Wraps around to the last tab if at the start of the list.
   *
   * @returns {void}
   */
  #navigateBackward() {
    this.#currentIndex = (this.#currentIndex - 1 + this.#tabList.length) % this.#tabList.length;
    this.#updateSelection();
  }
}

export var gZenTabSwitcher = new nsZenTabSwitcher();
