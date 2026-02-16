/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { nsZenDOMOperatedFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";

class nsZenTabSwitcher extends nsZenDOMOperatedFeature {

  #isOpen = false;
  #currentIndex = 0;
  #tabList = [];
  #thumbnailCache = new Map(); 
  #ctrlPressed = false;
  #lazyPrefs = {}; 
  #recentlyUsedTabs = [];
  #actualVisibleCards = 5; 

  init() {
    console.log("ZenTabSwitcher: Initializing...");

    this.#setupPreferences();
    this.#disableDefaultCtrlTab();
    this.#setupKeyboardListeners();
    this.#createUI();
    this.#observeTabChanges();
    this.#setupShutdownObserver();
    this.#initializeRecentlyUsedTabs();

    console.log("ZenTabSwitcher: Initialization complete");
  }

  // Sets up the list that tracks which tabs have been used recently
  #initializeRecentlyUsedTabs() {
    if (gBrowser.selectedTab) {
      this.#recentlyUsedTabs = [gBrowser.selectedTab];
    }
  }

  // Registers a listener for when the browser is closing
  #setupShutdownObserver() {
    Services.obs.addObserver(this, "quit-application-granted", false);
  }

  // Turns off Firefox's default Ctrl+Tab switcher so ours can work
  #disableDefaultCtrlTab() {
    const enabled = Services.prefs.getBoolPref("zen.tabs.tab-switcher.enabled", true);

    if (enabled) {
      if (window.ctrlTab && window.ctrlTab.uninit) {
        ctrlTab.uninit();
      }
    } else {
      if (window.ctrlTab && window.ctrlTab.readPref) {
        ctrlTab.readPref();
      }
    }
  }

  // Loads user preferences from Firefox's preference system
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

  // Called when system events occur (browser shutdown or preference changes)
  // This is part of Firefox's observer pattern
  observe(subject, topic, data) {
    if (topic === "quit-application-granted") {
      this.#recentlyUsedTabs = [];
    } else if (data === "zen.tabs.tab-switcher.enabled") {
      this.#disableDefaultCtrlTab();
    }
  }

  // Registers event listeners for keyboard input
  #setupKeyboardListeners() {
    window.addEventListener("keydown", this.#handleKeyDown.bind(this), true);
    window.addEventListener("keyup", this.#handleKeyUp.bind(this), true);
  }

  // Gets references to HTML/XUL elements that make up the switcher interface
  #createUI() {
    this.container = document.getElementById("zen-tab-switcher-container");
    this.panel = document.getElementById("zen-tab-switcher-panel");
    this.tabsContainer = document.getElementById("zen-tab-switcher-tabs");

    if (!this.container) {
      console.error("ZenTabSwitcher: UI elements not found");
      return;
    }

    if (this.container.parentNode !== document.documentElement) {
      document.documentElement.appendChild(this.container);
    }
  }

  // Sets up listeners for tab-related events (open, close, select, etc.)
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

  // Called whenever a tab becomes active (user clicks on it or switches to it)
  // Updates the recently-used order list
  #onTabSelect(event) {
    const tab = event.target;

    if (!tab || tab.closing || tab.hidden) return;

    const index = this.#recentlyUsedTabs.indexOf(tab);
    if (index !== -1) {
      this.#recentlyUsedTabs.splice(index, 1);
    }

    this.#recentlyUsedTabs.unshift(tab);

    if (this.#recentlyUsedTabs.length > 50) {
      this.#recentlyUsedTabs.pop(); 
    }
  }

  // Removes tabs that no longer exist from the recently-used list
  #cleanupRecentlyUsedTabs() {
    this.#recentlyUsedTabs = this.#recentlyUsedTabs.filter(tab =>
      tab &&
      !tab.closing &&
      gBrowser.tabs.includes(tab)
    );
  }

  // Clears all cached tab screenshots so they'll be regenerated
  #invalidateThumbnailsCache() {
    this.#thumbnailCache.clear();
  }

  // Processes keyboard input when keys are pressed down
  #handleKeyDown(event) {
    if (!this.#lazyPrefs.enabled) return;

    if (event.key === "Escape" && this.#isOpen) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.#forceClose();
      return false;
    }

    if (event.ctrlKey && event.key === "Tab") {
      console.log("ZenTabSwitcher: Ctrl+Tab detected, opening switcher");

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

  // Processes keyboard input when keys are released
  #handleKeyUp(event) {
    if (!this.#isOpen) return;

    if (event.key === "Control") {
      this.#ctrlPressed = false;
      this.close();
    }
  }

  // Opens the tab switcher panel
  // This is async because it waits for thumbnails to be captured
  async open() {
    if (this.#isOpen) return;

    this.#buildTabList();

    if (this.#tabList.length <= 1) return;

    this.#isOpen = true;

    if (this.#lazyPrefs.useRecentOrder) {
      this.#currentIndex = 0;
    } else {
      const currentTabIndex = this.#tabList.indexOf(gBrowser.selectedTab);
      this.#currentIndex = currentTabIndex >= 0 ? currentTabIndex : 0;
    }

    await this.#preCacheThumbnailsForVisible();

    this.#renderTabs();
    this.container.hidden = false;
    this.container.classList.add("zen-tab-switcher-open");

    setTimeout(() => this.#scrollToSelected(), 0);

    this.#preCacheThumbnails();
  }

  // Closes the tab switcher and switches to the selected tab
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

    setTimeout(hideContainer, 200);

    if (selectedTab && selectedTab !== gBrowser.selectedTab) {
      gBrowser.selectedTab = selectedTab;
    }

    this.#isOpen = false;
    this.#currentIndex = 0;
    this.#tabList = [];
  }

  // Closes the switcher without switching tabs (used for Escape key)
  #forceClose() {
    if (!this.#isOpen) return;

    this.#ctrlPressed = false;
    this.container.classList.remove("zen-tab-switcher-open");
    this.container.hidden = true;

    this.#isOpen = false;
    this.#currentIndex = 0;
    this.#tabList = [];
  }

  // Captures screenshots for all tabs in the background
  #preCacheThumbnails() {
    const tabsToCache = this.#tabList;

    for (const tab of tabsToCache) {
      this.#captureThumbnail(tab);
    }
  }

  // Captures screenshots only for tabs that are currently visible on screen
  // This is async so it waits for all thumbnails before showing the panel
  async #preCacheThumbnailsForVisible() {
    // Calculate which tabs are currently visible based on pagination
    const { pageStartIndex, maxVisible } = this.#getPageStartIndex(this.#currentIndex);
    const endIndex = Math.min(this.#tabList.length, pageStartIndex + maxVisible);
    const tabsToCache = this.#tabList.slice(pageStartIndex, endIndex);

    const tasks = tabsToCache.map((tab) => this.#captureThumbnail(tab));
    await Promise.all(tasks);
  }

  // Captures a screenshot of a single tab's content
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

  // Creates the list of tabs to show in the switcher
  // Filters tabs based on user preferences
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

  // Creates the visual tab cards and adds them to the DOM
  // Calculates responsive layout based on window size
  #renderTabs() {
    if (!this.tabsContainer) return;

    this.tabsContainer.innerHTML = "";

    const totalTabs = this.#tabList.length;

    const cardWidth = 200;
    const gap = 0;
    const panelPadding = 23 * 2;

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

    this.#applySelectionTextStyles();
  }



  // Creates a single tab card element with thumbnail, favicon, and title
  // Returns: XUL <vbox> element representing the tab card
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

  // Retrieves a cached screenshot for a tab (returns null if not available)
  #getTabThumbnail(tab) {
    const tabId = tab.linkedPanel;

    if (tab.hasAttribute("pending")) {
      return null;
    }

    return this.#thumbnailCache.get(tabId) || null;
  }

  // Updates the visual appearance when selection changes
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

    this.#applySelectionTextStyles();
    this.#scrollToSelected();
  }

  // Forces the selected card's title text to be white using inline styles
  // This is necessary because XUL labels don't always respect CSS color
  #applySelectionTextStyles() {
    if (!this.tabsContainer) return;

    const cards = this.tabsContainer.querySelectorAll(".zen-tab-switcher-card");

    cards.forEach((card) => {
      const title = card.querySelector(".zen-tab-switcher-title");
      if (!title) return;

      if (card.classList.contains("zen-tab-switcher-selected")) {
        title.style.setProperty("color", "white", "important");
        title.style.setProperty("-moz-text-fill-color", "white", "important");
      } else {
        title.style.color = "";
        title.style.removeProperty("-moz-text-fill-color");
      }
    });
  }

  // Scrolls the tab container to show the selected card
  // Uses page-based scrolling (shows full pages of cards, never cuts off)
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

  // Calculates how many cards should be visible based on window width
  // Uses responsive breakpoints and user preference
  #getMaxVisibleCards() {
    const prefMax = Math.min(10, Math.max(1,
      Services.prefs.getIntPref("zen.tabs.tab-switcher.max-visible-cards", 5)
    ));

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

  // Calculates which card should be at the left edge for pagination
  // Ensures the page shows full cards without cutoff at the end
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

  // Moves selection to the next tab (wraps around at end)
  #navigateForward() {
    this.#currentIndex = (this.#currentIndex + 1) % this.#tabList.length;
    this.#updateSelection();
  }

  // Moves selection to the previous tab (wraps around at beginning)
  #navigateBackward() {
    this.#currentIndex = (this.#currentIndex - 1 + this.#tabList.length) % this.#tabList.length;
    this.#updateSelection();
  }

  // Called when the browser window is resized
  // Re-renders the switcher if it's open to adjust card count
  handleResize() {
    if (this.#isOpen) {
      this.#renderTabs();
      this.#updateSelection();
    }
  }
}

export var gZenTabSwitcher = new nsZenTabSwitcher();
