/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { nsZenDOMOperatedFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";

const lazy = {};

XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "enabled",
  "zen.tabs.ctrl-tab-panel.enabled",
  true
);

XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "sortByRecent",
  "zen.tabs.ctrl-tab-panel.sort-by-recent",
  false
);

class nsZenCtrlTabPanel extends nsZenDOMOperatedFeature {
  static CARD_WIDTH = 250;
  static CARD_HEIGHT = 220;
  static PANEL_PADDING = 16;
  static PANEL_HEIGHT =
    nsZenCtrlTabPanel.CARD_HEIGHT + nsZenCtrlTabPanel.PANEL_PADDING * 2;

  #isOpen = false;
  #currentIndex = 0;
  #tabList = [];
  #thumbnailCache = new Map();
  #visibleCards = undefined;

  init() {
    ChromeUtils.defineLazyGetter(this, "panel", () =>
      document.getElementById("zen-ctrl-tab-panel")
    );
    ChromeUtils.defineLazyGetter(this, "cardsContainer", () =>
      document.getElementById("zen-ctrl-tab-panel-cards")
    );

    const onKeyDown = e => this.#handleKeyDown(e);
    const onKeyUp = e => this.#handleKeyUp(e);
    const onTabClose = e => {
      this.#removeThumbnail(e.target.linkedPanel);
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("TabClose", onTabClose);

    window.addEventListener(
      "unload",
      () => {
        window.removeEventListener("keydown", onKeyDown, true);
        window.removeEventListener("keyup", onKeyUp, true);
        window.removeEventListener("TabClose", onTabClose);
      },
      { once: true }
    );
  }

  #handleKeyDown(event) {
    if (lazy.enabled && event.ctrlKey && event.key === "Tab") {
      if (!this.#isOpen) {
        event.preventDefault();
        event.stopImmediatePropagation();
        this.#open(event.shiftKey);
      } else {
        event.shiftKey ? this.#navigateBackward() : this.#navigateForward();
      }
    }
  }

