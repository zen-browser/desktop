/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { html } from "chrome://global/content/vendor/lit.all.mjs";
import { MozLitElement } from "chrome://global/content/lit-utils.mjs";

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
  #progress = 0;

  #springTarget = 0;
  #springControls = null;

  #toolboxWidth = 0;

  #originalButtonsClone = null;
  #originalButtonsNextSibling = null;

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
      history: lazy.ZenLibraryHistorySection,
      downloads: lazy.ZenLibraryDownloadsSection,
      boosts: lazy.ZenLibraryBoostsSection,
      spaces: lazy.ZenLibrarySpacesSection,
    };
    const lastTab = Services.prefs.getStringPref(LAST_TAB_PREF, "history");
    this.activeTab = lastTab in this.zenLibrarySections ? lastTab : "history";
  }

  set activeTab(value) {
    if (this._activeTab === value) {
      return;
    }
    this._activeTab = value;
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
    const wasPastWindowButtonSwitchPoint =
      this.#progress > stealWindowButtonsPastPoint;
    const wasOpen = this.#progress > 0;
    this.#progress = p;
    const isPastWindowButtonSwitchPoint = p > stealWindowButtonsPastPoint;
    const isOpen = p > 0;

    let libraryWidth = window.windowUtils.getBoundsWithoutFlushing(this).width;
    let webOffset =
      (this.#libraryOnRight ? -1 : 1) * (libraryWidth - this.#toolboxWidth);

    lazy.appContentWrapper?.style.setProperty(
      "--library-wrapper-target-px",
      `${webOffset}px`
    );
    [this, lazy.appContentWrapper, gNavToolbox].forEach(elem => {
      elem?.style.setProperty("--library-progress", String(p));
    });

    if (isOpen && !wasOpen) {
      this.setAttribute("open", "true");
    } else if (!isOpen && wasOpen) {
      this.removeAttribute("open");
    }

    if (isPastWindowButtonSwitchPoint && !wasPastWindowButtonSwitchPoint) {
      this.#adoptWindowButtons();
    } else if (
      !isPastWindowButtonSwitchPoint &&
      wasPastWindowButtonSwitchPoint
    ) {
      this.#restoreWindowButtons();
    }
  }

  get openProgress() {
    return this.#progress;
  }

  #adoptWindowButtons() {
    const realButtons = gZenVerticalTabsManager.actualWindowButtons;
    if (!this.#originalButtonsClone) {
      this.#originalButtonsClone = realButtons.cloneNode(true);
      this.#originalButtonsNextSibling = realButtons.nextSibling;
    }

    this._header.appendChild(realButtons);
    this.#originalButtonsNextSibling.before(this.#originalButtonsClone);
  }

  #restoreWindowButtons() {
    const realButtons = gZenVerticalTabsManager.actualWindowButtons;
    if (!this.#originalButtonsClone) {
      return;
    }

    this.#originalButtonsNextSibling.before(realButtons);
    this.#originalButtonsClone.remove();
    this.#originalButtonsClone = null;
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
      ZenLibrary.instance = null;
      this.remove();
    });
  }

  #cancelIdleCleanup() {
    if (this.#idleCleanup) {
      window.cancelIdleCallback(this.#idleCleanup);
      this.#idleCleanup = null;
    }
  }

  static async toggle() {
    const lib = this.getInstance();
    lib.#cancelIdleCleanup();
    await lib.#whenStylesLoaded();
    lib.style.visibility = "";
    await window.promiseDocumentFlushed(() => {});
    lib.#springTarget = lib.#springTarget === 1 ? 0 : 1;

    if (lib.hasAttribute("transitioning")) {
      return;
    }

    if (lib.#springTarget === 1) {
      gURLBar.view.close();
      lib.#toolboxWidth =
        window.windowUtils.getBoundsWithoutFlushing(gNavToolbox).width;
      if (document.documentElement.hasAttribute("zen-sidebar-expanded")) {
        lib.#toolboxWidth += window.windowUtils.getBoundsWithoutFlushing(
          document.getElementById("zen-sidebar-splitter")
        ).width;
      }
    }

    lib.setAttribute("transitioning", "true");
    lib.#springControls = gZenUIManager.motion.animate(
      lib.openProgress,
      lib.#springTarget,
      {
        type: "spring",
        stiffness: 720,
        damping: 47,
        mass: 1.2,
        onUpdate: latest => {
          lib.openProgress = latest;
        },
        onComplete: () => {
          lib.openProgress = lib.#springTarget;
          lib.#springControls = null;
          lib.removeAttribute("transitioning");
          if (lib.#springTarget === 0) {
            lib.#scheduleIdleCleanup();
          }
        },
      }
    );
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new ZenLibrary();
      this.instance.style.visibility = "collapse";
      const mountRoot = document.getElementById("zen-main-app-wrapper");
      mountRoot.prepend(this.instance);
    }
    return this.instance;
  }

  get #libraryOnRight() {
    return gZenVerticalTabsManager._prefsRightSide;
  }

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    if (super.connectedCallback) {
      super.connectedCallback();
    }
    this.onKeyDown = this.onKeyDown.bind(this);
    document.addEventListener("keydown", this.onKeyDown, true);
  }

  disconnectedCallback() {
    this.#cancelIdleCleanup();
    if (this.#springControls) {
      this.#springControls.stop();
      this.#springControls = null;
    }

    this.#restoreWindowButtons();

    super.disconnectedCallback();
    document.removeEventListener("keydown", this.onKeyDown, true);
  }

  onKeyDown(e) {
    if (!this.hasAttribute("open")) {
      return;
    }
    if (e.key === "Escape") {
      ZenLibrary.toggle();
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
        command: () => ZenLibrary.toggle(),
      },
      {
        image: "chrome://browser/skin/zen-icons/heart-circle-fill.svg",
        command: () => {
          window.openTrustedLinkIn("https://www.zen-browser.app/donate", "tab");
          ZenLibrary.toggle();
        },
      },
    ];

    for (const { image, command } of buttons) {
      const button = document.createXULElement("toolbarbutton");
      button.className = "toolbarbutton-1";
      button.setAttribute("image", image);
      button.addEventListener("command", command);
      footer.appendChild(button);
    }
  }

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
                      this.#animateTabIcon(event.currentTarget);
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
          ${this.activeSection.render(this)}
        </vbox>
      </hbox>
    `;
  }
}

customElements.define("zen-library", ZenLibrary);
