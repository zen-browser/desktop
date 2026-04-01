/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { nsZenDOMOperatedFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  PageThumbs: "resource://gre/modules/PageThumbs.sys.mjs",
});

XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "enabled",
  "zen.tabs.ctrl-tab-panel.enabled",
  true
);

XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "matchTheme",
  "zen.tabs.ctrl-tab-panel.accent-color",
  false
);

class nsZenCtrlTabPanel extends nsZenDOMOperatedFeature {
  static CARD_WIDTH = 250;
  static CARD_HEIGHT = 220;
  static MAX_VISIBLE_CARDS = 5;
  static PANEL_PADDING = 16;
  static THUMBNAIL_CANVAS_HEIGHT = 300;

  #isOpen = false;
  #currentIndex = 0;
  #tabList = [];
  #thumbnailCache = new Map();
  #actualVisibleCards = nsZenCtrlTabPanel.MAX_VISIBLE_CARDS;
  #firstPress = true;

  init() {
    this.#setupPreferences();
    this.#disableDefaultCtrlTab();
    this.#setupEventListeners();
    this.#setupLazyGetters();
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
    const method = lazy.enabled ? "uninit" : "readPref";
    window.ctrlTab?.[method]?.();
  }

  #setupPreferences() {
    const enabledObserver = () => this.#disableDefaultCtrlTab();
    const themeObserver = () => this.#updateThemeMatching();

    Services.prefs.addObserver(
      "zen.tabs.ctrl-tab-panel.enabled",
      enabledObserver
    );
    Services.prefs.addObserver(
      "zen.tabs.ctrl-tab-panel.accent-color",
      themeObserver
    );

