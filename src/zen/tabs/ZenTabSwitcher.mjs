/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { nsZenDOMOperatedFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";

class nsZenTabSwitcher extends nsZenDOMOperatedFeature {

  #isOpen = false;
  #currentIndex = 0;
  #tabList = [];
  #thumbnailCache = new Map();        // Map: Stores tab screenshots using tabId as key
  #ctrlPressed = false;
  #lazyPrefs = {};                    // Object: Stores user preferences loaded lazily
  #recentlyUsedTabs = [];
  #actualVisibleCards = 5;            // Number: How many cards fit on screen (updates dynamically)

  init() {
    console.log("ZenTabSwitcher: Initializing...");

    // Call setup methods in order:
    this.#setupPreferences();
    this.#disableDefaultCtrlTab();
    this.#setupKeyboardListeners();
    this.#createUI();
    this.#observeTabChanges();
    this.#setupShutdownObserver();
    this.#initializeRecentlyUsedTabs();

    console.log("ZenTabSwitcher: Initialization complete");
  }

  // ==========================================================================
  // METHOD: #initializeRecentlyUsedTabs
  // Sets up the list that tracks which tabs have been used recently
  // ==========================================================================
  #initializeRecentlyUsedTabs() {
    if (gBrowser.selectedTab) {
      this.#recentlyUsedTabs = [gBrowser.selectedTab];
    }
  }

  // ==========================================================================
  // METHOD: #setupShutdownObserver
  // Registers a listener for when the browser is closing
  // ==========================================================================
  #setupShutdownObserver() {
    Services.obs.addObserver(this, "quit-application-granted", false);
  }

  // ==========================================================================
  // METHOD: #disableDefaultCtrlTab
  // Turns off Firefox's default Ctrl+Tab switcher so ours can work
  // ==========================================================================
  #disableDefaultCtrlTab() {
    const enabled = Services.prefs.getBoolPref("zen.tabs.tab-switcher.enabled", true);

    if (enabled) {
      // window.ctrlTab is Firefox's built-in Ctrl+Tab handler
      // Turn it off so it doesn't interfere with our custom switcher
      if (window.ctrlTab && window.ctrlTab.uninit) {
        ctrlTab.uninit();
      }
    } else {
      // If our feature is disabled, re-enable Firefox's default handler
      if (window.ctrlTab && window.ctrlTab.readPref) {
        ctrlTab.readPref();
      }
    }
  }

  // ==========================================================================
  // METHOD: #setupPreferences
  // Loads user preferences from Firefox's preference system
  // ==========================================================================
  #setupPreferences() {

    XPCOMUtils.defineLazyPreferenceGetter(
      this.#lazyPrefs,
      "enabled",
      "zen.tabs.tab-switcher.enabled",
      true
    );

    XPCOMUtils.defineLazyPreferenceGetter(
      this.#lazyPrefs,
      "showUnloaded",
      "zen.tabs.tab-switcher.show-unloaded",
      false
    );

    XPCOMUtils.defineLazyPreferenceGetter(
      this.#lazyPrefs,
      "useRecentOrder",
      "zen.tabs.tab-switcher.use-recent-order",
      false
    );

    Services.prefs.addObserver("zen.tabs.tab-switcher.enabled", this);
  }

  // ==========================================================================
  // METHOD: observe
  // Called when system events occur (browser shutdown or preference changes)
  // This is part of Firefox's observer pattern
  // ==========================================================================
  observe(subject, topic, data) {
    if (topic === "quit-application-granted") {
      this.#recentlyUsedTabs = [];
    } else if (data === "zen.tabs.tab-switcher.enabled") {
      this.#disableDefaultCtrlTab();
    }
  }

  // ==========================================================================
  // METHOD: #setupKeyboardListeners
  // Registers event listeners for keyboard input
  // ==========================================================================
  #setupKeyboardListeners() {
    window.addEventListener("keydown", this.#handleKeyDown.bind(this), true);
    window.addEventListener("keyup", this.#handleKeyUp.bind(this), true);
  }

  // ==========================================================================
  // METHOD: #createUI
  // Gets references to HTML/XUL elements that make up the switcher interface
  // ==========================================================================
  #createUI() {
    this.container = document.getElementById("zen-tab-switcher-container");
    this.panel = document.getElementById("zen-tab-switcher-panel");
    this.tabsContainer = document.getElementById("zen-tab-switcher-tabs");

    if (!this.container) {
      console.error("ZenTabSwitcher: UI elements not found");
      return;
    }

    // This ensures position:fixed in CSS works relative to the full viewport
    if (this.container.parentNode !== document.documentElement) {
      document.documentElement.appendChild(this.container);
    }
  }

  // ==========================================================================
  // METHOD: #observeTabChanges
  // Sets up listeners for tab-related events (open, close, select, etc.)
  // ==========================================================================
  #observeTabChanges() {
    window.addEventListener("TabOpen", () => this.#invalidateThumbnailsCache());
    window.addEventListener("TabClose", () => {
      this.#invalidateThumbnailsCache();
      this.#cleanupRecentlyUsedTabs();
    });
    window.addEventListener("TabAttrModified", () => this.#invalidateThumbnailsCache());
    window.addEventListener("TabMove", () => this.#invalidateThumbnailsCache());

    window.addEventListener("resize", () => this.handleResize());

    window.addEventListener("TabSelect", (event) => this.#onTabSelect(event));
  }

  // ==========================================================================
  // METHOD: #onTabSelect
  // Called whenever a tab becomes active (user clicks on it or switches to it)
  // Updates the recently-used order list
  // ==========================================================================
  #onTabSelect(event) {
    const tab = event.target;

    if (!tab || tab.closing || tab.hidden) return;

    const index = this.#recentlyUsedTabs.indexOf(tab);
    if (index !== -1) {
      this.#recentlyUsedTabs.splice(index, 1);
    }

    this.#recentlyUsedTabs.unshift(tab);

    // Limit list size to prevent memory issues
    if (this.#recentlyUsedTabs.length > 50) {
      this.#recentlyUsedTabs.pop();  // Remove the oldest (last) tab
    }
  }

  // ==========================================================================
  // METHOD: #cleanupRecentlyUsedTabs
  // Removes tabs that no longer exist from the recently-used list
  // ==========================================================================
  #cleanupRecentlyUsedTabs() {
    this.#recentlyUsedTabs = this.#recentlyUsedTabs.filter(tab =>
      tab &&
      !tab.closing &&
      gBrowser.tabs.includes(tab)
    );
  }

  // ==========================================================================
  // METHOD: #invalidateThumbnailsCache
  // Clears all cached tab screenshots so they'll be regenerated
  // ==========================================================================
  #invalidateThumbnailsCache() {
    this.#thumbnailCache.clear();
  }

  // ==========================================================================
  // METHOD: #handleKeyDown
  // Processes keyboard input when keys are pressed down
  // ==========================================================================
  #handleKeyDown(event) {
    if (!this.#lazyPrefs.enabled) return;

    if (event.key === "Escape" && this.#isOpen) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.#forceClose();
      return false;
    }

    // CTRL+TAB: Open switcher or navigate within it
    if (event.ctrlKey && event.key === "Tab") {
      console.log("ZenTabSwitcher: Ctrl+Tab detected, opening switcher");

      // Prevent all default behaviors (Firefox's default Ctrl+Tab, etc.)
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      this.#ctrlPressed = true;

      if (!this.#isOpen) {
        this.open();
      } else {
        if (event.shiftKey) {
          this.#navigateBackward();
        } else {
          this.#navigateForward();
        }
      }

      return false;
    }
  }

  // ==========================================================================
  // METHOD: #handleKeyUp
  // Processes keyboard input when keys are released
  // ==========================================================================
  #handleKeyUp(event) {
    if (!this.#isOpen) return;

    if (event.key === "Control") {
      this.#ctrlPressed = false;
      this.close();
    }
  }

  // ==========================================================================
  // METHOD: open
  // Opens the tab switcher panel
  // This is async because it waits for thumbnails to be captured
  // ==========================================================================
  async open() {
    if (this.#isOpen) return;

    this.#buildTabList();

    if (this.#tabList.length <= 1) return;

    this.#isOpen = true;

    // Determine which tab should be initially selected
    if (this.#lazyPrefs.useRecentOrder) {
      // In recent order mode, start at index 0 (the most recently used tab)
      this.#currentIndex = 0;
    } else {
      // In visual order mode, start at the currently active tab
      const currentTabIndex = this.#tabList.indexOf(gBrowser.selectedTab);
      this.#currentIndex = currentTabIndex >= 0 ? currentTabIndex : 0;
    }

    await this.#preCacheThumbnailsForVisible();

    this.#renderTabs();

    this.container.hidden = false;
    this.container.classList.add("zen-tab-switcher-open");

    // Scroll to show the selected tab after a brief delay
    setTimeout(() => this.#scrollToSelected(), 0);

    // Continue capturing thumbnails for remaining tabs in the background
    this.#preCacheThumbnails();
  }

  // ==========================================================================
  // METHOD: close
  // Closes the tab switcher and switches to the selected tab
  // ==========================================================================
  close() {
    if (!this.#isOpen) return;

    const selectedTab = this.#tabList[this.#currentIndex];

    this.container.classList.remove("zen-tab-switcher-open");

    let hasHidden = false;
    const hideContainer = () => {
      if (hasHidden) return;
      hasHidden = true;
      this.container.hidden = true;
      this.container.removeEventListener("animationend", hideContainer);
    };

    this.container.addEventListener("animationend", hideContainer, { once: true });

    // Fallback: Hide after 200ms even if animation doesn't fire
    setTimeout(hideContainer, 200);

    if (selectedTab && selectedTab !== gBrowser.selectedTab) {
      gBrowser.selectedTab = selectedTab;
    }

    this.#isOpen = false;
    this.#currentIndex = 0;
    this.#tabList = [];
  }

  // ==========================================================================
  // METHOD: #forceClose
  // Closes the switcher without switching tabs (used for Escape key)
  // ==========================================================================
  #forceClose() {
    if (!this.#isOpen) return;

    this.#ctrlPressed = false;
    this.container.classList.remove("zen-tab-switcher-open");
    this.container.hidden = true;

    this.#isOpen = false;
    this.#currentIndex = 0;
    this.#tabList = [];
  }

  // ==========================================================================
  // METHOD: #preCacheThumbnails
  // Captures screenshots for all tabs in the background
  // ==========================================================================
  #preCacheThumbnails() {
    const tabsToCache = this.#tabList;

    for (const tab of tabsToCache) {
      this.#captureThumbnail(tab);
    }
  }

  // ==========================================================================
  // METHOD: #preCacheThumbnailsForVisible
  // Captures screenshots only for tabs that are currently visible on screen
  // This is async so it waits for all thumbnails before showing the panel
  // ==========================================================================
  async #preCacheThumbnailsForVisible() {
    // Calculate which tabs are currently visible based on pagination
    const { pageStartIndex, maxVisible } = this.#getPageStartIndex(this.#currentIndex);
    const endIndex = Math.min(this.#tabList.length, pageStartIndex + maxVisible);
    const tabsToCache = this.#tabList.slice(pageStartIndex, endIndex);

    const tasks = tabsToCache.map((tab) => this.#captureThumbnail(tab));
    await Promise.all(tasks);
  }

  // ==========================================================================
  // METHOD: #captureThumbnail
  // Captures a screenshot of a single tab's content
  // ==========================================================================
  async #captureThumbnail(tab) {
    if (tab.hasAttribute("pending")) return;

    const tabId = tab.linkedPanel;
    if (this.#thumbnailCache.has(tabId)) return;

    const browser = tab.linkedBrowser;
    if (!browser) return;

    try {
      const canvas = document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
      canvas.width = 320;
      canvas.height = 180;

      const { PageThumbs } = ChromeUtils.importESModule(
        "resource://gre/modules/PageThumbs.sys.mjs"
      );

      await PageThumbs.captureToCanvas(browser, canvas);

      const dataUrl = canvas.toDataURL("image/png");

      this.#thumbnailCache.set(tabId, dataUrl);

      if (this.#isOpen) {
        this.#renderTabs();
      }
    } catch (e) {
      console.warn("Failed to pre-cache thumbnail:", e);
    }
  }

  // ==========================================================================
  // METHOD: #buildTabList
  // Creates the list of tabs to show in the switcher
  // Filters tabs based on user preferences
  // ==========================================================================
  #buildTabList() {
    const showUnloaded = this.#lazyPrefs.showUnloaded;
    const useRecentOrder = this.#lazyPrefs.useRecentOrder;

    let tabs = [];

    if (useRecentOrder) {
      this.#cleanupRecentlyUsedTabs();

      tabs = [...this.#recentlyUsedTabs];

      this.#tabList = tabs.filter(tab => {
        if (tab.closing || tab.hidden) return false;
        if (tab.hasAttribute("zen-empty-tab")) return false;
        if (tab.hasAttribute("pending")) return false;
        return true;
      });

      return;
    }

    tabs = [...gBrowser.tabs];

    this.#tabList = tabs.filter(tab => {
      if (tab.closing || tab.hidden) return false;

      if (tab.hasAttribute("zen-empty-tab")) return false;

      if (!showUnloaded && tab.hasAttribute("pending")) return false;

      return true;
    });
  }

  // ==========================================================================
  // METHOD: #renderTabs
  // Creates the visual tab cards and adds them to the DOM
  // Calculates responsive layout based on window size
  // ==========================================================================
  /**
   * Render tab cards in the UI
   * Shows up to 5 tabs at once with smooth horizontal scrolling
   */
  #renderTabs() {
    if (!this.tabsContainer) return;

    this.tabsContainer.innerHTML = "";

    const totalTabs = this.#tabList.length;

    const cardWidth = 200;
    const gap = 0;
    const panelPadding = 23 * 2;

    // RESPONSIVE CALCULATION: How many cards fit on screen?
    const maxAvailableWidth = window.innerWidth * 0.9 - panelPadding;
    const maxCardsThatFit = Math.floor((maxAvailableWidth + gap) / (cardWidth + gap));
    const maxVisibleFromBreakpoints = this.#getMaxVisibleCards();
    const visibleCount = Math.min(totalTabs, maxVisibleFromBreakpoints, maxCardsThatFit);
    const containerWidth = (cardWidth * visibleCount) + (gap * (visibleCount - 1));

    this.#actualVisibleCards = visibleCount;
    this.tabsContainer.style.width = `${containerWidth}px`;
    this.tabsContainer.style.maxWidth = `${containerWidth}px`;

    this.#tabList.forEach((tab, index) => {
      const tabCard = this.#createTabCard(tab, index);

      if (index === this.#currentIndex) {
        tabCard.classList.add("zen-tab-switcher-selected");
      }

      this.tabsContainer.appendChild(tabCard);
    });

    // Apply white text color to selected card title
    this.#applySelectionTextStyles();
  }



  // ==========================================================================
  // METHOD: #createTabCard
  // Creates a single tab card element with thumbnail, favicon, and title
  // Returns: XUL <vbox> element representing the tab card
  // ==========================================================================
  #createTabCard(tab, index) {
    const card = document.createXULElement("vbox");
    card.className = "zen-tab-switcher-card";
    card.setAttribute("data-index", index);

    // === THUMBNAIL SECTION ===
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

    // === INFO SECTION (Favicon + Title) ===
    const infoContainer = document.createXULElement("hbox");
    infoContainer.className = "zen-tab-switcher-info";

    const favicon = document.createXULElement("image");
    favicon.className = "zen-tab-switcher-favicon";

    const defaultFavicon = PlacesUtils.favicons.defaultFavicon.spec;
    let iconSrc = gBrowser.getIcon(tab) || defaultFavicon;

    // Replace Firefox branding icons with our icon for about: pages
    if (iconSrc.startsWith("chrome://branding/content/")) {
      iconSrc = "chrome://browser/skin/zen-icons/new-tab-image.svg";
    }

    favicon.setAttribute("src", iconSrc);

    // Special styling for certain icons (makes them theme-aware)
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

    // TITLE
    const title = document.createXULElement("label");
    title.className = "zen-tab-switcher-title";
    title.setAttribute("value", tab.label || "");
    title.setAttribute("crop", "end");
    infoContainer.appendChild(title);

    card.appendChild(infoContainer);

    if (tab.hasAttribute("pending")) {
      card.classList.add("zen-tab-switcher-pending");
    }

    // === CLICK HANDLER ===
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

  // ==========================================================================
  // METHOD: #getTabThumbnail
  // Retrieves a cached screenshot for a tab (returns null if not available)
  // ==========================================================================
  #getTabThumbnail(tab) {
    const tabId = tab.linkedPanel;

    if (tab.hasAttribute("pending")) {
      return null;
    }

    return this.#thumbnailCache.get(tabId) || null;
  }

  // ==========================================================================
  // METHOD: #updateSelection
  // Updates the visual appearance when selection changes
  // ==========================================================================
  #updateSelection() {
    if (!this.tabsContainer) return;

    const cards = this.tabsContainer.querySelectorAll(".zen-tab-switcher-card");

    cards.forEach((card) => {
      const cardIndex = parseInt(card.getAttribute("data-index"), 10);

      if (cardIndex === this.#currentIndex) {
        card.classList.add("zen-tab-switcher-selected");
      } else {
        card.classList.remove("zen-tab-switcher-selected");
      }
    });

    // Apply white text color to selected card
    this.#applySelectionTextStyles();

    // Scroll to show the selected card
    this.#scrollToSelected();
  }

  // ==========================================================================
  // METHOD: #applySelectionTextStyles
  // Forces the selected card's title text to be white using inline styles
  // This is necessary because XUL labels don't always respect CSS color
  // ==========================================================================
  #applySelectionTextStyles() {
    if (!this.tabsContainer) return;

    const cards = this.tabsContainer.querySelectorAll(".zen-tab-switcher-card");

    cards.forEach((card) => {
      const title = card.querySelector(".zen-tab-switcher-title");
      if (!title) return;

      if (card.classList.contains("zen-tab-switcher-selected")) {
        // Selected: Force white text with !important flag
        title.style.setProperty("color", "white", "important");
        title.style.setProperty("-moz-text-fill-color", "white", "important");
      } else {
        title.style.color = "";
        title.style.removeProperty("-moz-text-fill-color");
      }
    });
  }

  // ==========================================================================
  // METHOD: #scrollToSelected
  // Scrolls the tab container to show the selected card
  // Uses page-based scrolling (shows full pages of cards, never cuts off)
  // ==========================================================================
  /**
   * Scroll container to show the selected tab with page-based snapping
   * Ensures full cards are visible without cutoff
   */
  #scrollToSelected() {
    if (!this.tabsContainer) return;

    const selectedCard = this.tabsContainer.querySelector(".zen-tab-switcher-selected");
    if (!selectedCard) return;

    const cardWidth = 200;
    const gap = 0;
    const cardIndex = parseInt(selectedCard.getAttribute("data-index"), 10);
    const { pageStartIndex } = this.#getPageStartIndex(cardIndex);
    const scrollPosition = pageStartIndex * (cardWidth + gap);

    this.tabsContainer.scrollTo({
      left: scrollPosition,
      behavior: "smooth"
    });
  }

  // ==========================================================================
  // METHOD: #getMaxVisibleCards
  // Calculates how many cards should be visible based on window width
  // Uses responsive breakpoints and user preference
  // ==========================================================================
  #getMaxVisibleCards() {
    const prefMax = Math.min(10, Math.max(1,
      Services.prefs.getIntPref("zen.tabs.tab-switcher.max-visible-cards", 5)
    ));

    // Responsive breakpoints based on window width
    let maxVisible = prefMax;
    const viewportWidth = window.innerWidth;

    if (viewportWidth <= 550) {
      maxVisible = 1;
    } else if (viewportWidth <= 800) {
      maxVisible = Math.min(2, prefMax);
    } else if (viewportWidth <= 1050) {
      maxVisible = Math.min(3, prefMax);
    } else if (viewportWidth <= 1300) {
      maxVisible = Math.min(4, prefMax);
    }

    return maxVisible;
  }

  // ==========================================================================
  // METHOD: #getPageStartIndex
  // Calculates which card should be at the left edge for pagination
  // Ensures the page shows full cards without cutoff at the end
  // ==========================================================================
  #getPageStartIndex(cardIndex) {
    const totalTabs = this.#tabList.length;
    const maxVisible = this.#actualVisibleCards;
    const currentPage = Math.floor(cardIndex / maxVisible);

    let pageStartIndex = currentPage * maxVisible;

    const remainingCards = totalTabs - pageStartIndex;
    if (remainingCards < maxVisible && totalTabs > maxVisible) {
      pageStartIndex = Math.max(0, totalTabs - maxVisible);
    }

    return { pageStartIndex, maxVisible };
  }

  // ==========================================================================
  // METHOD: #navigateForward
  // Moves selection to the next tab (wraps around at end)
  // ==========================================================================
  #navigateForward() {
    // Modulo operator (%) wraps around: if at last tab, go to first
    this.#currentIndex = (this.#currentIndex + 1) % this.#tabList.length;
    this.#updateSelection();
  }

  // ==========================================================================
  // METHOD: #navigateBackward
  // Moves selection to the previous tab (wraps around at beginning)
  // ==========================================================================
  #navigateBackward() {
    // Add length before modulo to handle negative wrapping correctly
    this.#currentIndex = (this.#currentIndex - 1 + this.#tabList.length) % this.#tabList.length;
    this.#updateSelection();
  }

  // ==========================================================================
  // METHOD: handleResize
  // Called when the browser window is resized
  // Re-renders the switcher if it's open to adjust card count
  // ==========================================================================
  handleResize() {
    if (this.#isOpen) {
      // Recalculate how many cards fit and re-render
      this.#renderTabs();
      this.#updateSelection();
    }
  }
}

export var gZenTabSwitcher = new nsZenTabSwitcher();
