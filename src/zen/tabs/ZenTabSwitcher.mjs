/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { nsZenDOMOperatedFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";

class nsZenTabSwitcher extends nsZenDOMOperatedFeature {
  
  #isOpen = false;                    // Boolean: Is the switcher panel currently visible?
  #currentIndex = 0;                  // Number: Which tab card is currently selected (0-based index)
  #tabList = [];                      // Array: List of all tabs to show in the switcher
  #thumbnailCache = new Map();        // Map: Stores tab screenshots using tabId as key
  #ctrlPressed = false;               // Boolean: Is the Ctrl key currently held down?
  #lazyPrefs = {};                    // Object: Stores user preferences loaded lazily
  #recentlyUsedTabs = [];             // Array: Tracks tabs in most-recently-used order
  #actualVisibleCards = 5;            // Number: How many cards fit on screen (updates dynamically)

  // ==========================================================================
  // INITIALIZATION METHOD
  // This runs when the feature first loads in the browser
  // ==========================================================================
  init() {
    console.log("ZenTabSwitcher: Initializing...");
    
    // Call setup methods in order:
    this.#setupPreferences();          // Load user settings from Firefox preferences
    this.#disableDefaultCtrlTab();     // Turn off Firefox's built-in Ctrl+Tab handler
    this.#setupKeyboardListeners();    // Listen for Ctrl+Tab key presses
    this.#createUI();                  // Get references to UI elements in the DOM
    this.#observeTabChanges();         // Watch for tab open/close/move events
    this.#setupShutdownObserver();     // Clean up when browser closes
    this.#initializeRecentlyUsedTabs(); // Start tracking which tabs are used
    
    console.log("ZenTabSwitcher: Initialization complete");
  }

  // ==========================================================================
  // METHOD: #initializeRecentlyUsedTabs
  // Sets up the list that tracks which tabs have been used recently
  // ==========================================================================
  #initializeRecentlyUsedTabs() {
    // gBrowser.selectedTab is the currently active tab
    if (gBrowser.selectedTab) {
      // Start the list with just the current tab
      this.#recentlyUsedTabs = [gBrowser.selectedTab];
    }
  }

  // ==========================================================================
  // METHOD: #setupShutdownObserver
  // Registers a listener for when the browser is closing
  // ==========================================================================
  #setupShutdownObserver() {
    // Services.obs is Firefox's observer service for system events
    // Parameters: (observer object, event name, should use weak reference)
    Services.obs.addObserver(this, "quit-application-granted", false);
  }

  // ==========================================================================
  // METHOD: #disableDefaultCtrlTab
  // Turns off Firefox's default Ctrl+Tab switcher so ours can work
  // ==========================================================================
  #disableDefaultCtrlTab() {
    // Check if our feature is enabled in user preferences
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
    // XPCOMUtils is a Firefox utility for cross-platform component access
    // defineLazyPreferenceGetter loads a preference only when first accessed (lazy loading)
    
    // PREFERENCE: zen.tabs.tab-switcher.enabled
    // Type: Boolean, Default: true
    // Controls if this feature is active at all
    XPCOMUtils.defineLazyPreferenceGetter(
      this.#lazyPrefs,                         // Object to store the preference in
      "enabled",                               // Property name to access it
      "zen.tabs.tab-switcher.enabled",         // Preference key in about:config
      true                                     // Default value if not set
    );
    
    // PREFERENCE: zen.tabs.tab-switcher.show-unloaded
    // Type: Boolean, Default: false
    // Controls if unloaded/suspended tabs should appear in the switcher
    XPCOMUtils.defineLazyPreferenceGetter(
      this.#lazyPrefs,
      "showUnloaded",
      "zen.tabs.tab-switcher.show-unloaded",
      false
    );
    
    // PREFERENCE: zen.tabs.tab-switcher.use-recent-order
    // Type: Boolean, Default: false
    // Controls if tabs are sorted by recently-used order instead of visual position
    XPCOMUtils.defineLazyPreferenceGetter(
      this.#lazyPrefs,
      "useRecentOrder",
      "zen.tabs.tab-switcher.use-recent-order",
      false
    );
    
    // Watch for changes to the enabled preference
    // If user enables/disables the feature, we need to turn off/on Firefox's default
    Services.prefs.addObserver("zen.tabs.tab-switcher.enabled", this);
  }
  
  // ==========================================================================
  // METHOD: observe
  // Called when system events occur (browser shutdown or preference changes)
  // This is part of Firefox's observer pattern
  // ==========================================================================
  observe(subject, topic, data) {
    if (topic === "quit-application-granted") {
      // Browser is closing - clear our recently used tabs list
      this.#recentlyUsedTabs = [];
    } else if (data === "zen.tabs.tab-switcher.enabled") {
      // The enabled preference changed - update Firefox's default handler
      this.#disableDefaultCtrlTab();
    }
  }

  // ==========================================================================
  // METHOD: #setupKeyboardListeners
  // Registers event listeners for keyboard input
  // ==========================================================================
  #setupKeyboardListeners() {
    // .bind(this): Ensures "this" refers to the class instance inside the handler
    // true (capture phase): Process event before it reaches other elements
    
    window.addEventListener("keydown", this.#handleKeyDown.bind(this), true);
    window.addEventListener("keyup", this.#handleKeyUp.bind(this), true);
  }

  // ==========================================================================
  // METHOD: #createUI
  // Gets references to HTML/XUL elements that make up the switcher interface
  // ==========================================================================
  #createUI() {
    // These elements are defined in an XHTML file and loaded into the DOM
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
    // When tabs are opened/closed/modified, we need to refresh our cache
    window.addEventListener("TabOpen", () => this.#invalidateThumbnailsCache());
    window.addEventListener("TabClose", () => {
      this.#invalidateThumbnailsCache();
      this.#cleanupRecentlyUsedTabs();   // Remove closed tabs from recent list
    });
    window.addEventListener("TabAttrModified", () => this.#invalidateThumbnailsCache());
    window.addEventListener("TabMove", () => this.#invalidateThumbnailsCache());
    
    // When window resizes, we need to recalculate how many cards fit
    window.addEventListener("resize", () => this.handleResize());
    
    // Track which tab is currently selected for recently-used ordering
    window.addEventListener("TabSelect", (event) => this.#onTabSelect(event));
  }

  // ==========================================================================
  // METHOD: #onTabSelect
  // Called whenever a tab becomes active (user clicks on it or switches to it)
  // Updates the recently-used order list
  // ==========================================================================
  #onTabSelect(event) {
    const tab = event.target;  // The tab that was selected
    
    // Ignore invalid tabs (closing, hidden, or doesn't exist)
    if (!tab || tab.closing || tab.hidden) return;
    
    // Remove this tab from its current position in the list
    const index = this.#recentlyUsedTabs.indexOf(tab);
    if (index !== -1) {
      this.#recentlyUsedTabs.splice(index, 1);  // splice removes 1 element at index
    }
    
    // Add tab to the front of the list (position 0 = most recently used)
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
    // Filter returns a new array with only tabs that pass the test
    this.#recentlyUsedTabs = this.#recentlyUsedTabs.filter(tab => 
      tab &&                           // Tab exists
      !tab.closing &&                  // Tab is not in the process of closing
      gBrowser.tabs.includes(tab)      // Tab still exists in the browser
    );
  }

  // ==========================================================================
  // METHOD: #invalidateThumbnailsCache
  // Clears all cached tab screenshots so they'll be regenerated
  // ==========================================================================
  #invalidateThumbnailsCache() {
    // Map.clear() removes all entries from the Map
    this.#thumbnailCache.clear();
  }

  // ==========================================================================
  // METHOD: #handleKeyDown
  // Processes keyboard input when keys are pressed down
  // ==========================================================================
  #handleKeyDown(event) {
    // If feature is disabled, do nothing
    if (!this.#lazyPrefs.enabled) return;

    // ESCAPE KEY: Force-close the switcher without switching tabs
    if (event.key === "Escape" && this.#isOpen) {
      event.preventDefault();                 // Stop default browser behavior
      event.stopPropagation();                // Stop event from bubbling up
      event.stopImmediatePropagation();       // Stop all other handlers
      this.#forceClose();
      return false;  // Return false to cancel event completely
    }

    // CTRL+TAB: Open switcher or navigate within it
    if (event.ctrlKey && event.key === "Tab") {
      console.log("ZenTabSwitcher: Ctrl+Tab detected, opening switcher");
      
      // Prevent all default behaviors (Firefox's default Ctrl+Tab, etc.)
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      this.#ctrlPressed = true;  // Track that Ctrl is held down

      if (!this.#isOpen) {
        // Switcher is closed - open it
        this.open();
      } else {
        // Switcher is already open - navigate between tabs
        if (event.shiftKey) {
          // Ctrl+Shift+Tab = go backward
          this.#navigateBackward();
        } else {
          // Ctrl+Tab = go forward
          this.#navigateForward();
        }
      }
      
      return false;  // Cancel event
    }
  }

  // ==========================================================================
  // METHOD: #handleKeyUp
  // Processes keyboard input when keys are released
  // ==========================================================================
  #handleKeyUp(event) {
    // Only care about key releases if switcher is open
    if (!this.#isOpen) return;

    // When Ctrl key is released, close switcher and switch to selected tab
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
    // Prevent opening if already open
    if (this.#isOpen) return;

    // Build the list of tabs to show (based on user preferences)
    this.#buildTabList();
    
    // Don't show panel if there's only 0 or 1 tab (nothing to switch to)
    if (this.#tabList.length <= 1) return;

    this.#isOpen = true;  // Mark switcher as open
    
    // Determine which tab should be initially selected
    if (this.#lazyPrefs.useRecentOrder) {
      // In recent order mode, start at index 0 (the most recently used tab)
      this.#currentIndex = 0;
    } else {
      // In visual order mode, start at the currently active tab
      const currentTabIndex = this.#tabList.indexOf(gBrowser.selectedTab);
      this.#currentIndex = currentTabIndex >= 0 ? currentTabIndex : 0;
    }
    
    // Pre-cache thumbnails for tabs that will be visible immediately
    // "await" pauses execution until thumbnails are captured
    await this.#preCacheThumbnailsForVisible();

    // Create the tab cards in the DOM
    this.#renderTabs();
    
    // Show the UI with animation
    this.container.hidden = false; 
    this.container.classList.add("zen-tab-switcher-open");
    
    // Scroll to show the selected tab after a brief delay
    // setTimeout delays execution by 0ms (next event loop cycle)
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

    // Get the tab that's currently selected in the switcher
    const selectedTab = this.#tabList[this.#currentIndex];
    
    // Trigger CSS closing animation
    this.container.classList.remove("zen-tab-switcher-open");
    
    // Hide container after animation completes
    let hasHidden = false;  // Prevent hiding twice
    const hideContainer = () => {
      if (hasHidden) return;
      hasHidden = true;
      this.container.hidden = true;
      this.container.removeEventListener("animationend", hideContainer);
    };
    
    // Listen for animation end
    this.container.addEventListener("animationend", hideContainer, { once: true });
    
    // Fallback: Hide after 200ms even if animation doesn't fire
    setTimeout(hideContainer, 200);
    
    // Switch to the selected tab (if it's different from current)
    if (selectedTab && selectedTab !== gBrowser.selectedTab) {
      gBrowser.selectedTab = selectedTab;
    }

    // Reset state
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
    this.container.hidden = true;  // Hide immediately with no animation

    // Reset state
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
    
    // Loop through all tabs and capture thumbnails asynchronously
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

    // Capture all thumbnails in parallel
    const tasks = tabsToCache.map((tab) => this.#captureThumbnail(tab));
    // Promise.all waits for all thumbnails to complete
    await Promise.all(tasks);
  }

  // ==========================================================================
  // METHOD: #captureThumbnail
  // Captures a screenshot of a single tab's content
  // ==========================================================================
  async #captureThumbnail(tab) {
    // Don't capture screenshots of unloaded tabs
    if (tab.hasAttribute("pending")) return;

    // Use tab's panel ID as cache key
    const tabId = tab.linkedPanel;
    
    // Skip if we already have a cached thumbnail
    if (this.#thumbnailCache.has(tabId)) return;

    // Get the browser element that contains the web page
    const browser = tab.linkedBrowser;
    if (!browser) return;

    try {
      // Create a canvas element to draw the screenshot onto
      const canvas = document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
      canvas.width = 320;   // Thumbnail width in pixels
      canvas.height = 180;  // Thumbnail height in pixels (16:9 aspect ratio)

      // Import Firefox's PageThumbs module
      const { PageThumbs } = ChromeUtils.importESModule(
        "resource://gre/modules/PageThumbs.sys.mjs"
      );

      // Capture the tab's content to the canvas (this is async)
      await PageThumbs.captureToCanvas(browser, canvas);
      
      // Convert canvas to a data URL (base64-encoded PNG image)
      const dataUrl = canvas.toDataURL("image/png");
      
      // Store in cache
      this.#thumbnailCache.set(tabId, dataUrl);

      // If switcher is still open, re-render to show the new thumbnail
      if (this.#isOpen) {
        this.#renderTabs();
      }
    } catch (e) {
      // Screenshot capture failed (page not loaded, permission denied, etc.)
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

    // MODE 1: Recently used order
    if (useRecentOrder) {
      // Clean up the recently used list first
      this.#cleanupRecentlyUsedTabs();
      
      // Use our tracked order
      tabs = [...this.#recentlyUsedTabs];  // [...array] creates a copy
      
      // Filter out invalid tabs
      this.#tabList = tabs.filter(tab => {
        if (tab.closing || tab.hidden) return false;  // Skip closing/hidden tabs
        if (tab.hasAttribute("zen-empty-tab")) return false;  // Skip Zen's empty tabs
        if (tab.hasAttribute("pending")) return false;  // Always skip unloaded tabs in recent mode
        return true;  // Keep this tab
      });
      
      return;
    }

    // MODE 2: Visual tab order (default)
    tabs = [...gBrowser.tabs];  // Get all tabs in order they appear in tab bar

    // Filter based on preferences
    this.#tabList = tabs.filter(tab => {
      // Never show closing or hidden tabs
      if (tab.closing || tab.hidden) return false;
      
      // Skip Zen's special empty tab placeholder
      if (tab.hasAttribute("zen-empty-tab")) return false;

      // Filter unloaded tabs based on user preference
      if (!showUnloaded && tab.hasAttribute("pending")) return false;

      return true;  // Keep this tab
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

    // Clear any existing tab cards
    this.tabsContainer.innerHTML = "";

    const totalTabs = this.#tabList.length;
    
    // DIMENSIONS: Card and gap sizes (should match CSS variables)
    const cardWidth = 200;      // Each card is 200px wide
    const gap = 0;              // No gap between cards
    const panelPadding = 23 * 2; // 23px padding on left + 23 px on right
    
    // RESPONSIVE CALCULATION: How many cards fit on screen?
    
    // Calculate maximum space available (90% of window width minus padding)
    const maxAvailableWidth = window.innerWidth * 0.9 - panelPadding;
    
    // Calculate how many full cards can fit without being cut off
    // Math.floor rounds down to ensure only complete cards are shown
    const maxCardsThatFit = Math.floor((maxAvailableWidth + gap) / (cardWidth + gap));
    
    // Get max cards based on breakpoints and user preference
    const maxVisibleFromBreakpoints = this.#getMaxVisibleCards();
    
    // Use the smallest of: cards that fit, breakpoint max, total tabs
    const visibleCount = Math.min(totalTabs, maxVisibleFromBreakpoints, maxCardsThatFit);
    
    // Calculate exact width for the container
    const containerWidth = (cardWidth * visibleCount) + (gap * (visibleCount - 1));
    
    // Store for pagination logic (so scrolling knows how many cards are visible)
    this.#actualVisibleCards = visibleCount;
    
    // Set container dimensions
    this.tabsContainer.style.width = `${containerWidth}px`;
    this.tabsContainer.style.maxWidth = `${containerWidth}px`;

    // Render all tabs (not just visible ones) for smooth scrolling
    this.#tabList.forEach((tab, index) => {
      const tabCard = this.#createTabCard(tab, index);
      
      // Mark the currently selected card
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
    // Create main card container (XUL vbox = vertical box)
    const card = document.createXULElement("vbox");
    card.className = "zen-tab-switcher-card";
    card.setAttribute("data-index", index);  // Store index for later reference

    // === THUMBNAIL SECTION ===
    const thumbnailContainer = document.createXULElement("box");
    thumbnailContainer.className = "zen-tab-switcher-thumbnail";

    const isPending = tab.hasAttribute("pending");
    const thumbnail = isPending ? null : this.#getTabThumbnail(tab);
    
    if (thumbnail) {
      const img = document.createXULElement("image");
      img.setAttribute("src", thumbnail);  // Set image source to data URL
      thumbnailContainer.appendChild(img);
    } else {
      card.classList.add("zen-tab-switcher-no-thumbnail");
    }

    card.appendChild(thumbnailContainer);

    // === INFO SECTION (Favicon + Title) ===
    const infoContainer = document.createXULElement("hbox");  // hbox = horizontal box
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
    title.setAttribute("value", tab.label || "");  // tab.label is the page title
    title.setAttribute("crop", "end");  // Truncate long titles with "..."
    infoContainer.appendChild(title);

    card.appendChild(infoContainer);

    // Add visual indicator if tab is unloaded
    if (tab.hasAttribute("pending")) {
      card.classList.add("zen-tab-switcher-pending");
    }

    // === CLICK HANDLER ===
    // Ctrl+Click on a card to immediately switch to that tab
    card.addEventListener("click", (event) => {
      if (event.ctrlKey || event.metaKey) {  // metaKey = Cmd on Mac
        event.preventDefault();
        event.stopPropagation();
        
        // Update selection to this card
        this.#currentIndex = index;
        
        // Close and switch
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
    
    // Don't return thumbnails for unloaded tabs
    if (tab.hasAttribute("pending")) {
      return null;
    }
    
    // Return cached thumbnail or null
    return this.#thumbnailCache.get(tabId) || null;
  }

  // ==========================================================================
  // METHOD: #updateSelection
  // Updates the visual appearance when selection changes
  // ==========================================================================
  #updateSelection() {
    if (!this.tabsContainer) return;

    // Get all card elements
    const cards = this.tabsContainer.querySelectorAll(".zen-tab-switcher-card");
    
    // Update each card's selection state
    cards.forEach((card) => {
      const cardIndex = parseInt(card.getAttribute("data-index"), 10);
      
      if (cardIndex === this.#currentIndex) {
        // This is the selected card
        card.classList.add("zen-tab-switcher-selected");
      } else {
        // Not selected
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
        // Not selected: Remove inline styles (use CSS defaults)
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
    
    const cardWidth = 200;  // Width of each card
    const gap = 0;          // Gap between cards
    
    // Get the selected card's index
    const cardIndex = parseInt(selectedCard.getAttribute("data-index"), 10);
    
    // Calculate which page this card is on
    const { pageStartIndex } = this.#getPageStartIndex(cardIndex);
    
    // Calculate scroll position to show that page
    const scrollPosition = pageStartIndex * (cardWidth + gap);
    
    // Smooth scroll to position
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
    // Get user's maximum preferred cards (default 5, max 10)
    const prefMax = Math.min(10, Math.max(1, 
      Services.prefs.getIntPref("zen.tabs.tab-switcher.max-visible-cards", 5)
    ));
    
    // Responsive breakpoints based on window width
    let maxVisible = prefMax;  // Start with user preference
    const viewportWidth = window.innerWidth;
    
    // Adjust based on breakpoints (smaller screens show fewer cards)
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
    
    // Use the actual visible cards from the last render
    // (This ensures pagination matches the current window size)
    const maxVisible = this.#actualVisibleCards;

    // Calculate which page the card is on
    // Math.floor rounds down (e.g., cards 0-4 are page 0, cards 5-9 are page 1)
    const currentPage = Math.floor(cardIndex / maxVisible);
    
    // Calculate starting index for that page
    let pageStartIndex = currentPage * maxVisible;

    // Special case: Last page might not be full
    // If showing the calculated page would cut off cards, adjust to show the last full page
    const remainingCards = totalTabs - pageStartIndex;
    if (remainingCards < maxVisible && totalTabs > maxVisible) {
      // Move back to show exactly maxVisible cards at the end
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
