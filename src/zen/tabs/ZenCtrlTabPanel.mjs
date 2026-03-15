/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { nsZenDOMOperatedFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  PageThumbs: "resource://gre/modules/PageThumbs.sys.mjs",
});

class nsZenCtrlTabPanel extends nsZenDOMOperatedFeature {
  static CARD_WIDTH = 200;
  static MAX_VISIBLE_CARDS = 5;
  static PANEL_HORIZONTAL_PADDING = 30;
  static PANEL_HEIGHT = 210;
  static THUMBNAIL_CANVAS_HEIGHT = 200;

  #isOpen = false;
  #currentIndex = 0;
  #tabList = [];
  #thumbnailCache = new Map();
  #lazyPrefs = {};
  #actualVisibleCards = nsZenCtrlTabPanel.MAX_VISIBLE_CARDS;
  #firstPress = true;

  init() {
    this.#setupPreferences();
    this.#disableDefaultCtrlTab();
    this.#setupKeyboardListeners();
    this.#setupLazyGetters();
    this.#observeTabChanges();
  }

  #setupLazyGetters() {
    ChromeUtils.defineLazyGetter(this, "panel", () =>
      document.getElementById("zen-ctrl-tab-panel")
    );
    ChromeUtils.defineLazyGetter(this, "tabsContainer", () =>
      document.getElementById("zen-ctrl-tab-panel-tabs")
    );
  }

  #disableDefaultCtrlTab() {
    const enabled = Services.prefs.getBoolPref("zen.tabs.ctrl-tab-panel.enabled", true);
    const method = enabled ? "uninit" : "readPref";
    window.ctrlTab?.[method]?.();
  }

  #setupPreferences() {
    XPCOMUtils.defineLazyPreferenceGetter(
      this.#lazyPrefs,
      "enabled",
      "zen.tabs.ctrl-tab-panel.enabled",
      true
    );

    try {
      Services.prefs.removeObserver("zen.tabs.ctrl-tab-panel.enabled", this);
    } catch (e) {
    }
    
    Services.prefs.addObserver("zen.tabs.ctrl-tab-panel.enabled", this);
  }

  observe(subject, topic, data) {
    if (data === "zen.tabs.ctrl-tab-panel.enabled") {
      this.#disableDefaultCtrlTab();
    }
  }

  #setupKeyboardListeners() {
    window.addEventListener("keydown", (e) => this.#handleKeyDown(e), true);
    window.addEventListener("keyup", (e) => this.#handleKeyUp(e), true);
    window.addEventListener("blur", () => this.#isOpen && this.close(false));
    window.addEventListener("click", (e) => this.#handleClick(e), true);
  }

  #handleClick(event) {
    if (!this.#isOpen) {
      return;
    }

    if (!this.panel.contains(event.target)) {
      event.preventDefault();
      event.stopPropagation();
      this.close(false);
    }
  }

  #observeTabChanges() {
    window.addEventListener("TabOpen", () => this.#thumbnailCache.clear());
    window.addEventListener("TabClose", () => this.#thumbnailCache.clear());
    window.addEventListener("TabAttrModified", () => {
      this.#thumbnailCache.clear();
    });
    window.addEventListener("TabMove", () => this.#thumbnailCache.clear());
  }

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

  #handleKeyUp(event) {
    if (this.#isOpen && event.key === "Control") {
      this.close(document.hasFocus());
    }
  }

  /**
   * Initializes tab switcher panel. 
   * Captures visible tab thumbnails before showing panel, then captures remaining thumbnails in background.
   *
   * @param {boolean} shiftKey 
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

    this.#actualVisibleCards = Math.min(this.#tabList.length, nsZenCtrlTabPanel.MAX_VISIBLE_CARDS);

    await this.#cacheThumbnailsForVisible();

    this.#createTabCards();

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    const containerWidth = nsZenCtrlTabPanel.CARD_WIDTH * this.#actualVisibleCards;
    // Ensure the panel doesn't get cut off by screen edge (always shows full panel on screen)
    const panelWidth = Math.min(containerWidth + nsZenCtrlTabPanel.PANEL_HORIZONTAL_PADDING, windowWidth);

    const centerX = (windowWidth - panelWidth) / 2;
    const centerY = (windowHeight - nsZenCtrlTabPanel.PANEL_HEIGHT) / 2;

    PanelMultiView.openPopup(this.panel, document.documentElement, {
      position: "overlap",
      triggerEvent: null,
      x: centerX,
      y: centerY,
    });

    this.panel.addEventListener("popuphiding", () => {
      if (this.#isOpen) {
        this.close(false);
      }
    }, { once: true });

    setTimeout(() => this.#scrollToSelected(), 0);

    this.#tabList.forEach((tab) => this.#captureThumbnail(tab));
  }

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

  #resetState() {
    this.#isOpen = false;
    this.#currentIndex = 0;
    this.#tabList = [];
    this.#firstPress = true;
    this.panel.hidePopup();
  }

  /**
   * Captures screenshots only for tabs that are currently visible on screen.
   *
   * @returns {Promise<void>} Resolves when all visible thumbnails are captured.
   */
  async #cacheThumbnailsForVisible() {
    const pageStartIndex = this.#getPageStartIndex(this.#currentIndex);
    const endIndex = Math.min(this.#tabList.length, pageStartIndex + this.#actualVisibleCards);
    const tabsToCache = this.#tabList.slice(pageStartIndex, endIndex);
    await Promise.all(tabsToCache.map((tab) => this.#captureThumbnail(tab)));
  }

  /**
   * Captures a screenshot of the given tab and stores it in the thumbnail cache.
   * If the panel is open, updates the card thumbnail in the DOM.
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
      // Calculate canvas dimensions based on window aspect ratio
      const viewportAspect = window.innerWidth / window.innerHeight;
      const targetHeight = nsZenCtrlTabPanel.THUMBNAIL_CANVAS_HEIGHT;
      const targetWidth = Math.round(targetHeight * viewportAspect);
      
      const canvas = document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      await lazy.PageThumbs.captureToCanvas(browser, canvas, {
        fullViewport: true,
      });
      const dataUrl = canvas.toDataURL("image/png");
      this.#thumbnailCache.set(tabId, dataUrl);

      if (this.#isOpen) {
        const card = this.tabsContainer?.querySelector(`[data-tab-id="${tabId}"]`);
        const thumbnailContainer = card?.querySelector(".zen-ctrl-tab-panel-thumbnail");
        
        if (thumbnailContainer) {
          thumbnailContainer.innerHTML = "";
          card.classList.remove("zen-ctrl-tab-panel-no-thumbnail");

          const img = document.createXULElement("image");
          img.setAttribute("src", dataUrl);
          thumbnailContainer.appendChild(img);
        }
      }
    } catch (e) {
      console.warn("ZenCtrlTabPanel: Failed to cache thumbnail:", e);
    }
  }

  /**
   * Creates the list of tabs to show in the switcher.
   *
   * @returns {void}
   */
  #buildTabList() {
    this.#tabList = [...gBrowser.tabs].filter((tab) => {
      return !tab.closing && !tab.hidden && !tab.hasAttribute("zen-empty-tab");
    });
  }

  /**
   * Creates the visual tab cards and adds them to the DOM.
   * Clears existing cards and renders new ones based on the current tab list.
   *
   * @returns {void}
   */
  #createTabCards() {
    if (!this.tabsContainer) {
      return;
    }

    this.tabsContainer.innerHTML = "";
    const containerWidth = `${nsZenCtrlTabPanel.CARD_WIDTH * this.#actualVisibleCards}px`;
    this.tabsContainer.style.width = containerWidth;

    this.#tabList.forEach((tab, index) => {
      const card = document.createXULElement("vbox");
      card.className = "zen-ctrl-tab-panel-card";
      card.setAttribute("data-index", index);
      card.setAttribute("data-tab-id", tab.linkedPanel);

      const thumbnailContainer = document.createXULElement("box");
      thumbnailContainer.className = "zen-ctrl-tab-panel-thumbnail";

      const thumbnail = tab.hasAttribute("pending") ? null : this.#thumbnailCache.get(tab.linkedPanel);

      if (thumbnail) {
        const img = document.createXULElement("image");
        img.setAttribute("src", thumbnail);
        thumbnailContainer.appendChild(img);
      } else {
        card.classList.add("zen-ctrl-tab-panel-no-thumbnail");
      }

      card.appendChild(thumbnailContainer);

      const infoContainer = document.createXULElement("hbox");
      infoContainer.className = "zen-ctrl-tab-panel-info";

      const favicon = document.createXULElement("image");
      favicon.className = "zen-ctrl-tab-panel-favicon";

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
        favicon.classList.add("zen-ctrl-tab-panel-favicon-zen");
      }

      infoContainer.appendChild(favicon);
      const title = document.createXULElement("label");
      title.className = "zen-ctrl-tab-panel-title";
      title.setAttribute("value", tab.label || "");
      title.setAttribute("crop", "end");
      infoContainer.appendChild(title);
      card.appendChild(infoContainer);

      if (tab.hasAttribute("pending")) {
        card.classList.add("zen-ctrl-tab-panel-pending");
      }

      if (index === this.#currentIndex) {
        card.classList.add("zen-ctrl-tab-panel-selected");
      }

      card.addEventListener("click", (event) => {
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          event.stopPropagation();
          this.#currentIndex = index;
          this.close();
        }
      });

      this.tabsContainer.appendChild(card);
    });
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

    this.tabsContainer.querySelectorAll(".zen-ctrl-tab-panel-card").forEach((card) => {
      const cardIndex = parseInt(card.getAttribute("data-index"), 10);
      const isSelected = cardIndex === this.#currentIndex;
      card.classList.toggle("zen-ctrl-tab-panel-selected", isSelected);
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
    const selectedCard = this.tabsContainer.querySelector(".zen-ctrl-tab-panel-selected");
    if (!selectedCard) {
      return;
    }

    const cardIndex = parseInt(selectedCard.getAttribute("data-index"), 10);
    const pageStartIndex = this.#getPageStartIndex(cardIndex);
    const scrollPosition = pageStartIndex * nsZenCtrlTabPanel.CARD_WIDTH;

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

export var gZenCtrlTabPanel = new nsZenCtrlTabPanel();
