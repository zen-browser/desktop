// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { nsZenMenuBar } from "chrome://browser/content/zen-components/ZenMenubar.mjs";
import { nsZenToastManager } from "resource:///modules/zen/ZenToasts.mjs";
import { nsZenUrlbarController } from "resource:///modules/zen/urlbar/ZenUrlbarController.mjs";

// Minimum height the floating URL bar is vertically centered against.
const FLOATING_URLBAR_MIN_HEIGHT = 333;
const FLOATING_URLBAR_MAX_WIDTH = 750;

// Panels shown as native NSPopovers on macOS, which clip instead of scroll.
const NATIVE_POPOVER_PANELS = [
  "appMenu-popup",
  "customizationui-widget-panel",
  "widget-overflow",
];

/**
 * Window-level UI glue for Zen.
 */
class nsZenUIManager {
  testingEnabled = Services.prefs.getBoolPref("zen.testing.enabled", false);
  profilingEnabled = Services.prefs.getBoolPref(
    "zen.testing.profiling.enabled",
    false
  );

  /** Where the user last pressed the mouse, so animations can start there. */
  _lastClickPosition = null;
  /** True once spaces are initialized. */
  _hasLoadedDOM = false;
  /** Set by spaces to skip the tab container rebuild of the next toolbar update. */
  _preventToolbarRebuild = false;

  #toasts = new nsZenToastManager();
  #urlbar = new nsZenUrlbarController();

  // Elements that get `has-popup-menu` while a popup opened from them is up.
  #popupTrackingElements = new Set();
  #currentPopup = null;
  #currentPopupTrackElement = null;
  #removeHasPopupAttribute = null;

  constructor() {
    ChromeUtils.defineLazyGetter(this, "tabsWrapper", () =>
      document.getElementById("zen-tabs-wrapper")
    );
  }

  init() {
    window.gZenMenubar = new nsZenMenuBar();

    document.addEventListener("popupshowing", this);
    document.addEventListener("popuphidden", this);
    document.addEventListener("mousedown", this, true);
    window.addEventListener("TabClose", this);

    gZenWorkspaces.promiseInitialized.finally(() => {
      this._hasLoadedDOM = true;
      this.updateTabsToolbar();
    });

    gZenVerticalTabsManager.init();
    this.#urlbar.init();

    this.#markAcrylicSupport();
    this.#initCreateNewPopup();
    this.#debloatContextMenus();
    this.#addCompactModeButtonIfNeeded();
    this.#initBookmarkCollapseListener();

    document
      .getElementById("PersonalToolbar")
      .setAttribute("fullscreentoolbar", "true");
  }

  handleEvent(event) {
    switch (event.type) {
      case "popupshowing":
        this.#onPopupShowing(event);
        break;
      case "popuphidden":
        this.#onPopupHidden(event);
        break;
      case "mousedown":
        this._lastClickPosition = {
          clientX: event.clientX,
          clientY: event.clientY,
        };
        break;
      case "TabClose":
        this.onTabClose(event);
        break;
    }
  }

  get motion() {
    if (!window.Motion) {
      Services.scriptloader.loadSubScript(
        "chrome://browser/content/zen-vendor/motion.min.mjs",
        window
      );
    }
    return window.Motion;
  }

  /**
   * Animate an element using Element.animate API.
   * This is not using gZenUIManager.motion, because motion library has some issues
   * with certain properties and we want to have a simple wrapper for that.
   *
   * @param {Element} element
   * @param {object} rawKeyframes - Property to keyframe values. `x`, `y`,
   *   `scaleX` and `scaleY` are folded into a `transform` keyframe.
   * @param {...any} args - Passed through to Element.animate.
   */
  async elementAnimate(element, rawKeyframes, ...args) {
    rawKeyframes = { ...rawKeyframes };
    if (
      (rawKeyframes.y || rawKeyframes.x || rawKeyframes.scale) &&
      !rawKeyframes.transform
    ) {
      const yValues = rawKeyframes.y || [];
      const xValues = rawKeyframes.x || [];
      const scaleYValues = rawKeyframes.scaleY || [];
      const scaleXValues = rawKeyframes.scaleX || [];
      delete rawKeyframes.y;
      delete rawKeyframes.x;
      delete rawKeyframes.scaleY;
      delete rawKeyframes.scaleX;
      rawKeyframes.transform = [];
      if (
        yValues.length !== 0 &&
        xValues.length !== 0 &&
        yValues.length !== xValues.length
      ) {
        console.error("y and x keyframes must have the same length");
      }
      const keyframeLength = Math.max(
        yValues.length,
        xValues.length,
        scaleYValues.length,
        scaleXValues.length
      );
      for (let i = 0; i < keyframeLength; i++) {
        const y = yValues[i] !== undefined ? `translateY(${yValues[i]}px)` : "";
        const x = xValues[i] !== undefined ? `translateX(${xValues[i]}px)` : "";
        const scaleY =
          scaleYValues[i] !== undefined ? `scaleY(${scaleYValues[i]})` : "";
        const scaleX =
          scaleXValues[i] !== undefined ? `scaleX(${scaleXValues[i]})` : "";
        rawKeyframes.transform.push(`${x} ${y} ${scaleX} ${scaleY}`.trim());
      }
    }
    const keyframes = [];
    for (let i = 0; i < Object.values(rawKeyframes)[0].length; i++) {
      const frame = {};
      for (const [property, values] of Object.entries(rawKeyframes)) {
        frame[property] = values[i];
      }
      keyframes.push(frame);
    }
    return new Promise(resolve => {
      const animation = element.animate(keyframes, ...args);
      animation.onfinish = () => resolve();
    });
  }

