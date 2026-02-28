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
  static MAX_RECENT_TABS = 50;

  #isOpen = false;
  #currentIndex = 0;
  #tabList = [];
  #thumbnailCache = new Map();
  #lazyPrefs = {};
  #recentlyUsedTabs = [];
  #actualVisibleCards = nsZenTabSwitcher.MAX_VISIBLE_CARDS;
  #firstPress = true;

  init() {
    this.#setupPreferences();
    this.#disableDefaultCtrlTab();
    this.#setupKeyboardListeners();
    this.#setupLazyGetters();
    this.#createUI();
    this.#observeTabChanges();
    this.#setupShutdownObserver();
    this.#initializeRecentlyUsedTabs();
  }

  #setupLazyGetters() {
    ChromeUtils.defineLazyGetter(this, "panel", () =>
      document.getElementById("zen-tab-switcher-panel")
    );
    ChromeUtils.defineLazyGetter(this, "toolbox", () => document.getElementById("TabsToolbar"));
    ChromeUtils.defineLazyGetter(this, "tabsContainer", () =>
      document.getElementById("zen-tab-switcher-tabs")
    );
  }

  #initializeRecentlyUsedTabs() {
    if (gBrowser && gBrowser.selectedTab) {
      this.#recentlyUsedTabs = [gBrowser.selectedTab];
    }
  }

  #setupShutdownObserver() {
    Services.obs.addObserver(this, "quit-application-granted");
  }

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

    Services.prefs.addObserver("zen.tabs.tab-switcher.enabled", this);
  }

  // Called when system events occur (browser shutdown or preference changes).
  observe(subject, topic, data) {
    if (topic === "quit-application-granted") {
      this.#recentlyUsedTabs = [];
    } else if (data === "zen.tabs.tab-switcher.enabled") {
      this.#disableDefaultCtrlTab();
    }
  }

  #setupKeyboardListeners() {
    window.addEventListener("keydown", (e) => this.#handleKeyDown(e), true);
    window.addEventListener("keyup", (e) => this.#handleKeyUp(e), true);
    window.addEventListener("blur", () => this.#isOpen && this.#forceClose());
  }

  #createUI() {
    // Elements are defined via lazy getters
    if (!this.panel) {
      console.error("ZenTabSwitcher: UI elements not found");
    }
  }

  #observeTabChanges() {
    window.addEventListener("TabOpen", () => this.#clearThumbnailsCache());
    window.addEventListener("TabClose", () => {
      this.#clearThumbnailsCache();
      this.#cleanupRecentlyUsedTabs();
    });
    window.addEventListener("TabAttrModified", () => this.#clearThumbnailsCache());
    window.addEventListener("TabMove", () => this.#clearThumbnailsCache());
    window.addEventListener("TabSelect", (event) => this.#onTabSelect(event));
  }

  /**
   * Update recently-used order list whenever a user clicks/switches to tab.
   * Maintains an MRU (most-recently-used) list by moving the selected tab to the front.
   *
   * @param {Event} event - The TabSelect event containing the selected tab in event.target.
   * @returns {void}
   */
  #onTabSelect(event) {
    const tab = event.target;
    if (!tab || tab.closing || tab.hidden) {
      return;
    }

    // Remove tab from its current position when selected and add it to the front
    const index = this.#recentlyUsedTabs.indexOf(tab);
    if (index !== -1) {
      this.#recentlyUsedTabs.splice(index, 1);
    }

    this.#recentlyUsedTabs.unshift(tab);

    if (this.#recentlyUsedTabs.length > nsZenTabSwitcher.MAX_RECENT_TABS) {
      this.#recentlyUsedTabs.pop();
    }
  }

  // Remove tabs that no longer exist from the recently-used list.
  #cleanupRecentlyUsedTabs() {
    this.#recentlyUsedTabs = this.#recentlyUsedTabs.filter(
      (tab) => tab && !tab.closing && gBrowser.tabs.includes(tab)
    );
  }

  // Clear all cached tab screenshots so they'll be regenerated.
  #clearThumbnailsCache() {
    this.#thumbnailCache.clear();
  }

  /**
   * Process keyboard input when keys are pressed down.
   * Handles Escape (to close panel) and Ctrl+Tab (to open/navigate panel).
   *
   * @param {KeyboardEvent} event - The keydown event containing key information and modifiers.
   */
  #handleKeyDown(event) {
    if (!this.#lazyPrefs.enabled) {
      return;
    }

    const stopEvent = () => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };

    if (event.key === "Escape" && this.#isOpen) {
      stopEvent();
      this.#forceClose();
      return;
    }

    if (event.ctrlKey && event.key === "Tab") {
      stopEvent();

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
   * @param {KeyboardEvent} event - The keyup event containing information about which key was released.
   * @returns {void}
   */
  #handleKeyUp(event) {
    if (!this.#isOpen) {
      return;
    }

    if (event.key === "Control") {
      // If window doesn't have focus, close without switching tabs
      document.hasFocus() ? this.close() : this.#forceClose();
    }
  }

  /**
   * Initialize the panel UI and display it to the user.
   * This is async because it waits for thumbnails to be captured before showing the panel.
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

    // Decide which tab index is selected initially
    if (this.#lazyPrefs.useRecentOrder) {
      // In recent order mode, forward goes to next recent (index 1), backward goes to last
      this.#currentIndex = shiftKey ? this.#tabList.length - 1 : 1;
    } else {
      const currentTabIndex = this.#tabList.indexOf(gBrowser.selectedTab);

      // Determine which tab to initially highlight when opening switcher
      // If current tab is in the list and ctrl+shift+tab: Select previous tab
      // + this.#tablist.length ensures subtraction never goes negative before modulo
      // Example: If at index 0 in a 5-tab list, (0 - 1 + 5) % 5 = 4 (wraps to end of list)
      if (shiftKey) {
        this.#currentIndex =
          currentTabIndex >= 0
            ? (currentTabIndex - 1 + this.#tabList.length) % this.#tabList.length
            : this.#tabList.length - 1;
        // If current tab is in the list and ctrl+tab: Select the next tab
        // Uses modulo to wrap around to index 0 if at the end
        // If current tab not found: default to first tab (index 0)
      } else {
        this.#currentIndex =
          currentTabIndex >= 0 ? (currentTabIndex + 1) % this.#tabList.length : 0;
      }
    }

    await this.#preCacheThumbnailsForVisible();

    this.#renderTabs();

    // Use PanelMultiView API and anchor to toolbar like other panels
    PanelMultiView.openPopup(this.panel, this.toolbox, {
      position: "overlap",
      triggerEvent: null,
      x: 0,
      y: 0,
    });

    // Scroll to selected tab - firstPress flag ensures instant scroll
    setTimeout(() => this.#scrollToSelected(), 0);

    this.#preCacheThumbnails();
  }

  // Closes the tab switcher and switches to the selected tab.
  close() {
    if (!this.#isOpen) {
      return;
    }

    const selectedTab = this.#tabList[this.#currentIndex];
    if (selectedTab && selectedTab !== gBrowser.selectedTab) {
      gBrowser.selectedTab = selectedTab;
    }

    this.#resetState();
  }

  // Closes the switcher without switching tabs (used for Escape key).
  #forceClose() {
    if (!this.#isOpen) {
      return;
    }
    this.#resetState();
  }

  // Resets the switcher state.
  #resetState() {
    this.panel.hidePopup();
    this.#isOpen = false;
    this.#currentIndex = 0;
    this.#tabList = [];
    this.#firstPress = true;
  }

  // Captures screenshots for all tabs in the background.
  #preCacheThumbnails() {
    this.#tabList.forEach((tab) => this.#captureThumbnail(tab));
  }

  /* Captures screenshots only for tabs that are currently visible on screen
   * This is async so it waits for all thumbnails before showing the panel */
  async #preCacheThumbnailsForVisible() {
    // Step 1: Get the index of the first tab that should be visible on the current page
    const pageStartIndex = this.#getPageStartIndex(this.#currentIndex);
    // Step 2: Get the tabs that should be visible on the current page based on the start index and max visible cards
    const endIndex = Math.min(this.#tabList.length, pageStartIndex + this.#actualVisibleCards);
    // Step 3: Capture thumbnails for those tabs and ensure they are all captured before showing panel
    const tabsToCache = this.#tabList.slice(pageStartIndex, endIndex);
    const tasks = tabsToCache.map((tab) => this.#captureThumbnail(tab));
    await Promise.all(tasks);
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
      canvas.width = 320;
      canvas.height = 180;

      await lazy.PageThumbs.captureToCanvas(browser, canvas);
      const dataUrl = canvas.toDataURL("image/png");
      this.#thumbnailCache.set(tabId, dataUrl);

      if (this.#isOpen) {
        this.#renderTabs();
      }
    } catch (e) {
      console.warn("Failed to pre-cache thumbnail:", e);
    }
  }

  // Creates the list of tabs to show in the switcher.
  #buildTabList() {
    if (this.#lazyPrefs.useRecentOrder) {
      this.#cleanupRecentlyUsedTabs();
    }

    const tabs = this.#lazyPrefs.useRecentOrder ? this.#recentlyUsedTabs : gBrowser.tabs;
    // #tabList contains only valid tabs in the chosen order (recent/visual)
    this.#tabList = [...tabs].filter(
      (tab) => !tab.closing && !tab.hidden && !tab.hasAttribute("zen-empty-tab")
    );
  }

  // Creates the visual tab cards and adds them to the DOM.
  #renderTabs() {
    if (!this.tabsContainer) {
      return;
    }
    // Remove old cards for fresh render
    this.tabsContainer.innerHTML = "";

    const totalTabs = this.#tabList.length;
    // Prevent showing more cards than tabs exist
    this.#actualVisibleCards = Math.min(totalTabs, nsZenTabSwitcher.MAX_VISIBLE_CARDS);
    const containerWidth = `${nsZenTabSwitcher.CARD_WIDTH * this.#actualVisibleCards}px`;

    Object.assign(this.tabsContainer.style, {
      width: containerWidth,
      maxWidth: containerWidth,
      minWidth: containerWidth,
    });

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

    const thumbnailContainer = document.createXULElement("box");
    thumbnailContainer.className = "zen-tab-switcher-thumbnail";

    const isPending = tab.hasAttribute("pending");
    const thumbnail = isPending ? null : this.#getTabThumbnail(tab);

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
    return tab.hasAttribute("pending") ? null : this.#thumbnailCache.get(tab.linkedPanel) || null;
  }

  // Updates the visual appearance when selection changes.
  #updateSelection() {
    if (!this.tabsContainer) {
      return;
    }

    // Select all tab card elements
    this.tabsContainer.querySelectorAll(".zen-tab-switcher-card").forEach((card) => {
      // Check if current card is selected
      // Convert data attribute string to base 10
      const cardIndex = parseInt(card.getAttribute("data-index"), 10);
      const isSelected = cardIndex === this.#currentIndex;
      const title = card.querySelector(".zen-tab-switcher-title");

      card.classList.toggle("zen-tab-switcher-selected", isSelected);

      if (title) {
        if (isSelected) {
          title.style.setProperty("color", "white", "important");
          title.style.setProperty("-moz-text-fill-color", "white", "important");
        } else {
          title.style.color = "";
          title.style.removeProperty("-moz-text-fill-color");
        }
      }
    });

    this.#scrollToSelected();
  }

  /* Scrolls the tab container to show the selected card.
   * Uses page-based scrolling (shows full pages of cards, never cuts off).
   * First press uses instant scroll, subsequent ones use smooth. */
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
    // Multiply the page start index by card width to get pixel offset
    // Example: If pageStartIndex = 5, scroll position = 5 * 200 = 1000px from the left edge
    const scrollPosition = pageStartIndex * nsZenTabSwitcher.CARD_WIDTH;

    // Scroll the container horizontally to show the selected tab's page
    this.tabsContainer.scrollTo({
      // Set horizontal scroll position in pixels
      left: scrollPosition,
      // Instant scroll on first open, smooth animation afterwards
      behavior: this.#firstPress ? "auto" : "smooth",
    });

    this.#firstPress = false;
  }

  /**
   * Calculates which card should be at the left edge for pagination.
   * Ensures the page shows full cards without cutoff at the end.
   *
   * @param {number} cardIndex - The index of the card.
   * @returns {number} The start index for the current page.
   */
  #getPageStartIndex(cardIndex) {
    const totalTabs = this.#tabList.length;
    const maxVisible = this.#actualVisibleCards;
    // Determine which page contains the card
    // Example: If cardIndex = 7 and maxVisible = 5, currentPage = 1 (second page), pageStartIndex = 5
    const currentPage = Math.floor(cardIndex / maxVisible);
    let pageStartIndex = currentPage * maxVisible;

    // Edge case: Adjustment for last page
    // Example: 12 total tabs with 5 visible means last page starts at index 10 which would only show 2 tabs (10 and 11)
    const remainingCards = totalTabs - pageStartIndex;

    // Solution: When remaining cards < maxVisible, shift the page backwards to always show a full page
    // totalTabs - maxVisible ensures last maxVisible cards are shown
    // Example: 12 - 5 = 7, so show cards 7-11 (5 full cards)
    // Math.max(0, ...) prevents negative index if totalTabs < maxVisible
    if (remainingCards < maxVisible && totalTabs > maxVisible) {
      pageStartIndex = Math.max(0, totalTabs - maxVisible);
    }

    return pageStartIndex;
  }

  #navigateForward() {
    // this.#currentIndex + 1 - Moves to next tab
    // % this.#tabList.length - Wraps around to start if at the end of the list
    // Example: In a 5-tab list, if currentIndex is 4 (last tab), (4 + 1) % 5 = 0 (wraps to first tab)
    this.#currentIndex = (this.#currentIndex + 1) % this.#tabList.length;
    this.#updateSelection();
  }

  #navigateBackward() {
    // this.#currentIndex - 1 - Moves to previous tab
    // + this.#tabList.length - Ensures positive result before modulo
    // % this.#tabList.length - Wraps around to end if at the start of the list
    // Example: In a 5-tab list, if currentIndex is 0 (first tab), (0 - 1 + 5) % 5 = 4 (wraps to last tab)
    this.#currentIndex = (this.#currentIndex - 1 + this.#tabList.length) % this.#tabList.length;
    this.#updateSelection();
  }
}

export var gZenTabSwitcher = new nsZenTabSwitcher();
