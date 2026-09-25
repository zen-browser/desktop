/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import {
  html,
  nothing,
  repeat,
} from "chrome://global/content/vendor/lit.all.mjs";
import { MozLitElement } from "chrome://global/content/lit-utils.mjs";

const { ZenLibraryWidget } = ChromeUtils.importESModule(
  "moz-src:///zen/library/ZenLibraryWidget.sys.mjs"
);

let lazy = {};

ChromeUtils.defineESModuleGetters(
  lazy,
  {
    ZenLibraryHistorySection:
      "moz-src:///zen/library/sections/ZenLibraryHistorySection.mjs",
    ZenLibraryDownloadsSection:
      "moz-src:///zen/library/sections/ZenLibraryDownloadsSection.mjs",
    ZenLibraryBoostsSection:
      "moz-src:///zen/library/sections/ZenLibraryBoostsSection.mjs",
    ZenLibraryMediaSection:
      "moz-src:///zen/library/sections/ZenLibraryMediaSection.mjs",
    ZenLibrarySpacesSection:
      "moz-src:///zen/library/sections/ZenLibrarySpacesSection.mjs",
  },
  { global: "current" }
);

const LAST_TAB_PREF = "zen.library.last-tab";
const CLEANUP_DELAY_MS = 30000;

ChromeUtils.defineLazyGetter(lazy, "appContentWrapper", function () {
  return document.getElementById("zen-appcontent-wrapper");
});

export class ZenLibrary extends MozLitElement {
  static instance = null;
  #contentMounted = true;
  #mounted = new Set();
  #progress = 0;

  #springControls = null;

  #toolboxWidth = 0;

  #originalButtonsNextSibling = null;

