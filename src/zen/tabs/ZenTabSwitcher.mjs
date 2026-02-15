// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { nsZenDOMOperatedFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";

/**
 * Manages the Zen Tab Switcher - an Arc-style visual tab switcher
 * Activates on Ctrl+Tab and shows tab previews with thumbnails
 */
class nsZenTabSwitcher extends nsZenDOMOperatedFeature {
  #isOpen = false;
  #currentIndex = 0;
  #tabList = [];
  #thumbnailCache = new Map();
  #ctrlPressed = false;
  #lazyPrefs = {};
  #recentlyUsedTabs = []; // Track recently used tabs ourselves

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

  #initializeRecentlyUsedTabs() {
    // Initialize with current tab and existing tabs in order
    if (gBrowser.selectedTab) {
      this.#recentlyUsedTabs = [gBrowser.selectedTab];
    }
  }

  #setupShutdownObserver() {
    // Clear recently used tabs data on browser shutdown
    Services.obs.addObserver(this, "quit-application-granted", false);
  }

  #disableDefaultCtrlTab() {
    // Disable Firefox's default Ctrl+Tab panel when our feature is enabled
    const enabled = Services.prefs.getBoolPref("zen.tabs.tab-switcher.enabled", true);
    
    if (enabled) {
      // Uninit Firefox's ctrlTab if it exists
      if (window.ctrlTab && window.ctrlTab.uninit) {
        ctrlTab.uninit();
      }
    } else {
      // Re-enable Firefox's ctrlTab if disabled
      if (window.ctrlTab && window.ctrlTab.readPref) {
        ctrlTab.readPref();
      }
    }
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
    
    // Watch for preference changes to enable/disable ctrlTab
    Services.prefs.addObserver("zen.tabs.tab-switcher.enabled", this);
  }
  
  observe(subject, topic, data) {
    if (topic === "quit-application-granted") {
      // Clear recently used tabs data
      this.#recentlyUsedTabs = [];
    } else if (data === "zen.tabs.tab-switcher.enabled") {
      this.#disableDefaultCtrlTab();
    }
  }

  #setupKeyboardListeners() {
    window.addEventListener("keydown", this.#handleKeyDown.bind(this), true);
    window.addEventListener("keyup", this.#handleKeyUp.bind(this), true);
  }

  #createUI() {
    // UI will be created in XHTML and loaded via overlay
    this.container = document.getElementById("zen-tab-switcher-container");
    this.panel = document.getElementById("zen-tab-switcher-panel");
    this.tabsContainer = document.getElementById("zen-tab-switcher-tabs");
    
    if (!this.container) {
      console.error("ZenTabSwitcher: UI elements not found");
      return;
    }
    
    // Move container to document root to ensure position: fixed works relative to full viewport
    // This prevents the sidebar or other parent flex containers from affecting centering
    if (this.container.parentNode !== document.documentElement) {
      document.documentElement.appendChild(this.container);
    }
  }

  #observeTabChanges() {
    window.addEventListener("TabOpen", () => this.#invalidateThumbnailsCache());
    window.addEventListener("TabClose", () => {
      this.#invalidateThumbnailsCache();
      this.#cleanupRecentlyUsedTabs();
    });
    window.addEventListener("TabAttrModified", () => this.#invalidateThumbnailsCache());
    window.addEventListener("resize", () => this.handleResize());
    
    // Track tab selection for recently used order
    window.addEventListener("TabSelect", (event) => this.#onTabSelect(event));
  }

  #onTabSelect(event) {
    const tab = event.target;
    if (!tab || tab.closing || tab.hidden) return;
    
    // Remove tab if already in list
    const index = this.#recentlyUsedTabs.indexOf(tab);
    if (index !== -1) {
      this.#recentlyUsedTabs.splice(index, 1);
    }
    
    // Add tab to front of list (most recent)
    this.#recentlyUsedTabs.unshift(tab);
    
    // Keep list manageable (max 50 tabs)
    if (this.#recentlyUsedTabs.length > 50) {
      this.#recentlyUsedTabs.pop();
    }
  }

  #cleanupRecentlyUsedTabs() {
    // Remove closed tabs from the recently used list
    this.#recentlyUsedTabs = this.#recentlyUsedTabs.filter(tab => 
      tab && !tab.closing && gBrowser.tabs.includes(tab)
    );
  }

  #invalidateThumbnailsCache() {
    // Clear cache when tabs change
    this.#thumbnailCache.clear();
  }

  /**
   * Handle keydown events for Ctrl+Tab
   */
  #handleKeyDown(event) {
    if (!this.#lazyPrefs.enabled) return;

    if (event.key === "Escape" && this.#isOpen) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.#forceClose();
      return false;
    }

    // Check for Ctrl+Tab or Ctrl+Shift+Tab
    if (event.ctrlKey && event.key === "Tab") {
      console.log("ZenTabSwitcher: Ctrl+Tab detected, opening switcher");
      
      // Prevent all default behaviors
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      this.#ctrlPressed = true;

      if (!this.#isOpen) {
        this.open();
      } else {
        // Navigate forward (Tab) or backward (Shift+Tab)
        if (event.shiftKey) {
          this.#navigateBackward();
        } else {
          this.#navigateForward();
        }
      }
      
      return false;
    }
  }

  /**
   * Handle keyup events - close when Ctrl is released
   */
  #handleKeyUp(event) {
    if (!this.#isOpen) return;

    if (event.key === "Control") {
      this.#ctrlPressed = false;
      this.close();
    }
  }

  /**
   * Open the tab switcher
   */
  open() {
    if (this.#isOpen) return;

    this.#buildTabList();
    
    // Only show panel when there's more than 1 tab
    if (this.#tabList.length <= 1) return;

    this.#isOpen = true;
    
    // Determine starting index
    if (this.#lazyPrefs.useRecentOrder) {
      // Start at index 0 (most recent tab when using recent order)
      this.#currentIndex = 0;
    } else {
      // Find current tab in the list and start there
      const currentTabIndex = this.#tabList.indexOf(gBrowser.selectedTab);
      // Start at the current tab, not the next one
      this.#currentIndex = currentTabIndex >= 0 ? currentTabIndex : 0;
    }
    
    // Pre-cache thumbnails for all tabs
    this.#preCacheThumbnails();
    
    this.#renderTabs();
    
    // Show the UI immediately - selection is already applied during render
    this.container.hidden = false;
    this.container.classList.add("zen-tab-switcher-open");
    
    // Scroll to selected tab after showing
    setTimeout(() => this.#scrollToSelected(), 0);
  }

  /**
   * Close the tab switcher and switch to selected tab
   */
  close() {
    if (!this.#isOpen) return;

    const selectedTab = this.#tabList[this.#currentIndex];
    
    // Hide UI
    this.container.classList.remove("zen-tab-switcher-open");
    
    // Use animation end to hide, with fallback timeout
    let hasHidden = false;
    const hideContainer = () => {
      if (hasHidden) return;
      hasHidden = true;
      this.container.hidden = true;
      this.container.removeEventListener("animationend", hideContainer);
    };
    
    this.container.addEventListener("animationend", hideContainer, { once: true });
    
    // Fallback in case animation doesn't fire
    setTimeout(hideContainer, 200);
    
    // Switch to the selected tab
    if (selectedTab && selectedTab !== gBrowser.selectedTab) {
      gBrowser.selectedTab = selectedTab;
    }

    this.#isOpen = false;
    this.#currentIndex = 0;
    this.#tabList = [];
  }

  /**
   * Force close the switcher without switching tabs.
   */
  #forceClose() {
    if (!this.#isOpen) return;

    this.#ctrlPressed = false;
    this.container.classList.remove("zen-tab-switcher-open");
    this.container.hidden = true;

    this.#isOpen = false;
    this.#currentIndex = 0;
    this.#tabList = [];
  }

  /**
   * Pre-cache thumbnails for all tabs
   */
  #preCacheThumbnails() {
    // Cache thumbnails for all tabs asynchronously
    const tabsToCache = this.#tabList;
    
    for (const tab of tabsToCache) {
      if (tab.hasAttribute("pending")) continue;
      
      const tabId = tab.linkedPanel;
      if (this.#thumbnailCache.has(tabId)) continue;
      
      const browser = tab.linkedBrowser;
      if (!browser) continue;
      
      try {
        const canvas = document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
        canvas.width = 320;
        canvas.height = 180;
        
        const { PageThumbs } = ChromeUtils.importESModule(
          "resource://gre/modules/PageThumbs.sys.mjs"
        );
        
        PageThumbs.captureToCanvas(browser, canvas)
          .then(() => {
            const dataUrl = canvas.toDataURL("image/png");
            this.#thumbnailCache.set(tabId, dataUrl);
            // Re-render to show newly loaded thumbnail
            if (this.#isOpen) {
              this.#renderTabs();
            }
          })
          .catch(e => console.warn("Failed to pre-cache thumbnail:", e));
      } catch (e) {
        console.warn("Failed to pre-cache thumbnail:", e);
      }
    }
  }

  /**
   * Build the list of tabs to show based on preferences
   */
  #buildTabList() {
    const showUnloaded = this.#lazyPrefs.showUnloaded;
    const useRecentOrder = this.#lazyPrefs.useRecentOrder;

    let tabs = [];

    if (useRecentOrder) {
      // Use our tracked recently used order - this overrides all other preferences
      // Clean up the list first
      this.#cleanupRecentlyUsedTabs();
      
      tabs = [...this.#recentlyUsedTabs];
      
      // When using recent order, filter out closing/hidden/empty/unloaded tabs
      this.#tabList = tabs.filter(tab => {
        if (tab.closing || tab.hidden) return false;
        if (tab.hasAttribute("zen-empty-tab")) return false;
        // Always omit unloaded tabs in recent order mode
        if (tab.hasAttribute("pending")) return false;
        return true;
      });
      
      return;
    }

    // Use visual tab order
    tabs = [...gBrowser.tabs];

    // Filter based on preferences
    this.#tabList = tabs.filter(tab => {
      // Never show closing or hidden tabs
      if (tab.closing || tab.hidden) return false;
      
      // Skip zen-empty-tab
      if (tab.hasAttribute("zen-empty-tab")) return false;

      // Filter unloaded tabs if needed
      if (!showUnloaded && tab.hasAttribute("pending")) return false;

      return true;
    });
  }

  /**
   * Render tab cards in the UI
   * Shows up to 5 tabs at once with smooth horizontal scrolling
   */
  #renderTabs() {
    if (!this.tabsContainer) return;

    // Clear existing tabs
    this.tabsContainer.innerHTML = "";

    const totalTabs = this.#tabList.length;
    
    // Responsive max visible cards based on viewport width
    // 5 cards: >1300px, 4 cards: >1050px, 3 cards: >800px, 2 cards: >550px, 1 card: <=550px
    let maxVisible = 5;
    const viewportWidth = window.innerWidth;
    if (viewportWidth <= 550) {
      maxVisible = 1;
    } else if (viewportWidth <= 800) {
      maxVisible = 2;
    } else if (viewportWidth <= 1050) {
      maxVisible = 3;
    } else if (viewportWidth <= 1300) {
      maxVisible = 4;
    }
    
    // Set fixed width to show cards based on viewport size (or fewer if we have fewer tabs)
    // This creates the viewport that shows the appropriate number of cards
    const visibleCount = Math.min(totalTabs, maxVisible);
    const cardWidth = 200; // var(--zen-tab-switcher-card-width)
    const gap = 0; // var(--zen-tab-switcher-gap)
    
    // Calculate container width: 5 cards + 4 gaps (or fewer if less tabs)
    const containerWidth = (cardWidth * visibleCount) + (gap * (visibleCount - 1));
    this.tabsContainer.style.width = `${containerWidth}px`;
    this.tabsContainer.style.maxWidth = `${containerWidth}px`;

    // Render all tabs (not just visible ones) to enable smooth scrolling
    this.#tabList.forEach((tab, index) => {
      const tabCard = this.#createTabCard(tab, index);
      // Apply selection class immediately if this is the current index
      if (index === this.#currentIndex) {
        tabCard.classList.add("zen-tab-switcher-selected");
      }
      this.tabsContainer.appendChild(tabCard);
    });

    this.#applySelectionTextStyles();
  }



  /**
   * Create a tab card element
   */
  #createTabCard(tab, index) {
    const card = document.createXULElement("vbox");
    card.className = "zen-tab-switcher-card";
    card.setAttribute("data-index", index);

    // Create thumbnail container
    const thumbnailContainer = document.createXULElement("box");
    thumbnailContainer.className = "zen-tab-switcher-thumbnail";

    // Mark card if no thumbnail or pending
    const isPending = tab.hasAttribute("pending");
    const thumbnail = isPending ? null : this.#getTabThumbnail(tab);
    
    if (thumbnail) {
      const img = document.createXULElement("image");
      img.setAttribute("src", thumbnail);
      thumbnailContainer.appendChild(img);
    } else {
      // For unloaded tabs or failed thumbnail capture:
      // Show blank grey box (no child element needed, CSS handles it)
      card.classList.add("zen-tab-switcher-no-thumbnail");
    }

    card.appendChild(thumbnailContainer);

    // Create info container
    const infoContainer = document.createXULElement("hbox");
    infoContainer.className = "zen-tab-switcher-info";

    // Favicon
    const favicon = document.createXULElement("image");
    favicon.className = "zen-tab-switcher-favicon";

    const defaultFavicon = PlacesUtils.favicons.defaultFavicon.spec;
    const iconSrc = gBrowser.getIcon(tab) || defaultFavicon;
    favicon.setAttribute("src", iconSrc);

    if (
      iconSrc === defaultFavicon ||
      iconSrc === "chrome://global/skin/icons/settings.svg" ||
      iconSrc === "chrome://browser/skin/zen-icons/settings.svg"
    ) {
      favicon.classList.add("zen-tab-switcher-favicon-zen");
    }

    infoContainer.appendChild(favicon);

    // Title
    const title = document.createXULElement("label");
    title.className = "zen-tab-switcher-title";
    title.setAttribute("value", tab.label || "");
    title.setAttribute("crop", "end");
    infoContainer.appendChild(title);

    card.appendChild(infoContainer);

    // Add pending indicator if unloaded
    if (tab.hasAttribute("pending")) {
      card.classList.add("zen-tab-switcher-pending");
    }

    // Add click handler for Ctrl+Click navigation
    card.addEventListener("click", (event) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        event.stopPropagation();
        
        // Set the current index to this card's index
        this.#currentIndex = index;
        
        // Close and switch to the selected tab
        this.close();
      }
    });

    return card;
  }

  /**
   * Get thumbnail for a tab (from cache only)
   */
  #getTabThumbnail(tab) {
    const tabId = tab.linkedPanel;
    
    // Skip if tab is pending/unloaded
    if (tab.hasAttribute("pending")) {
      return null;
    }
    
    // Return cached thumbnail if available
    return this.#thumbnailCache.get(tabId) || null;
  }

  /**
   * Update visual selection
   */
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
    
    // Scroll to show selected tab
    this.#scrollToSelected();
  }

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
  
  /**
   * Scroll container to show the selected tab with page-based snapping
   * Ensures full cards are visible without cutoff
   */
  #scrollToSelected() {
    if (!this.tabsContainer) return;
    
    const selectedCard = this.tabsContainer.querySelector(".zen-tab-switcher-selected");
    if (!selectedCard) return;
    
    const cardWidth = 200; // var(--zen-tab-switcher-card-width)
    const gap = 0; // var(--zen-tab-switcher-gap)
    const cardIndex = parseInt(selectedCard.getAttribute("data-index"), 10);
    const totalTabs = this.#tabList.length;
    
    // Calculate max visible cards based on viewport width (same logic as #renderTabs)
    let maxVisible = 5;
    const viewportWidth = window.innerWidth;
    if (viewportWidth <= 550) {
      maxVisible = 1;
    } else if (viewportWidth <= 800) {
      maxVisible = 2;
    } else if (viewportWidth <= 1050) {
      maxVisible = 3;
    } else if (viewportWidth <= 1300) {
      maxVisible = 4;
    }
    
    // Calculate which page the selected card is on
    const currentPage = Math.floor(cardIndex / maxVisible);
    
    // Calculate the starting index for this page
    let pageStartIndex = currentPage * maxVisible;
    
    // If we're near the end and don't have enough cards for a full page,
    // adjust to show the last full page
    const remainingCards = totalTabs - pageStartIndex;
    if (remainingCards < maxVisible && totalTabs > maxVisible) {
      pageStartIndex = Math.max(0, totalTabs - maxVisible);
    }
    
    // Calculate scroll position to show the page starting at pageStartIndex
    const scrollPosition = pageStartIndex * (cardWidth + gap);
    
    // Smooth scroll to position
    this.tabsContainer.scrollTo({
      left: scrollPosition,
      behavior: "smooth"
    });
  }

  /**
   * Navigate to next tab
   */
  #navigateForward() {
    this.#currentIndex = (this.#currentIndex + 1) % this.#tabList.length;
    this.#updateSelection();
  }

  /**
   * Navigate to previous tab
   */
  #navigateBackward() {
    this.#currentIndex = (this.#currentIndex - 1 + this.#tabList.length) % this.#tabList.length;
    this.#updateSelection();
  }

  /**
   * Handle window resize
   */
  handleResize() {
    if (this.#isOpen) {
      // Re-render to update max-width based on new window size
      this.#renderTabs();
      this.#updateSelection();
    }
  }
}

// Create singleton instance
export var gZenTabSwitcher = new nsZenTabSwitcher();