    window.addEventListener(
      "unload",
      () => {
        Services.prefs.removeObserver(
          "zen.tabs.ctrl-tab-panel.enabled",
          enabledObserver
        );
        Services.prefs.removeObserver(
          "zen.tabs.ctrl-tab-panel.accent-color",
          themeObserver
        );
      },
      { once: true }
    );
  }

  #updateThemeMatching() {
    if (!this.panel) {
      return;
    }
    this.panel.toggleAttribute("zen-match-theme", lazy.matchTheme);
  }

  #setupEventListeners() {
    const keydownListener = e => this.#handleKeyDown(e);
    const keyupListener = e => this.#handleKeyUp(e);
    const blurListener = () => this.#isOpen && this.close(false);
    const onTabClose = e => this.#thumbnailCache.delete(e.target.linkedPanel);

    window.addEventListener("keydown", keydownListener, true);
    window.addEventListener("keyup", keyupListener, true);
    window.addEventListener("blur", blurListener);
    window.addEventListener("TabClose", onTabClose);

    window.addEventListener(
      "unload",
      () => {
        window.removeEventListener("keydown", keydownListener, true);
        window.removeEventListener("keyup", keyupListener, true);
        window.removeEventListener("blur", blurListener);
        window.removeEventListener("TabClose", onTabClose);
      },
      { once: true }
    );
  }

  #handleKeyDown(event) {
    if (event.key === "Escape" && this.#isOpen) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.close(false);
      return;
    }

    if (event.ctrlKey && event.key === "Tab" && lazy.enabled) {
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

  #getMaxCards() {
    const screenWidth = screen.width;

    const getPanelWidth = cards =>
      nsZenCtrlTabPanel.CARD_WIDTH * cards +
      nsZenCtrlTabPanel.PANEL_PADDING * 2;

    if (screenWidth < getPanelWidth(4)) {
      return 3;
    } else if (screenWidth < getPanelWidth(5)) {
      return 4;
    }
    return 5;
  }

  /**
   * Opens tab switcher panel with thumbnail previews.
   * Captures visible thumbnails before showing panel, then remaining thumbnails in background.
   *
   * @param {boolean} shiftKey - Navigate backward (true) or forward (false).
   * @returns {Promise<void>} Resolves when panel is displayed.
   */
  async open(shiftKey = false) {
    if (this.#isOpen) {
      return;
    }

    this.#tabList = gBrowser.tabs.filter(tab => {
      return (
        !tab.closing &&
        !tab.hidden &&
        !tab.hasAttribute("zen-empty-tab") &&
        tab.visible
      );
    });

    if (this.#tabList.length <= 1) {
      return;
    }

    // Recapture the current tab to show updated scroll position or page
    this.#thumbnailCache.delete(gBrowser.selectedTab.linkedPanel);

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

    const maxCards = this.#getMaxCards();
    this.#actualVisibleCards = Math.min(this.#tabList.length, maxCards);

    const browserRect = gBrowser.tabbox.getBoundingClientRect();
    const thumbnailHeight = nsZenCtrlTabPanel.THUMBNAIL_CANVAS_HEIGHT;
    const thumbnailWidth = Math.round(
      thumbnailHeight * (browserRect.width / browserRect.height)
    );

    await this.#cacheThumbnailsForVisible(thumbnailWidth, thumbnailHeight);

    this.#createTabCards();
    this.#updateThemeMatching();

    await new Promise(resolve => requestAnimationFrame(resolve));

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    const panelWidth =
      nsZenCtrlTabPanel.CARD_WIDTH * this.#actualVisibleCards +
      nsZenCtrlTabPanel.PANEL_PADDING * 2;

    // Math.max(0, ...) prevents panel from being cut off by screen edge on narrow browser windows.
    const centerX = Math.max(0, (windowWidth - panelWidth) / 2);
    const panelHeight =
      nsZenCtrlTabPanel.CARD_HEIGHT + nsZenCtrlTabPanel.PANEL_PADDING * 2;
    const centerY = (windowHeight - panelHeight) / 2;

    PanelMultiView.openPopup(this.panel, document.documentElement, {
      position: "overlap",
      triggerEvent: null,
      x: centerX,
      y: centerY,
    });

    this.panel.addEventListener(
      "popuphiding",
      () => {
        if (this.#isOpen) {
          this.close(false);
        }
      },
      { once: true }
    );

    requestAnimationFrame(() => this.#scrollToSelected());

    this.#tabList.forEach(tab =>
      this.#captureThumbnail(tab, thumbnailWidth, thumbnailHeight)
    );
  }

  close(switchTab = true) {
    if (!this.#isOpen) {
      return;
    }

    const selectedTab = this.#tabList[this.#currentIndex];
    if (switchTab && selectedTab && selectedTab !== gBrowser.selectedTab) {
      gBrowser.selectedTab = selectedTab;
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
   * Captures screenshots only for the tabs that are initially visible.
   *
   * @param {number} thumbnailWidth
   * @param {number} thumbnailHeight
   * @returns {Promise<void>} Resolves when all visible thumbnails are captured.
   */
  async #cacheThumbnailsForVisible(thumbnailWidth, thumbnailHeight) {
    const pageStartIndex = this.#getPageStartIndex(this.#currentIndex);
    const endIndex = Math.min(
      this.#tabList.length,
      pageStartIndex + this.#actualVisibleCards
    );
    const tabsToCache = this.#tabList.slice(pageStartIndex, endIndex);
    await Promise.all(
      tabsToCache.map(tab =>
        this.#captureThumbnail(tab, thumbnailWidth, thumbnailHeight)
      )
    );
  }

  /**
   * Captures tab screenshot and caches it. Immediately displays in card if panel is visible.
   *
   * @param {object} tab
   * @param {number} thumbnailWidth
   * @param {number} thumbnailHeight
   * @returns {Promise<void>} Resolves when captured or skipped.
   */
  async #captureThumbnail(tab, thumbnailWidth, thumbnailHeight) {
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
      const canvas = document.createElementNS(
        "http://www.w3.org/1999/xhtml",
        "canvas"
      );
      canvas.width = thumbnailWidth;
      canvas.height = thumbnailHeight;

      await lazy.PageThumbs.captureToCanvas(browser, canvas, {
        fullViewport: true,
      });
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      this.#thumbnailCache.set(tabId, dataUrl);

      if (this.#isOpen) {
        const card = this.tabsContainer?.querySelector(
          `[data-tab-id="${tabId}"]`
        );
        const thumbnailContainer = card?.querySelector(
          ".zen-ctrl-tab-panel-thumbnail"
        );

        if (thumbnailContainer) {
          card.classList.remove("zen-ctrl-tab-panel-no-thumbnail");

          const img = document.createXULElement("image");
          img.setAttribute("src", dataUrl);
          thumbnailContainer.replaceChildren(img);
        }
      }
    } catch (e) {
      console.warn("ZenCtrlTabPanel: Failed to cache thumbnail:", e);
    }
  }

  /**
   * Builds tab card UI from current tab list.
   *
   * @returns {void}
   */
  #createTabCards() {
    if (!this.tabsContainer) {
      return;
    }

    this.tabsContainer.replaceChildren();
    this.tabsContainer.style.width = `${nsZenCtrlTabPanel.CARD_WIDTH * this.#actualVisibleCards}px`;

    const fragment = document.createDocumentFragment();
    const defaultFavicon = PlacesUtils.favicons.defaultFavicon.spec;
    const newTabFavicon = "chrome://browser/skin/zen-icons/new-tab-image.svg";

    this.#tabList.forEach((tab, index) => {
      const tabId = tab.linkedPanel;
      const isPending = tab.hasAttribute("pending");

      const card = document.createXULElement("vbox");
      card.className = "zen-ctrl-tab-panel-card";
      card.setAttribute("data-tab-id", tabId);

      const thumbnailContainer = document.createXULElement("box");
      thumbnailContainer.className = "zen-ctrl-tab-panel-thumbnail";

      const thumbnail = isPending ? null : this.#thumbnailCache.get(tabId);

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

      let iconSrc = gBrowser.getIcon(tab) || defaultFavicon;

      if (iconSrc.startsWith("chrome://branding/content/")) {
        iconSrc = newTabFavicon;
      }

      favicon.setAttribute("src", iconSrc);
      infoContainer.appendChild(favicon);

      const title = document.createXULElement("label");
      title.className = "zen-ctrl-tab-panel-title";
      title.setAttribute("value", tab.label || "");
      title.setAttribute("crop", "end");
      infoContainer.appendChild(title);
      card.appendChild(infoContainer);

      if (isPending) {
        card.classList.add("zen-ctrl-tab-panel-pending");
      }

      if (index === this.#currentIndex) {
        card.classList.add("zen-ctrl-tab-panel-selected");
      }

      card.addEventListener("click", event => {
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          event.stopPropagation();
          this.#currentIndex = index;
          this.close();
        }
      });

      fragment.appendChild(card);
    });

    this.tabsContainer.appendChild(fragment);
  }

  /**
   * Updates visual selection state when switching cards.
   *
   * @returns {void}
   */
  #updateSelection() {
    if (!this.tabsContainer) {
      return;
    }

    const prevSelected = this.tabsContainer.querySelector(
      ".zen-ctrl-tab-panel-selected"
    );
    if (prevSelected) {
      prevSelected.classList.remove("zen-ctrl-tab-panel-selected");
    }

    const newSelected = this.tabsContainer.children[this.#currentIndex];
    if (newSelected) {
      newSelected.classList.add("zen-ctrl-tab-panel-selected");
    }

    this.#scrollToSelected();
  }

  /**
   * Scrolls card container to display selected card.
   * First navigation uses instant scroll, subsequent navigations use smooth.
   *
   * @returns {void}
   */
  #scrollToSelected() {
    if (!this.tabsContainer) {
      return;
    }

    const pageStartIndex = this.#getPageStartIndex(this.#currentIndex);
    const scrollPosition = pageStartIndex * nsZenCtrlTabPanel.CARD_WIDTH;

    this.tabsContainer.scrollTo({
      left: scrollPosition,
      behavior: this.#firstPress ? "auto" : "smooth",
    });

    this.#firstPress = false;
  }

  /**
   * Calculates which card should be at the left edge for pagination.
   *
   * @param {number} cardIndex - Visible card index.
   * @returns {number} Index of the first card to display (left edge).
   */
  #getPageStartIndex(cardIndex) {
    const totalTabs = this.#tabList.length;
    const maxVisible = this.#actualVisibleCards;

    if (totalTabs <= maxVisible) {
      return 0;
    }

    const pageStartIndex = Math.floor(cardIndex / maxVisible) * maxVisible;

    // Adjust for last page to always show full page of cards
    if (pageStartIndex + maxVisible > totalTabs) {
      return totalTabs - maxVisible;
    }

    return pageStartIndex;
  }

  /**
   * Moves selection to next card (wraps to first when at end).
   *
   * @returns {void}
   */
  #navigateForward() {
    this.#currentIndex = (this.#currentIndex + 1) % this.#tabList.length;
    this.#updateSelection();
  }

  /**
   * Moves selection to previous card (wraps to last when at start).
   *
   * @returns {void}
   */
  #navigateBackward() {
    this.#currentIndex =
      (this.#currentIndex - 1 + this.#tabList.length) % this.#tabList.length;
    this.#updateSelection();
  }
}

export const gZenCtrlTabPanel = new nsZenCtrlTabPanel();
