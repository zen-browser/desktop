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

  #canSwipe = false;
  #isOpen = false;

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
    // Due to calculation inaccuracies assume
    // that openProgress never goes back to 0
    return lib.openProgress > 0.001;
  }

  set isHidden(value) {
    this.requestUpdate();
    this.hidden = value;
  }

  set activeTab(value) {
    if (this._activeTab === value) {
      return;
    }
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
    const p = value;
    const stealWindowButtonsPastPoint = 0.6;
    const wasOpen = this.#progress > 0.001;
    this.#progress = p;
    const isPastWindowButtonSwitchPoint = p > stealWindowButtonsPastPoint;
    const isOpen = p > 0.001;

    if (this.#stylesLoaded) {
      let libraryWidth =
        window.windowUtils.getBoundsWithoutFlushing(this).width;
      const compactModeOffsetDirection = this.#libraryOnRight
        ? -this.#toolboxWidth
        : this.#toolboxWidth;
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
      } else {
        const toolboxScale = 1 - toolboxProgress * 0.04;
        const toolboxOpacity = 1 - toolboxProgress;
        gNavToolbox?.style.setProperty("transform", `scale(${toolboxScale})`);
        gNavToolbox?.style.setProperty("opacity", `${toolboxOpacity}`);
      }
    }

    if (isOpen && !wasOpen) {
      this.setAttribute("open", "true");
      document
        .getElementById("zen-sidebar-splitter")
        .setAttribute("zen-library-open", "true");
      this.#init();
    } else if (!isOpen && wasOpen) {
      this.removeAttribute("open");
      this.#mounted = new Set([this.activeTab]);
      this.requestUpdate();
      document
        .getElementById("zen-sidebar-splitter")
        .removeAttribute("zen-library-open");
      this.#cleanup();
    }

    if (isPastWindowButtonSwitchPoint && this.#coversWindowButtons) {
      this.#adoptWindowButtons();
    } else if (!isPastWindowButtonSwitchPoint) {
      this.#restoreWindowButtons();
    }
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

  #idleCleanup = null;

  #scheduleIdleCleanup() {
    this.#idleCleanup = window.requestIdleCallback(() => {
      this.#idleCleanup = null;
      this.#stylesLoaded = null;

      this.#contentMounted = false;
      this.#mounted = new Set([this.activeTab]);
      this.requestUpdate();
    });
  }

  #cancelIdleCleanup() {
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
    lib.#cancelIdleCleanup();
    await lib.#whenStylesLoaded();
    lib.style.visibility = "";
    await window.promiseDocumentFlushed(() => {});

    if (lib.#springControls) {
      lib.#springControls.stop();
      lib.#springControls = null;
    }

    if (target === 1) {
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
          lib.openProgress = target;
          lib.#springControls = null;
          lib.removeAttribute("transitioning");
          if (target === 0) {
            lib.#mounted = new Set([lib.activeTab]);
            lib.requestUpdate();
            lib.#scheduleIdleCleanup();
          }
        },
      }
    );
  }

  static async startSwipe() {
    const lib = this.getInstance();
    lib.#cancelIdleCleanup();
    lib.#canSwipe = true;
    await lib.#whenStylesLoaded();
    lib.style.visibility = "";
    await window.promiseDocumentFlushed(() => {});

    lib.#onOpenLibrary();

    if (lib.#springControls) {
      lib.#springControls.stop();
      lib.#springControls = null;
    }

    lib.style.setProperty("pointer-events", "none");
  }

  static stopSwipe(direction) {
    const lib = this.getInstance();
    lib.style.setProperty("pointer-events", "unset");
    lib.#canSwipe = false;

    if (lib.#libraryOnRight) {
      direction = direction * -1;
    }

    if (direction) {
      const target = Math.max(-direction, 0);
      this.animateProgress(target);
    }

    // Return library open state
    return lib.#isOpen;
  }

  static swipeProgress(target) {
    const lib = this.getInstance();
    if (!lib.#canSwipe) {
      return;
    }

    lib.openProgress = target;
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
    if (!this.#contentMounted) {
      this.#contentMounted = true;
      this.requestUpdate();
    }

    gURLBar.view.close();
    // Get the width from the css property,
    // getBoundsWithoutFlushing will fail as it takes the
    // toolbox transformation during the animation into account
    this.#toolboxWidth = parseFloat(
      gNavToolbox.style
        .getPropertyValue("--actual-zen-sidebar-width")
        .replace("/\D/g", "")
    );
    if (document.documentElement.hasAttribute("zen-sidebar-expanded")) {
      this.#toolboxWidth += window.windowUtils.getBoundsWithoutFlushing(
        document.getElementById("zen-sidebar-splitter")
      ).width;
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
    this.#cancelIdleCleanup();
    if (this.#springControls) {
      this.#springControls.stop();
      this.#springControls = null;
    }

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