  /**
   * Shakes an element from side to side to catch the user's eye.
   *
   * @param {Element} element
   * @param {number} delay Milliseconds to wait before shaking.
   */
  shakeElement(element, delay = 0) {
    return this.elementAnimate(
      element,
      { x: [0, -12, 8, -4, 2, 0] },
      { duration: 600, delay, easing: "ease-out" }
    );
  }

  /**
   * Shows a toast message. See nsZenToastManager.show for the options.
   *
   * @param {string} messageId - Fluent id of the message.
   * @param {object} [options]
   */
  showToast(messageId, options = {}) {
    return this.#toasts.show(messageId, options);
  }

  /**
   * Repositions the floating URL bar and lets the sidebar recompute its
   * sizes. Called after layout-affecting changes such as resizes and tab
   * closes.
   *
   * @param {boolean} [fromResizeEvent] - True when triggered by a window
   *   resize, which only needs the URL bar repositioned.
   */
  updateTabsToolbar(fromResizeEvent = false) {
    const urlbarHeight = Math.max(
      FLOATING_URLBAR_MIN_HEIGHT,
      window.windowUtils.getBoundsWithoutFlushing(gURLBar).height
    );
    gURLBar.style.setProperty(
      "--zen-urlbar-top",
      `${window.innerHeight / 2 - urlbarHeight / 2}px`
    );
    gURLBar.style.setProperty(
      "--zen-urlbar-width",
      `${Math.min(window.innerWidth / 1.5, FLOATING_URLBAR_MAX_WIDTH)}px`
    );
    gZenVerticalTabsManager.actualWindowButtons.removeAttribute(
      "zen-has-hover"
    );
    gZenVerticalTabsManager.recalculateURLBarHeight(!fromResizeEvent);
    if (!this._preventToolbarRebuild && !fromResizeEvent) {
      setTimeout(() => {
        gZenWorkspaces.updateTabsContainers();
      }, 0);
    }
    this._preventToolbarRebuild = false;
  }

  onTabClose(event = undefined) {
    if (!event?.target?._closedInMultiselection) {
      this.updateTabsToolbar();
    }
  }

  onFloatingURLBarOpen() {
    requestAnimationFrame(() => {
      this.updateTabsToolbar();
    });
  }

  /**
   * Adds the 'has-popup-menu' attribute to the element when popup is opened on it.
   *
   * @param {Element} element element to track
   */
  addPopupTrackingAttribute(element) {
    this.#popupTrackingElements.add(element);
  }

  removePopupTrackingAttribute(element) {
    this.#popupTrackingElements.delete(element);
  }

