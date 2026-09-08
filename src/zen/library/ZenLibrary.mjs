/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { html } from "chrome://global/content/vendor/lit.all.mjs";
import { MozLitElement } from "chrome://global/content/lit-utils.mjs";

let lazy = {};

ChromeUtils.defineLazyGetter(lazy, "appContentWrapper", function () {
  return document.getElementById("zen-appcontent-wrapper");
});

ChromeUtils.defineLazyGetter(lazy, "motion", () => {
  Services.scriptloader.loadSubScript(
    "chrome://browser/content/zen-vendor/motion.min.mjs",
    window
  );
  const motion = window.Motion;
  delete window.Motion;
  return motion;
});

export class ZenLibrary extends MozLitElement {
  static instance = null;
  #progress = 0;

  #springTarget = 0;
  #springControls = null;

  #originalButtonsParent = null;
  #originalButtonsNextSibling = null;

  static queries = {
    _content: "#zen-library-content",
    _header: "#zen-library-header",
    _footer: "#zen-library-footer",
  };

  set openProgress(value) {
    const p = value;
    const stealWindowButtonsPastPoint = 0.95;
    const wasPastWindowButtonSwitchPoint =
      this.#progress > stealWindowButtonsPastPoint;
    const wasOpen = this.#progress > 0;
    this.#progress = p;
    const isPastWindowButtonSwitchPoint = p > stealWindowButtonsPastPoint;
    const isOpen = p > 0;

    // TODO: Change from arbitrary value to actual
    let webOffset = this.#libraryOnRight ? -150 : 150;

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

    // Window buttons
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
    const realButtons = gZenVerticalTabsManager?.actualWindowButtons;
    if (!realButtons) {
      return;
    }

    if (!this.#originalButtonsParent) {
      this.#originalButtonsParent = realButtons.parentNode;
      this.#originalButtonsNextSibling = realButtons.nextSibling;
    }

    this._header.appendChild(realButtons);
  }

  #restoreWindowButtons() {
    const realButtons = gZenVerticalTabsManager?.actualWindowButtons;
    if (!realButtons || !this.#originalButtonsParent) {
      return;
    }

    this.#originalButtonsParent.insertBefore(
      realButtons,
      this.#originalButtonsNextSibling
    );
  }

  static toggle() {
    const lib = this.getInstance();
    lib.#springTarget = lib.#springTarget === 1 ? 0 : 1;

    if (lib.#springControls) {
      lib.#springControls.stop();
    }

    lib.#springControls = lazy.motion.animate(
      lib.openProgress,
      lib.#springTarget,
      {
        type: "spring",
        stiffness: 630,
        damping: 47,
        mass: 1.3,
        onUpdate: latest => {
          lib.openProgress = latest;
        },
        onComplete: () => {
          lib.openProgress = lib.#springTarget;
          lib.#springControls = null;
        },
      }
    );
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new ZenLibrary();
      const mountRoot = document.documentElement || document.body;
      mountRoot.appendChild(this.instance);
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
    if (this.#springControls) {
      this.#springControls.stop();
      this.#springControls = null;
    }

    // Restore button pos before library is destroyed
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
        command: () => ZenLibrary.toggle(),
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

  render() {
    return html`
      <link
        rel="stylesheet"
        href="chrome://browser/content/zen-styles/zen-library.css"
      />
      <hbox id="zen-library-panel">
        <vbox id="zen-library-side">
          <vbox id="zen-library-header"></vbox>
          <toolbar
            id="zen-library-footer"
            class="chromeclass-location"
            mode="icons"
            fullscreentoolbar="true"
          ></toolbar>
        </vbox>
        <vbox id="zen-library-content"> </vbox>
      </hbox>
    `;
  }
}

customElements.define("zen-library", ZenLibrary);