  get #hasAdoptedButtons() {
    return this.#originalButtonsNextSibling !== null;
  }

  #shouldUnfreezeSwipe = false;
  #canSwipe = false;
  #beforeSwipeState = 0;
  #isOpen = false;
  #initialized = false;

  #wrapperGestureControl = null;
  #gestureControl = null;

  #resizeObserver = new ResizeObserver(() => {
    this.openProgress = this.#progress;
  });

  static queries = {
    _content: "#zen-library-content",
    _header: "#zen-library-header",
    _footer: "#zen-library-footer",
  };

  static properties = {
    _activeTab: { type: String },
  };

  constructor() {
    super();
    this.zenLibrarySections = {
      media: lazy.ZenLibraryMediaSection,
      downloads: lazy.ZenLibraryDownloadsSection,
      boosts: lazy.ZenLibraryBoostsSection,
      ...(!window.gZenWorkspaces.privateWindowOrDisabled
        ? {
            spaces: lazy.ZenLibrarySpacesSection,
          }
        : {}),
      history: lazy.ZenLibraryHistorySection,
    };
    const lastTab = Services.prefs.getStringPref(LAST_TAB_PREF, "history");
    this.activeTab = lastTab in this.zenLibrarySections ? lastTab : "history";
    this.#mounted.add(this.activeTab);
    this.#hijackFirefoxCommands();
  }

  static get isLibraryOpen() {
    const lib = this.getInstance();
    return lib.#isOpen;
  }

  static get isLibrarySlightlyOpen() {
    const lib = this.getInstance(/* createIfMissing = */ false);
    if (!lib) {
      return false;
    }
    return lib.openProgress > 0.001;
  }

  static get libraryProgress() {
    const lib = this.getInstance();
    return lib.#progress;
  }

  set isHidden(value) {
    this.requestUpdate();
    this.hidden = value;
  }

  set activeTab(value) {
    if (this._activeTab === value) {
      return;
    }
    this.#refreshToolboxWidth();

    this._activeTab = value;
    this.#mounted.add(value);
    Services.prefs.setStringPref(LAST_TAB_PREF, value);
  }

  get activeTab() {
    return this._activeTab;
  }

  get activeSection() {
    return this.zenLibrarySections[this.activeTab];
  }

  set openProgress(value) {
    let p = value;

    const stealWindowButtonsPastPoint = 0.6;
    this.#progress = p;
    const isPastWindowButtonSwitchPoint = p > stealWindowButtonsPastPoint;

    if (this.#stylesLoaded && p !== 0) {
      let libraryWidth =
        window.windowUtils.getBoundsWithoutFlushing(this).width;
      const compactModeOffsetDirection = this.#libraryOnRight
        ? -this.#toolboxWidth + ZenThemeModifier.elementSeparation
        : this.#toolboxWidth - ZenThemeModifier.elementSeparation;
      const compactModeOffset = this.#isCompactMode
        ? compactModeOffsetDirection
        : 0;

      const leftAligned = this.#libraryOnRight ? -1 : 1;
      let webOffset =
        leftAligned * (libraryWidth - this.#toolboxWidth) + compactModeOffset;

      this.style.setProperty(
        "transform",
        `translateX(calc(${leftAligned} * -100% * (1 - ${value})))`
      );
      lazy.appContentWrapper?.style.setProperty(
        "transform",
        `translateX(${value * webOffset}px)`
      );

      const toolboxProgress = Math.min(1, value * 1.5);
      if (this.#isCompactMode) {
        if (this.#libraryOnRight) {
          gNavToolbox.style.setProperty(
            "transform",
            `translateX(calc(100% * ${toolboxProgress}))`
          );
        } else {
          gNavToolbox.style.setProperty(
            "transform",
            `translateX(calc(-100% * ${toolboxProgress}))`
          );
        }
        gNavToolbox?.style.removeProperty("opacity");
      } else {
        const toolboxScale = 1 - toolboxProgress * 0.04;
        const toolboxOpacity = 1 - toolboxProgress;
        gNavToolbox?.style.setProperty("transform", `scale(${toolboxScale})`);
        gNavToolbox?.style.setProperty("opacity", `${toolboxOpacity}`);
      }
    }

    if (isPastWindowButtonSwitchPoint && this.#coversWindowButtons) {
      this.#adoptWindowButtons();
    } else if (!isPastWindowButtonSwitchPoint) {
      this.#restoreWindowButtons();
    }
  }

  /**
   * Clears the styles for the library open/close animation
   * to avoid unecessary layer creation
   */
  #clearStyleProperties() {
    lazy.appContentWrapper?.style.removeProperty("transform");
    gNavToolbox?.style.removeProperty("transform");
    gNavToolbox?.style.removeProperty("opacity");
  }

  /**
   * Whether the window buttons sit in the sidebar column the library covers.
   */
  get #coversWindowButtons() {
    if (!gZenVerticalTabsManager.isWindowsStyledButtons) {
      return !this.#libraryOnRight;
    }
    return this.#libraryOnRight && !this.#isCompactMode;
  }

  get openProgress() {
    return this.#progress;
  }

  #hijackFirefoxCommands() {
    document
      .getElementById("Browser:ShowAllHistory")
      .addEventListener("command", event => {
        event.stopPropagation();
        event.stopImmediatePropagation();

        ZenLibrary.toggle("history");
      });
  }

  #adoptWindowButtons() {
    if (this.#hasAdoptedButtons) {
      return;
    }

    const realButtons = gZenVerticalTabsManager.actualWindowButtons;
    if (!this.#originalButtonsNextSibling) {
      this.#originalButtonsNextSibling = {
        isNext: realButtons.nextSibling,
        sibling: realButtons.nextSibling || realButtons.previousSibling,
        clone: realButtons.cloneNode(true),
      };

      this.#originalButtonsNextSibling.clone.classList.add(
        "zen-library-window-buttons-clone"
      );
      if (this.#originalButtonsNextSibling.isNext) {
        this.#originalButtonsNextSibling.sibling.before(
          this.#originalButtonsNextSibling.clone
        );
      } else {
        this.#originalButtonsNextSibling.sibling.after(
          this.#originalButtonsNextSibling.clone
        );
      }

      this._header.appendChild(realButtons);
    }
  }

  #restoreWindowButtons() {
    if (!this.#hasAdoptedButtons) {
      return;
    }

    const realButtons = gZenVerticalTabsManager.actualWindowButtons;
    if (this.#originalButtonsNextSibling) {
      this.#originalButtonsNextSibling.clone.remove();
      if (this.#originalButtonsNextSibling.isNext) {
        this.#originalButtonsNextSibling.sibling.before(realButtons);
      } else {
        this.#originalButtonsNextSibling.sibling.after(realButtons);
      }
      this.#originalButtonsNextSibling = null;
    }
  }

  #stylesLoaded = null;

  #whenStylesLoaded() {
    this.#stylesLoaded ??= this.updateComplete.then(() => {
      const link = this.querySelector("link[rel='stylesheet']");
      if (!link || link.sheet) {
        return undefined;
      }
      return new Promise(resolve => {
        link.addEventListener("load", resolve, { once: true });
        link.addEventListener("error", resolve, { once: true });
      });
    });
    return this.#stylesLoaded;
  }

  #cleanupTimer = null;
  #idleCleanup = null;

  #scheduleIdleCleanup() {
    this.#cancelIdleCleanup();
    this.#cleanupTimer = window.setTimeout(() => {
      this.#cleanupTimer = null;
      this.#idleCleanup = window.requestIdleCallback(() => {
        this.#idleCleanup = null;
        this.#stylesLoaded = null;

        this.#contentMounted = false;
        this.#mounted = new Set([this.activeTab]);
        this.requestUpdate();
      });
    }, CLEANUP_DELAY_MS);
  }

  #cancelIdleCleanup() {
    if (this.#cleanupTimer) {
      window.clearTimeout(this.#cleanupTimer);
      this.#cleanupTimer = null;
    }
    if (this.#idleCleanup) {
      window.cancelIdleCallback(this.#idleCleanup);
      this.#idleCleanup = null;
    }
  }

  /**
   * Opens or closes the library. With a tab id, opens the library on that
   * tab, switches to it if already open on another, or closes if it is
   * already the open one. Without one, plainly toggles open and closed.
   *
   * @param {string?} [tab] - A section id to open on
   */
  static toggle(tab = undefined) {
    if (!Services.prefs.getBoolPref("zen.library.enabled")) {
      return;
    }

    const lib = this.getInstance();
    if (tab && tab in lib.zenLibrarySections) {
      if (lib.#isOpen && lib.activeTab === tab) {
        this.animateProgress(0);
      } else if (lib.#isOpen) {
        lib.activeTab = tab;
      } else {
        lib.activeTab = tab;
        this.animateProgress(1);
      }
      return;
    }
    this.animateProgress(lib.#isOpen ? 0 : 1);
  }

  static async animateProgress(target) {
    const lib = this.getInstance();

    if (target === lib.#progress) {
      return;
    }

    lib.#cancelIdleCleanup();
    await lib.#whenStylesLoaded();
    await window.promiseDocumentFlushed(() => {});

    if (lib.#springControls) {
      lib.#springControls.stop();
      lib.#springControls = null;
    }

    if (target === 1) {
      lib.#init();
      lib.#onOpenLibrary();
      lib.#isOpen = true;
    } else if (target === 0) {
      lib.#isOpen = false;
      lib.#canSwipe = false;
    }

    lib.setAttribute("transitioning", "true");
    lib.#springControls = gZenUIManager.motion.animate(
      lib.openProgress,
      target,
      {
        type: "spring",
        stiffness: 720,
        damping: 47,
        mass: 1.2,
        onUpdate: latest => {
          lib.openProgress = latest;
        },
        onComplete: () => {
          if (target === 0) {
            lib.#cleanup();
          }

          lib.openProgress = target;
          lib.#springControls = null;
          lib.removeAttribute("transitioning");
        },
      }
    );
  }

  #readySwipeLibrary = null;
  static readySwipeOpenLibrary() {
    const lib = this.getInstance();
    if (lib.#readySwipeLibrary) {
      return lib.#readySwipeLibrary;
    }

    const spaces = gZenWorkspaces.getWorkspaces();
    const current = gZenWorkspaces.getActiveWorkspaceFromCache();
    const libraryEnabled = Services.prefs.getBoolPref("zen.library.enabled");
    const libraryOnRight = this.libraryOnRight;

    lib.#readySwipeLibrary =
      spaces.indexOf(current) === (libraryOnRight ? spaces.length - 1 : 0) &&
      libraryEnabled;
    return lib.#readySwipeLibrary;
  }

  static clearReadySwipeLibraryCache() {
    const lib = this.getInstance();
    lib.#readySwipeLibrary = null;
  }

  static async swipeReset() {
    const lib = this.getInstance();
    if (!lib.#shouldUnfreezeSwipe) {
      return;
    }
    lib.#shouldUnfreezeSwipe = false;

    // If a swipe is cancelled and instantly interrupted by a new swipe
    // that doesn't involve library (space switch),
    // which will cancel but not reset the ongoing revert animation,
    // the library will end up stuck.
    // To counteract this, we set the progress manually.
    this.animateProgress(lib.#progress > 0.5 ? 1 : 0);
  }

  static async startSwipe() {
    const lib = this.getInstance();
    lib.#cancelIdleCleanup();
    lib.#canSwipe = true;
    lib.#beforeSwipeState = this.isLibraryOpen ? 1 : 0;

    await lib.#whenStylesLoaded();
    await window.promiseDocumentFlushed(() => {});

    lib.#init();
    lib.#onOpenLibrary();

    if (lib.#springControls) {
      lib.#springControls.stop();
      lib.#springControls = null;
    }

    lib.style.pointerEvents = "none";
    lib.#shouldUnfreezeSwipe = true;
  }

  /**
   * Helper function to create an overshoot /
   * rubber band effect for the swipe interaction.
   *
   * @param {number} offset The amount that overshot
   * @param {number} dimension Reference scale
   * @param {number} constant Rubber constant
   * @returns The damped value
   */
  static #rubberBand(offset, dimension, constant = 0.55) {
    if (offset === 0 || dimension === 0) {
      return 0;
    }
    return (
      dimension *
      (1 - Math.exp(-(Math.abs(offset) * constant) / dimension)) *
      Math.sign(offset)
    );
  }

  static swipeProgress(rawProgress) {
    const lib = this.getInstance();
    if (!lib.#canSwipe) {
      return;
    }

    const DAMPING_DIMENSION = 0.2;
    const RUBBER_BAND_CONSTANT = 0.08;
    const LIBRARY_SWIPE_FULL = 0.8;

    const translation = lib.#libraryOnRight ? -rawProgress : rawProgress;
    const deltaProgress = translation * LIBRARY_SWIPE_FULL;
    const progress = lib.#beforeSwipeState + deltaProgress;

    let progressDamped;
    if (progress < 0) {
      progressDamped =
        0 + this.#rubberBand(progress, DAMPING_DIMENSION, RUBBER_BAND_CONSTANT);
    } else if (progress > 1) {
      progressDamped =
        1 +
        this.#rubberBand(progress - 1, DAMPING_DIMENSION, RUBBER_BAND_CONSTANT);
    } else {
      progressDamped = progress;
    }

    lib.openProgress = progressDamped;
  }

  static stopSwipe(direction) {
    const lib = this.getInstance();

    if (lib.#libraryOnRight) {
      direction = direction * -1;
    }

    const target = Math.max(-direction, 0);
    this.animateProgress(target);
    lib.#endSwipeAction();

    lib.#shouldUnfreezeSwipe = false;

    return lib.#isOpen;
  }

  static swipeAnimationEnd() {
    const lib = this.getInstance();
    lib.#endSwipeAction();
  }

  #endSwipeAction() {
    this.style.pointerEvents = "";
    this.#canSwipe = false;
    this.#beforeSwipeState = null;

    // This will only run if the swipe was
    // cancelled, otherwise cleanup will happen
    // in animateProgress (onComplete)
    if (!ZenLibrary.isLibrarySlightlyOpen) {
      this.#cleanup();
    }
  }

  #attachWrapperToSwipe() {
    if (!this.#wrapperGestureControl) {
      const appWrapper = document.getElementById("zen-main-app-wrapper");
      this.#wrapperGestureControl =
        window.gZenWorkspaces._swipeManager?.attachWorkspaceSwipeGestures(
          appWrapper
        );
    }
  }

  #detachWrapperOfSwipe() {
    if (this.#wrapperGestureControl) {
      const appWrapper = document.getElementById("zen-main-app-wrapper");
      window.gZenWorkspaces._swipeManager?.detachWorkspaceSwipeGestures(
        appWrapper,
        this.#wrapperGestureControl
      );
      this.#wrapperGestureControl = null;
    }
  }

  #onOpenLibrary() {
    this.#cancelIdleCleanup();
    this.style.visibility = "";

    if (!this.#contentMounted) {
      this.#contentMounted = true;
      this.requestUpdate();
    }

    gURLBar.view.close();
    this.#refreshToolboxWidth();
  }

  #refreshToolboxWidth() {
    // Get the width from the css property,
    // getBoundsWithoutFlushing will fail as it takes the
    // toolbox transformation during the animation into account
    this.#toolboxWidth = parseFloat(
      gNavToolbox.style
        .getPropertyValue("--actual-zen-sidebar-width")
        .replace("/\D/g", "")
    );
    if (document.documentElement.hasAttribute("zen-sidebar-expanded")) {
      const splitterWidth = window.windowUtils.getBoundsWithoutFlushing(
        document.getElementById("zen-sidebar-splitter")
      ).width;
      this.#toolboxWidth += splitterWidth;
    }
  }

  static getInstance(createIfMissing = true) {
    if (!this.instance && createIfMissing) {
      this.instance = new ZenLibrary();
      this.instance.style.visibility = "collapse";
      const mountAfter = document.getElementById("navigator-toolbox");
      mountAfter.after(this.instance);
    }
    return this.instance;
  }

  get #libraryOnRight() {
    return gZenVerticalTabsManager._prefsRightSide;
  }

  static get libraryOnRight() {
    const lib = this.getInstance();
    return lib.#libraryOnRight;
  }

  createRenderRoot() {
    return this;
  }

  #init() {
    if (this.#initialized) {
      return;
    }
    this.#initialized = true;

    this.#cancelIdleCleanup();
    if (!this.#contentMounted) {
      this.#contentMounted = true;
      this.requestUpdate();
    }
    this.setAttribute("open", "true");
    document
      .getElementById("zen-sidebar-splitter")
      .setAttribute("zen-library-open", "true");
    document.addEventListener("keydown", this, true);
    window.addEventListener("TabOpen", this);

    this.#attachWrapperToSwipe();
    this.#gestureControl =
      window.gZenWorkspaces._swipeManager.attachWorkspaceSwipeGestures(this);
    this.#resizeObserver.observe(this);
    ZenLibraryWidget.attachLibrary(this);
    this.isHidden = false;
  }

  #cleanup() {
    if (!this.#initialized) {
      return;
    }
    this.#initialized = false;

    this.#clearStyleProperties();
    this.removeAttribute("open");
    this.#mounted = new Set([this.activeTab]);
    this.requestUpdate();
    document
      .getElementById("zen-sidebar-splitter")
      .removeAttribute("zen-library-open");

    if (this.#springControls) {
      this.#springControls.stop();
      this.#springControls = null;
    }
    this.removeAttribute("transitioning");

    this.#detachWrapperOfSwipe();
    if (this.#gestureControl) {
      window.gZenWorkspaces._swipeManager.detachWorkspaceSwipeGestures(
        this,
        this.#gestureControl
      );
    }

    this.#restoreWindowButtons();
    ZenLibraryWidget.detachLibrary(this);
    this.#resizeObserver.disconnect();
    document.removeEventListener("keydown", this, true);
    window.removeEventListener("TabOpen", this);
    this.isHidden = true;
    this.#scheduleIdleCleanup();
  }

  get #isCompactMode() {
    return (
      window.gZenCompactModeManager.preference &&
      (Services.prefs.getBoolPref("zen.view.compact.hide-tabbar") ||
        Services.prefs.getBoolPref("zen.view.use-single-toolbar"))
    );
  }

  handleEvent(e) {
    switch (e.type) {
      case "TabOpen":
        this.onTabOpen();
        break;
      case "keydown":
        this.onKeyDown(e);
        break;
    }
  }

  onTabOpen() {
    if (this.#isOpen) {
      ZenLibrary.animateProgress(0);
    }
  }

  onKeyDown(e) {
    if (!this.hasAttribute("open")) {
      return;
    }
    if (e.key === "Escape") {
      ZenLibrary.animateProgress(0);
    }
  }

  firstUpdated() {
    if (super.firstUpdated) {
      super.firstUpdated();
    }
    this.#buildFooterButtons();
  }

  #buildFooterButtons() {
    const footer = this.querySelector("#zen-library-footer");

    const buttons = [
      {
        image: "chrome://browser/skin/zen-icons/back.svg",
        l10nId: "library-footer-close-button",
        command: () => ZenLibrary.animateProgress(0),
      },
      {
        image: "chrome://browser/skin/zen-icons/heart-circle-fill.svg",
        l10nId: "library-footer-donate-button",
        command: () => {
          window.openTrustedLinkIn("https://www.zen-browser.app/donate", "tab");
          ZenLibrary.animateProgress(0);
        },
      },
    ];

    for (const { image, l10nId, command } of buttons) {
      const button = document.createXULElement("toolbarbutton");
      button.className = "toolbarbutton-1";
      button.setAttribute("image", image);
      button.setAttribute("data-l10n-id", l10nId);
      button.addEventListener("command", command);
      footer.appendChild(button);
    }
  }

  updated(changedProperties) {
    super.updated?.(changedProperties);
    this.#updateMountedSections();
  }

  /**
   * Shows the section being looked at and puts the others out of sight. A
   * section is told which it is, so one that reaches outside itself, such as
   * spaces setting the library's width, only does so while it is on show.
   */
  #updateMountedSections() {
    for (const section of this._content?.children ?? []) {
      const id = section.dataset?.section;
      if (!id) {
        continue;
      }
      const showing = id === this.activeTab;
      const wasShowing = section.hasAttribute("showing");
      section.hidden = !showing;
      section.toggleAttribute("showing", showing);
      if (showing !== wasShowing) {
        (showing ? section.onShown : section.onHidden)?.call(section);
      }
    }
  }

  render() {
    return html`
      <link
        rel="stylesheet"
        href="chrome://browser/content/zen-styles/zen-library.css"
      />
      <hbox id="zen-library-panel">
        <vbox id="zen-library-side">
          <vbox id="zen-library-header"></vbox>
          <vbox id="zen-library-sidebar-tabs">
            ${Object.values(this.zenLibrarySections).map(
              Section => html`
                <vbox
                  class="zen-library-tab"
                  ?active=${this.activeTab === Section.id}
                  data-section=${Section.id}
                  @click=${event => {
                    if (this.activeTab !== Section.id) {
                      this.activeTab = Section.id;
                      const previousTab =
                        event.currentTarget.parentNode.querySelector(
                          `.zen-library-tab[animate="true"]`
                        );
                      if (previousTab) {
                        previousTab.removeAttribute("animate");
                      }
                      event.currentTarget.setAttribute("animate", "true");
                    }
                  }}
                >
                  <div class="zen-library-tab-icon">
                    <div class="zen-library-tab-icon-image"></div>
                  </div>
                  <label data-l10n-id=${Section.label}></label>
                </vbox>
              `
            )}
          </vbox>
          <toolbar
            id="zen-library-footer"
            class="chromeclass-location"
            mode="icons"
            fullscreentoolbar="true"
          ></toolbar>
        </vbox>
        <vbox id="zen-library-content">
          ${
            this.#contentMounted
              ? repeat(
                  [...this.#mounted],
                  id => id,
                  id => this.zenLibrarySections[id].render(this)
                )
              : nothing
          }
        </vbox>
      </hbox>
    `;
  }
}

customElements.define("zen-library", ZenLibrary);