  // On macOS, the app menu panel is displayed as a native NSPopover which
  // silently clips content beyond the screen without informing Firefox's
  // layout engine. This makes bottom menu items unreachable by scrolling.
  // Setting max-height based on available screen space lets Firefox's layout
  // handle the constraint, enabling proper overflow scrolling.
  // See gh-12782
  #constrainNativePopoverHeight(panel) {
    if (!NATIVE_POPOVER_PANELS.includes(panel.id)) {
      return;
    }
    // NSPopover adds 13px of chrome on all sides (26px vertical total),
    // measured via Accessibility Inspector on macOS 26 (Tahoe).
    // Previous macOS versions have similar or smaller values, so this is a
    // conservative upper bound.
    const popoverChrome = 26;
    panel.style.maxHeight = `${window.screen.availHeight - popoverChrome}px`;
  }

  #onPopupShowing(showEvent) {
    if (
      AppConstants.platform === "macosx" &&
      Services.prefs.getBoolPref("widget.macos.native-context-menus", false)
    ) {
      this.#constrainNativePopoverHeight(showEvent.target);
    }
    const target = showEvent.explicitOriginalTarget;
    for (const el of this.#popupTrackingElements) {
      // target may be inside a shadow root, not directly under the element
      // we also ignore menus inside panels
      if (
        !el.contains(target) ||
        (Element.isInstance(target) && target?.closest("panel")) ||
        // See bug #7590: Ignore menupopup elements opening.
        // Also see #10612 for the exclusion of the zen-appcontent-navbar-wrapper
        (target.tagName === "menupopup" &&
          el.id !== "zen-appcontent-navbar-wrapper")
      ) {
        continue;
      }
      document.removeEventListener("mousemove", this.#removeHasPopupAttribute);
      gZenCompactModeManager._setElementExpandAttribute(
        el,
        true,
        "has-popup-menu"
      );
      this.#currentPopup = showEvent.target;
      this.#currentPopupTrackElement = el;
      break;
    }
  }

  #onPopupHidden(hideEvent) {
    if (!this.#currentPopup || this.#currentPopup !== hideEvent.target) {
      return;
    }
    const element = this.#currentPopupTrackElement;
    const collapse = () =>
      gZenCompactModeManager._setElementExpandAttribute(
        element,
        false,
        "has-popup-menu"
      );
    if (document.getElementById("main-window").matches(":hover")) {
      collapse();
    } else {
      // Keep the element open until the mouse comes back into the window.
      this.#removeHasPopupAttribute = collapse;
      document.addEventListener("mousemove", collapse, { once: true });
    }
    this.#currentPopup = null;
    this.#currentPopupTrackElement = null;
  }

  /**
   * Picks the anchor corner for panels so they open towards the content
   * area, depending on where the sidebar and toolbar are.
   *
   * @param {Element} panel
   * @param {Element} anchor
   * @returns {string} A XUL popup position such as "bottomleft topleft".
   */
  panelUIPosition(panel, anchor) {
    // The alignment position of the panel is determined during the "popuppositioned" event
    // when the panel opens. The alignment positions help us determine in which orientation
    // the panel is anchored to the screen space.
    //
    // *  "after_start": The panel is anchored at the top-left     corner in LTR locales, top-right    in RTL locales.
    // *    "after_end": The panel is anchored at the top-right    corner in LTR locales, top-left     in RTL locales.
    // * "before_start": The panel is anchored at the bottom-left  corner in LTR locales, bottom-right in RTL locales.
    // *   "before_end": The panel is anchored at the bottom-right corner in LTR locales, bottom-left  in RTL locales.
    //
    //   ┌─Anchor(LTR)          ┌─Anchor(RTL)
    //   │       Anchor(RTL)─┐  │       Anchor(LTR)─┐
    //   │                   │  │                   │
    //   x───────────────────x  x───────────────────x
    //   │                   │  │                   │
    //   │       Panel       │  │       Panel       │
    //   │   "after_start"   │  │    "after_end"    │
    //   │                   │  │                   │
    //   └───────────────────┘  └───────────────────┘
    //
    //   ┌───────────────────┐  ┌───────────────────┐
    //   │                   │  │                   │
    //   │       Panel       │  │       Panel       │
    //   │   "before_start"  │  │    "before_end"   │
    //   │                   │  │                   │
    //   x───────────────────x  x───────────────────x
    //   │                   │  │                   │
    //   │       Anchor(RTL)─┘  │       Anchor(LTR)─┘
    //   └─Anchor(LTR)          └─Anchor(RTL)
    //
    // The default choice for the panel is "after_start", to match the content context menu's alignment. However, it is
    // possible to end up with any of the four combinations. Before the panel is opened, the XUL popup manager needs to
    // make a determination about the size of the panel and whether or not it will fit within the visible screen area with
    // the intended alignment. The manager may change the panel's alignment before opening to ensure the panel is fully visible.
    //
    // For example, if the panel is opened such that the bottom edge would be rendered off screen, then the XUL popup manager
    // will change the alignment from "after_start" to "before_start", anchoring the panel's bottom corner to the target screen
    // location instead of its top corner. This transformation ensures that the whole of the panel is visible on the screen.
    //
    // When the panel is anchored by one of its bottom corners (the "before_..." options), then it causes unintentionally odd
    // behavior where dragging the text-area resizer downward with the mouse actually grows the panel's top edge upward, since
    // the bottom of the panel is anchored in place. We want to disable the resizer if the panel was positioned to be anchored
    // from one of its bottom corners.
    let block = "bottomleft";
    let inline = "topleft";
    if (anchor?.closest("#zen-sidebar-top-buttons")) {
      block = "topleft";
    }
    const singleToolbar = gZenVerticalTabsManager._hasSetSingleToolbar;
    if (
      (singleToolbar && gZenVerticalTabsManager._prefsRightSide) ||
      (panel?.id === "zen-unified-site-data-panel" && !singleToolbar) ||
      (panel?.id === "unified-extensions-panel" && singleToolbar)
    ) {
      block = "bottomright";
      inline = "topright";
    }
    return `${block} ${inline}`;
  }

  handleNewTab(...args) {
    return this.#urlbar.handleNewTab(...args);
  }

  matchesCloseToken(closeToken, event) {
    return this.#urlbar.matchesCloseToken(closeToken, event);
  }

  _isOwner(closeSeq) {
    return this.#urlbar.isOwner(closeSeq);
  }

  onUrlbarOpen() {
    this.#urlbar.onUrlbarOpen();
  }

  onUrlbarClose() {
    this.#urlbar.onUrlbarClose();
  }

  enableCommandsMode(event) {
    this.#urlbar.enableCommandsMode(event);
  }

  getOpenUILinkWhere(url, browser, openUILinkWhere) {
    return this.#urlbar.getOpenUILinkWhere(url, browser, openUILinkWhere);
  }

  openAndChangeToTab(url, options) {
    const browserWindow = window.parent || window;
    const tab = browserWindow.gBrowser.addTrustedTab(url, options);
    browserWindow.gBrowser.selectedTab = tab;
    return tab;
  }

  generateUuidv4() {
    return Services.uuid.generateUUID().toString();
  }

  createValidXULText(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // Section: startup DOM tweaks

  /**
   * Software WebRender can't filter the web content behind the chrome, so the acrylic
   * elements have nothing to blur there and must stay opaque. Safe mode blocks
   * hardware acceleration, so it ends up on the same path.
   */
  #markAcrylicSupport() {
    let supported = !Services.appinfo.inSafeMode;

    try {
      supported &&= !window.windowUtils.layerManagerType.includes("Software");
    } catch (e) {
      // No widget associated with this window yet, assume hardware rendering.
    }

    if (!supported) {
      document.documentElement.setAttribute("zen-no-acrylic", "true");
    }
  }

  #addCompactModeButtonIfNeeded() {
    const kPref = "zen.ui.migration.compact-mode-button-added";
    const navbarPlacements = CustomizableUI.getWidgetIdsInArea(
      "zen-sidebar-top-buttons"
    );
    try {
      if (
        !navbarPlacements.length &&
        !Services.prefs.getBoolPref(kPref, false)
      ) {
        CustomizableUI.addWidgetToArea(
          "zen-toggle-compact-mode",
          "zen-sidebar-top-buttons",
          0
        );
        gZenVerticalTabsManager._topButtonsSeparatorElement.before(
          document.getElementById("zen-toggle-compact-mode")
        );
      }
    } catch (e) {
      console.error("Error adding compact mode button to sidebar:", e);
    }
    Services.prefs.setBoolPref(kPref, true);
  }

  // Mirrors the bookmarks toolbar visibility on the root element for CSS.
  #initBookmarkCollapseListener() {
    const bookmarkToolbar = document.getElementById("PersonalToolbar");
    const update = visible => {
      document.documentElement.toggleAttribute("zen-has-bookmarks", visible);
    };
    // Set it initially if bookmarks toolbar is visible, customizable UI
    // is ran before this function.
    update(!bookmarkToolbar.hasAttribute("collapsed"));
    bookmarkToolbar.addEventListener("toolbarvisibilitychange", event =>
      update(event.detail.visible)
    );
  }

  #debloatContextMenus() {
    if (!Services.prefs.getBoolPref("zen.view.context-menu.refresh", false)) {
      return;
    }
    const contextMenusToClean = [
      // Remove the 'new tab below' context menu.
      // reason: It doesn't properly work with zen and it's philosophy of not having
      //   new tabs. It's also semi-not working as it doesn't create a new tab below
      //   the current one.
      "context_openANewTab",
    ];
    for (const id of contextMenusToClean) {
      document.getElementById(id)?.setAttribute("hidden", "true");
    }
  }

  // Rotates the "create new" plus icon while its popup is open.
  #initCreateNewPopup() {
    const popup = document.getElementById("zenCreateNewPopup");
    popup.addEventListener("popupshowing", () => {
      const button = document.getElementById("zen-create-new-button");
      if (!button) {
        return;
      }
      const image = button.querySelector("image");
      button.setAttribute("open", "true");
      this.motion.animate(
        image,
        { transform: ["rotate(0deg)", "rotate(45deg)"] },
        { duration: 0.2 }
      );
      popup.addEventListener(
        "popuphidden",
        () => {
          button.removeAttribute("open");
          this.motion.animate(
            image,
            { transform: ["rotate(45deg)", "rotate(0deg)"] },
            { duration: 0.2 }
          );
        },
        { once: true }
      );
    });
  }
}

window.gZenUIManager = new nsZenUIManager();
