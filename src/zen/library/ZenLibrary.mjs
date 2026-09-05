// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { html } from "chrome://global/content/vendor/lit.all.mjs";
import { MozLitElement } from "chrome://global/content/lit-utils.mjs";

let lazy = {};
let gZenLibraryInstance = null;

const PREVIOUS_TAB_PREF = "zen.library.previous-tab";
const DONATE_URL = "https://zen-browser.app/donate/";

ChromeUtils.defineESModuleGetters(
  lazy,
  {
    ZenLibrarySections: "moz-src:///zen/library/ZenLibrarySections.mjs",
  },
  { global: "current" }
);

ChromeUtils.defineLazyGetter(lazy, "l10n", function () {
  return new Localization(["browser/zen-library.ftl"], true);
});

ChromeUtils.defineLazyGetter(lazy, "appContentWrapper", function () {
  return document.getElementById("zen-appcontent-wrapper");
});

/**
 * The ZenLibrary class is responsible for managing the UI for the library feature.
 * This feature allows users to view and manage their browsing history, downloads,
 * spaces, and other related data in a unified interface.
 */
export class ZenLibrary extends MozLitElement {
  static #ANIMATION_DURATION = 280;
  static #ANIMATION_EASING = "cubic-bezier(0.32, 0.72, 0, 1)";
  static #TOOLBOX_OPEN_TRANSFORM = "scale(0.96)";
  static #TOOLBOX_OPEN_OPACITY = "-0.5";

  #initialized = false;
  #resizeObserver = null;
  #sections = [];
  #activeAnimations = new Set();
  #animating = false;
  _deletionIdleCallbackId = null;

  static properties = {
    _activeTab: { type: String },
  };

  static queries = {
    _content: "#zen-library-content",
    _tabs: { all: "#zen-library-sidebar-tabs > .library-tab" },
    _header: "#zen-library-sidebar-header",
    _footer: "#zen-library-sidebar-footer",
  };

  createRenderRoot() {
    return this;
  }

  constructor() {
    super();
    this.activeTab = Services.prefs.getStringPref(PREVIOUS_TAB_PREF, "") || "history";
  }

  set activeTab(value) {
    if (this.activeTab === value) {
      return;
    }
    this._activeTab = value;
    Services.prefs.setStringPref(PREVIOUS_TAB_PREF, value);
  }

  get activeTab() {
    return this._activeTab;
  }