  #handleKeyUp(event) {
    if (this.#isOpen && event.key === "Control") {
      this.#close();
    }
  }

  // Ensure panel fits on narrow or vertical displays.
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
   * Constructs tab list, determines initial selection, captures thumbnails, and opens panel.
   *
   * @param {boolean} shiftKey - Navigate backward (true) or forward (false).
   * @returns {Promise<void>} Resolves when panel is displayed.
   */
  async #open(shiftKey = false) {
    if (this.#isOpen) {
      return;
    }

    this.#tabList = Array.from(gBrowser.tabs).filter(tab => {
      if (tab.closing || !tab.visible || tab.hasAttribute("busy")) {
        return false;
      }
      if (lazy.sortByRecent && tab.hasAttribute("pending")) {
        return false;
      }
      return true;
    });

    if (this.#tabList.length <= 1) {
      return;
    }

    /* Delete current tab's cached thumbnail so it gets recaptured below,
     * this ensures thumbnails show the most up-to-date page content. */
    this.#removeThumbnail(gBrowser.selectedTab.linkedPanel);

    const initialCardIndex = lazy.sortByRecent
      ? 0
      : this.#tabList.indexOf(gBrowser.selectedTab);

    if (shiftKey) {
      this.#currentIndex =
        initialCardIndex >= 0
          ? (initialCardIndex - 1 + this.#tabList.length) % this.#tabList.length
          : this.#tabList.length - 1;
    } else {
      this.#currentIndex =
        initialCardIndex >= 0
          ? (initialCardIndex + 1) % this.#tabList.length
          : 0;
    }

    this.#visibleCards = Math.min(this.#tabList.length, this.#getMaxCards());
    this.#isOpen = true;

    const tabboxRect = gBrowser.tabbox.getBoundingClientRect();
    const tabBoxAspectRatio = tabboxRect.width / tabboxRect.height;
    // Clamp width to 300 on narrow viewports and 700 on wide viewports
    const thumbnailWidth = Math.round(
      Math.min(Math.max(tabBoxAspectRatio * 500, 300), 700)
    );
    const thumbnailHeight = Math.round(thumbnailWidth / tabBoxAspectRatio);

    await Promise.all(
      this.#tabList.map(tab =>
        this.#captureThumbnail(tab, thumbnailWidth, thumbnailHeight)
      )
    );

    if (!this.#isOpen) {
      return;
    }

    if (lazy.sortByRecent) {
      this.#tabList.sort((tab1, tab2) => tab2.lastAccessed - tab1.lastAccessed);
    }

    this.#createTabCards();

    const scrollPosition =
      this.#getPageStartIndex(this.#currentIndex) *
      nsZenCtrlTabPanel.CARD_WIDTH;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    const panelWidth =
      nsZenCtrlTabPanel.CARD_WIDTH * this.#visibleCards +
      nsZenCtrlTabPanel.PANEL_PADDING * 2;

    // Math.max(0, ...) prevents panel from being cut off by screen edge on narrow browser windows.
    const centerX = Math.max(0, (windowWidth - panelWidth) / 2);
    const centerY = (windowHeight - nsZenCtrlTabPanel.PANEL_HEIGHT) / 2;

    this.panel.addEventListener(
      "popupshowing",
      () => {
        this.cardsContainer.scrollLeft = scrollPosition;
      },
      { once: true }
    );

    this.panel.addEventListener(
      "popuphidden",
      () => {
        this.#close(false);
      },
      { once: true }
    );

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!this.#isOpen) {
          return;
        }
        PanelMultiView.openPopup(this.panel, document.documentElement, {
          position: "overlap",
          triggerEvent: null,
          x: centerX,
          y: centerY,
        });
      });
    });
  }

  #close(switchTab = true) {
    if (!this.#isOpen) {
      return;
    }

    const selectedTab = this.#tabList[this.#currentIndex];
    if (
      switchTab &&
      selectedTab &&
      !selectedTab.closing &&
      selectedTab !== gBrowser.selectedTab
    ) {
      gBrowser.selectedTab = selectedTab;
    }

    this.#isOpen = false;
    this.#currentIndex = 0;
    this.#tabList = [];
    this.#visibleCards = undefined;
    this.panel.hidePopup();
  }

  /**
   * Captures tab thumbnail and caches it.
   *
   * @param {object} tab
   * @param {number} thumbnailWidth
   * @param {number} thumbnailHeight
   * @returns {Promise<void>} Resolves when thumbnail is captured.
   */
  async #captureThumbnail(tab, thumbnailWidth, thumbnailHeight) {
    const browser = tab.linkedBrowser;
    const tabId = tab.linkedPanel;

    if (
      tab.hasAttribute("pending") ||
      tab.closing ||
      this.#thumbnailCache.has(tabId) ||
      !browser
    ) {
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = thumbnailWidth;
    canvas.height = thumbnailHeight;

    await PageThumbs.captureToCanvas(browser, canvas, {
      fullViewport: true,
    });

    const blob = await new Promise(resolve =>
      canvas.toBlob(resolve, "image/png")
    );

    if (!blob) {
      return;
    }

    this.#thumbnailCache.set(tabId, URL.createObjectURL(blob));
  }

  /**
   * Revokes blob URL and removes thumbnail from cache.
   *
   * @param {string} tabId
   * @returns {void}
   */
  #removeThumbnail(tabId) {
    const url = this.#thumbnailCache.get(tabId);
    if (url) {
      URL.revokeObjectURL(url);
    }
    this.#thumbnailCache.delete(tabId);
  }

  /**
   * Creates card UI for each tab in the current tab list.
   *
   * @returns {void}
   */
  #createTabCards() {
    if (!this.cardsContainer) {
      return;
    }

    const defaultFavicon = PlacesUtils.favicons.defaultFavicon.spec;
    const newTabFavicon = "chrome://browser/skin/zen-icons/new-tab-image.svg";

    this.cardsContainer.replaceChildren();
    this.cardsContainer.style.width = `${nsZenCtrlTabPanel.CARD_WIDTH * this.#visibleCards}px`;

    this.#tabList.forEach((tab, index) => {
      const card = document.createElement("div");
      card.className = "zen-ctrl-tab-panel-card";

      const thumbnailContainer = document.createElement("div");
      thumbnailContainer.className = "zen-ctrl-tab-panel-thumbnail";

      const thumbnail = tab.hasAttribute("pending")
        ? null
        : this.#thumbnailCache.get(tab.linkedPanel);

      if (thumbnail) {
        const img = document.createElement("img");
        img.src = thumbnail;
        thumbnailContainer.appendChild(img);
      } else {
        card.classList.add("zen-ctrl-tab-panel-no-thumbnail");
      }

      card.appendChild(thumbnailContainer);

      const infoContainer = document.createElement("div");
      infoContainer.className = "zen-ctrl-tab-panel-info";

      const favicon = document.createElement("img");
      favicon.className = "zen-ctrl-tab-panel-favicon";

      let iconSrc = gBrowser.getIcon(tab) || defaultFavicon;
      if (iconSrc.startsWith("chrome://branding/content/")) {
        iconSrc = newTabFavicon;
      }

      favicon.src = iconSrc;
      infoContainer.appendChild(favicon);

      const title = document.createElement("div");
      title.className = "zen-ctrl-tab-panel-title";
      title.textContent = tab.label;

      infoContainer.appendChild(title);
      card.appendChild(infoContainer);

      if (tab.hasAttribute("pending")) {
        card.classList.add("zen-ctrl-tab-panel-pending");
      }

      if (index === this.#currentIndex) {
        card.classList.add("zen-ctrl-tab-panel-selected");
      }

      card.addEventListener("click", () => {
        this.#currentIndex = index;
        this.#close();
      });

      this.cardsContainer.appendChild(card);
    });
  }

  /**
   * Updates visual selection state and smoothly scrolls to the selected card.
   *
   * @param {number} previousIndex - Index of the previously selected card to deselect.
   * @returns {void}
   */
  #updateSelection(previousIndex) {
    if (!this.cardsContainer?.children.length) {
      return;
    }

    const prevSelected = this.cardsContainer.children[previousIndex];
    prevSelected.classList.remove("zen-ctrl-tab-panel-selected");

    const newSelected = this.cardsContainer.children[this.#currentIndex];
    newSelected.classList.add("zen-ctrl-tab-panel-selected");

    const scrollPosition =
      this.#getPageStartIndex(this.#currentIndex) *
      nsZenCtrlTabPanel.CARD_WIDTH;

    this.cardsContainer.scrollTo({
      left: scrollPosition,
      behavior: "smooth",
    });
  }

  /**
   * Calculates which card should be at the left edge for pagination.
   *
   * @param {number} currentCardIndex - Index of the selected card.
   * @returns {number} Index of the first card on the current page.
   */
  #getPageStartIndex(currentCardIndex) {
    const totalTabs = this.#tabList.length;
    const maxVisible = this.#visibleCards;

    if (totalTabs <= maxVisible) {
      return 0;
    }

    const pageStartIndex =
      Math.floor(currentCardIndex / maxVisible) * maxVisible;

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
    const previousIndex = this.#currentIndex;
    this.#currentIndex = (this.#currentIndex + 1) % this.#tabList.length;
    this.#updateSelection(previousIndex);
  }

  /**
   * Moves selection to previous card (wraps to last when at start).
   *
   * @returns {void}
   */
  #navigateBackward() {
    const previousIndex = this.#currentIndex;
    this.#currentIndex =
      (this.#currentIndex - 1 + this.#tabList.length) % this.#tabList.length;
    this.#updateSelection(previousIndex);
  }
}

window.gZenCtrlTabPanel = new nsZenCtrlTabPanel();