  connectedCallback() {
    super.connectedCallback();
    if (this.#initialized) {
      return;
    }
    window.addEventListener("keydown", this);
    this.addEventListener("animationend", this);
    // Add connected call back and make `appContentWrapper` transform translate the oposite of this element
    this.#resizeObserver = new ResizeObserver(() => {
      if (gZenWorkspaces._swipeManager._swipeState.librarySwiping) {
        return;
      }
      let translateX = this.#computeWrapperTargetPx();
      lazy.appContentWrapper.style.transform = `translateX(${translateX}px)`;
    });
    this.#resizeObserver.observe(this);
    for (const Section of Object.values(lazy.ZenLibrarySections)) {
      let section = new Section();
      this.#sections.push(section);
    }
    this.#initialized = true;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("keydown", this);
    for (const section of this.#sections) {
      section.remove();
    }
    this.#sections = [];
    if (this.#resizeObserver) {
      this.#resizeObserver.disconnect();
      this.#resizeObserver = null;
    }
    this.#initialized = false;
  }

  firstUpdated() {
    super.firstUpdated?.();
    this._header.appendChild(
      gZenVerticalTabsManager.actualWindowButtons.cloneNode(true)
    );
    this.#buildFooterButtons();
    const activeTabEl = this.querySelector(".zen-library-tab[active]");
    if (activeTabEl) {
      this.#animateTabIcon(activeTabEl);
    }
  }

  #buildFooterButtons() {
    const buttons = [
      {
        l10nId: "library-close-button",
        image: "chrome://browser/skin/zen-icons/back.svg",
        command: () => ZenLibrary.toggle(),
      },
      {
        l10nId: "library-donate-button",
        image: "chrome://browser/skin/zen-icons/heart-circle-fill.svg",
        command: () => {
          window.openTrustedLinkIn(DONATE_URL, "tab");
          ZenLibrary.toggle();
        },
      },
    ];
    for (const { l10nId, image, command } of buttons) {
      const button = document.createXULElement("toolbarbutton");
      button.className = "toolbarbutton-1";
      button.setAttribute("image", image);
      document.l10n.setAttributes(button, l10nId);
      button.addEventListener("command", command);
      this._footer.appendChild(button);
    }
  }

  /**
   * Plays a tab's icon sprite animation, reload-to-stop style: the [animate]
   * attribute starts the strip's steps() animation (see zen-library.css) and
   * the animationend handler removes it again. Restarts if mid-animation.
   *
   * @param {Element} tab
   */
  #animateTabIcon(tab) {
    tab.removeAttribute("animate");
    // Flush styles so re-adding the attribute restarts the animation.
    void tab.offsetWidth;
    tab.setAttribute("animate", "true");
  }

  render() {
    return html`
      <link
        rel="stylesheet"
        href="chrome://browser/content/zen-styles/zen-library.css"
      />
      <vbox id="zen-library-sidebar">
        <vbox id="zen-library-sidebar-header"></vbox>
        <vbox id="zen-library-sidebar-tabs">
          ${Object.values(lazy.ZenLibrarySections).map(
            Section => html`
              <vbox
                class="zen-library-tab"
                ?active=${this.activeTab === Section.id}
                data-section=${Section.id}
                @click=${event => {
                  if (this.activeTab !== Section.id) {
                    this.activeTab = Section.id;
                    this.#animateTabIcon(event.currentTarget);
                  }
                }}
              >
                <div class="zen-library-tab-icon">
                  <div class="zen-library-tab-icon-image"></div>
                </div>
                <label>${lazy.l10n.formatValueSync(Section.label)}</label>
              </vbox>
            `
          )}
        </vbox>
        <toolbar mode="icons"
          fullscreentoolbar="true"
          class="browser-toolbar chromeclass-location"
          id="zen-library-sidebar-footer">
        </toolbar>
      </vbox>
      <vbox
        id="zen-library-content"
        flex="1"
        ?large-content=${lazy.ZenLibrarySections[this.activeTab].largeContent}
      >
        ${this.#sections.find(section => section.constructor.id === this.activeTab)}
      </vbox>
    `;
  }

  handleEvent(event) {
    switch (event.type) {
      case "keydown": {
        if (event.key === "Escape" && this.isOpen) {
          ZenLibrary.toggle();
        }
        break;
      }
      case "animationend": {
        if (event.animationName === "zen-library-tab-icon-play") {
          event.target.closest(".zen-library-tab")?.removeAttribute("animate");
        }
        break;
      }
    }
  }

  get isOpen() {
    return this.hasAttribute("open");
  }

  /** True when a live library instance exists and is in the open state. */
  static get isOpen() {
    return gZenLibraryInstance?.isOpen ?? false;
  }

  static getInstance() {
    if (!gZenLibraryInstance) {
      gZenLibraryInstance = new ZenLibrary();
      gNavToolbox.before(gZenLibraryInstance);
    }
    return gZenLibraryInstance;
  }

  static clearInstance() {
    if (gZenLibraryInstance) {
      gZenLibraryInstance._deletionIdleCallbackId = null;
      gZenLibraryInstance.remove();
      gZenLibraryInstance = null;
    }
  }

  static toggle() {
    if (gZenLibraryInstance?.#animating) {
      return;
    }
    window.docShell.treeOwner
      .QueryInterface(Ci.nsIInterfaceRequestor)
      .getInterface(Ci.nsIAppWindow)
      .rollupAllPopups();
    let instance = this.getInstance();
    instance.toggleAttribute("open");
    if (instance.isOpen) {
      if (instance._deletionIdleCallbackId) {
        cancelIdleCallback(instance._deletionIdleCallbackId);
        instance._deletionIdleCallbackId = null;
      }
      gNavToolbox.setAttribute("zen-library-open", "true");
      instance.#animateOpen();
    } else {
      gNavToolbox.removeAttribute("zen-library-open");
      // #animateClose schedules the instance disposal itself once the slide-
      // out finishes, so we don't queue an idle callback eagerly here — that
      // would otherwise race the animation and yank the element out of the
      // DOM mid-slide.
      instance.#animateClose();
    }
  }

  #cancelActiveAnimations() {
    for (const anim of this.#activeAnimations) {
      try {
        anim.cancel();
      } catch {
        /* already settled */
      }
    }
    this.#activeAnimations.clear();
  }

  #animate(element, keyframes) {
    const anim = element.animate(keyframes, {
      duration: ZenLibrary.#ANIMATION_DURATION,
      easing: ZenLibrary.#ANIMATION_EASING,
      fill: "forwards",
    });
    this.#activeAnimations.add(anim);
    anim.finished.then(
      () => this.#activeAnimations.delete(anim),
      () => this.#activeAnimations.delete(anim)
    );
    return anim;
  }

  /**
   * Mirrors the ResizeObserver's math but returns the translateX (px) instead
   * of writing it inline. Used when the observer hasn't fired yet (re-opens
   * on the same instance) or when we need a target without side effects.
   */
  #computeWrapperTargetPx() {
    const isRightSide = gZenVerticalTabsManager._prefsRightSide;
    let translateX = this.getBoundingClientRect()[
        isRightSide ? "left" : "right"
      ];
    const contentPosition = window.windowUtils.getBoundsWithoutFlushing(
      lazy.appContentWrapper
    )[isRightSide ? "right" : "left"];
    const existingTransform = new DOMMatrix(
      lazy.appContentWrapper.style.transform
    ).m41;
    translateX = translateX - contentPosition + existingTransform;
    return isRightSide ? -translateX : translateX;
  }

  async #animateOpen() {
    this.#animating = true;
    try {
      this.#cancelActiveAnimations();
      await new Promise(r => requestAnimationFrame(r));
      if (!this.isOpen || !this.isConnected) {
        return;
      }
      // Re-opens on the same instance won't trigger the observer (library
      // size is unchanged), so fall back to computing the target ourselves.
      let wrapperTarget = lazy.appContentWrapper.style.transform;
      if (!wrapperTarget) {
        wrapperTarget = `translateX(${this.#computeWrapperTargetPx()}px)`;
      }
      lazy.appContentWrapper.style.transform = "";

      this.#animate(this, [
        { transform: "translateX(-100%)", opacity: 0 },
        { transform: "translateX(0)", opacity: 1 },
      ]);
      this.#animate(gNavToolbox, [
        { transform: "scale(1)", opacity: 1 },
        {
          transform: ZenLibrary.#TOOLBOX_OPEN_TRANSFORM,
          opacity: ZenLibrary.#TOOLBOX_OPEN_OPACITY,
        },
      ]);
      const wrapperAnim = this.#animate(lazy.appContentWrapper, [
        { transform: "translateX(0)" },
        { transform: wrapperTarget },
      ]);

      try {
        await wrapperAnim.finished;
      } catch {
        return;
      }
      if (!this.isOpen) {
        return;
      }
      // Persist the final transform inline so the resize observer's
      // diff math keeps working after the animation ends.
      wrapperAnim.commitStyles();
      wrapperAnim.cancel();
      this.#activeAnimations.delete(wrapperAnim);
    } finally {
      this.#animating = false;
    }
  }

  /**
   * Prepare the library for swipe-driven state changes. Works whether the
   * library is currently open (close swipe) or closed (open swipe). After
   * this resolves, callers drive `updateSwipeProgress(0..1)` directly until
   * `finishSwipe(targetOpen)` commits or reverts.
   */
  static async beginSwipe() {
    // Refuse to enter swipe mode while a non-swipe animation is still
    // running; let it finish so the start/end states are well-defined.
    if (gZenLibraryInstance?.#animating) {
      return;
    }
    const instance = this.getInstance();
    if (instance._deletionIdleCallbackId) {
      cancelIdleCallback(instance._deletionIdleCallbackId);
      instance._deletionIdleCallbackId = null;
    }
    instance.#cancelActiveAnimations();
    const wasOpen = instance.hasAttribute("open");
    if (wasOpen) {
      // Library is already open; the wrapper's current inline transform IS
      // the target — no remeasure needed.
      instance._swipeWrapperTargetPx =
        new DOMMatrix(lazy.appContentWrapper.style.transform).m41 ||
        instance.#computeWrapperTargetPx();
    } else {
      // Measure the open-state wrapper target without flashing: temporarily
      // mark [open] so layout reflects the open position, then revert.
      instance.setAttribute("open", "true");
      instance.style.visibility = "hidden";
      await new Promise(r => requestAnimationFrame(r));
      instance._swipeWrapperTargetPx = instance.#computeWrapperTargetPx();
      instance.style.visibility = "";
      instance.removeAttribute("open");
      lazy.appContentWrapper.style.transform = "";
    }
    instance._swipeActive = true;
    // Initialize visual state to match the current attribute.
    ZenLibrary.updateSwipeProgress(wasOpen ? 1 : 0);
  }

  /**
   * Sets the library, toolbox, and content-wrapper styles to a fraction
   * (0..1) of the way to fully open. Must be preceded by `beginSwipe()`.
   *
   * @param {number} progress
   */
  static updateSwipeProgress(progress) {
    const instance = gZenLibraryInstance;
    if (!instance?._swipeActive) {
      return;
    }
    const p = Math.max(0, Math.min(1, progress));
    instance.style.transform = `translateX(${(-1 + p) * 100}%)`;
    instance.style.opacity = String(p);
    const targetOpacity = Number(ZenLibrary.#TOOLBOX_OPEN_OPACITY);
    gNavToolbox.style.setProperty(
      "transform",
      `scale(${1 - p * 0.04})`,
      "important"
    );
    gNavToolbox.style.setProperty(
      "opacity",
      String(1 - p * (1 - targetOpacity)),
      "important"
    );
    lazy.appContentWrapper.style.setProperty(
      "transform",
      `translateX(${p * (instance._swipeWrapperTargetPx ?? 0)}px)`,
      "important"
    );
    instance._swipeProgress = p;
  }

  /**
   * Finish a swipe gesture. If `targetOpen` is true, animate the remaining
   * distance to fully open; otherwise animate to fully closed and dispose
   * the instance like a normal close.
   *
   * @param {boolean} targetOpen
   */
  static async finishSwipe(targetOpen) {
    const instance = gZenLibraryInstance;
    if (!instance?._swipeActive) {
      return;
    }
    instance._swipeActive = false;

    const libFromTransform = instance.style.transform;
    const libFromOpacity = instance.style.opacity;
    const tbFromTransform = gNavToolbox.style.transform;
    const tbFromOpacity = gNavToolbox.style.opacity;
    const wrapperFromX = new DOMMatrix(lazy.appContentWrapper.style.transform)
      .m41;

    // Hand off styling to WAAPI by clearing the inline styles we set during
    // the swipe; the keyframes restore the from-state on their first frame.
    instance.style.transform = "";
    instance.style.opacity = "";
    gNavToolbox.style.transform = "";
    gNavToolbox.style.opacity = "";
    lazy.appContentWrapper.style.transform = "";

    if (targetOpen) {
      instance.setAttribute("open", "true");
      gNavToolbox.setAttribute("zen-library-open", "true");
      instance.#animate(instance, [
        { transform: libFromTransform, opacity: libFromOpacity },
        { transform: "translateX(0)", opacity: 1 },
      ]);
      instance.#animate(gNavToolbox, [
        { transform: tbFromTransform, opacity: tbFromOpacity },
        {
          transform: ZenLibrary.#TOOLBOX_OPEN_TRANSFORM,
          opacity: ZenLibrary.#TOOLBOX_OPEN_OPACITY,
        },
      ]);
      const wrapperAnim = instance.#animate(lazy.appContentWrapper, [
        { transform: `translateX(${wrapperFromX}px)` },
        { transform: `translateX(${instance._swipeWrapperTargetPx}px)` },
      ]);
      try {
        await wrapperAnim.finished;
        if (instance.isOpen) {
          wrapperAnim.commitStyles();
          wrapperAnim.cancel();
          instance.#activeAnimations.delete(wrapperAnim);
        }
      } catch {
        /* cancelled by a follow-up toggle */
      }
    } else {
      instance.removeAttribute("open");
      gNavToolbox.removeAttribute("zen-library-open");
      instance.#animate(instance, [
        { transform: libFromTransform, opacity: libFromOpacity },
        { transform: "translateX(-100%)", opacity: 0 },
      ]);
      instance.#animate(gNavToolbox, [
        { transform: tbFromTransform, opacity: tbFromOpacity },
        { transform: "scale(1)", opacity: 1 },
      ]);
      instance.#animate(lazy.appContentWrapper, [
        { transform: `translateX(${wrapperFromX}px)` },
        { transform: "translateX(0)" },
      ]);
      if (!instance._deletionIdleCallbackId) {
        instance._deletionIdleCallbackId = requestIdleCallback(() => {
          ZenLibrary.clearInstance();
        });
      }
    }
  }

  async #animateClose() {
    this.#animating = true;
    try {
      this.#cancelActiveAnimations();
      const wrapperCurrent =
        lazy.appContentWrapper.style.transform ||
        getComputedStyle(lazy.appContentWrapper).transform ||
        "translateX(0)";
      lazy.appContentWrapper.style.transform = "";

      const libAnim = this.#animate(this, [
        { transform: "translateX(0)", opacity: 1 },
        { transform: "translateX(-100%)", opacity: 0 },
      ]);
      this.#animate(gNavToolbox, [
        {
          transform: ZenLibrary.#TOOLBOX_OPEN_TRANSFORM,
          opacity: ZenLibrary.#TOOLBOX_OPEN_OPACITY,
        },
        { transform: "scale(1)", opacity: 1 },
      ]);
      this.#animate(lazy.appContentWrapper, [
        { transform: wrapperCurrent },
        { transform: "translateX(0)" },
      ]);

      try {
        await libAnim.finished;
      } catch {
        // Cancelled by a follow-up open before the slide finished.
        return;
      }
      // If the user re-opened in the meantime, leave the live instance alone.
      if (this.isOpen) {
        return;
      }
      if (!this._deletionIdleCallbackId) {
        this._deletionIdleCallbackId = requestIdleCallback(() => {
          ZenLibrary.clearInstance();
        });
      }
    } finally {
      this.#animating = false;
    }
  }
}

customElements.define("zen-library", ZenLibrary);
