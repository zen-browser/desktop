/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { html } from "chrome://global/content/vendor/lit.all.mjs";
import { MozLitElement } from "chrome://global/content/lit-utils.mjs";

ChromeUtils.defineLazyGetter(lazy, "l10n", function () {
  return new Localization(["browser/zen-library.ftl"], true);
});

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
  #libraryOnRight = false;

  set openProgress(value) {
    const p = value;
    this.#progress = p;

    let webOffset = this.#libraryOnRight ? -150 : 150;

    this.style.setProperty("--library-progress", String(p));
    lazy.appContentWrapper?.style.setProperty("--library-wrapper-target-px", `${webOffset}px`);
    lazy.appContentWrapper?.style.setProperty("--library-progress", String(p));
    gNavToolbox?.style.setProperty("--library-progress", String(p));

    if (p > 0) {
      this.setAttribute("open", "true");
    } else if (p <= 0) {
      this.removeAttribute("open");
    }
  }

  get openProgress() {
    return this.#progress;
  }

  static toggle() {
    const lib = this.getInstance();
    lib._springTarget = lib._springAnimating
      ? lib._springTarget === 1
        ? 0
        : 1
      : lib.hasAttribute("open")
        ? 0
        : 1;
    
    if (lib._springControls) {
      lib._springControls.stop();
    }

    lib._springControls = lazy.motion.animate(lib.openProgress, lib._springTarget, {
      type: "spring",
      stiffness: 630,
      damping: 47,
      mass: 1.3,
      onUpdate: (latest) => {
        lib.openProgress = latest;
        lib._springControls = null;
      }
    })
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new ZenLibrary();
      const mountRoot = document.documentElement || document.body;
      mountRoot.appendChild(this.instance);

      this.instance.addTabsOnRightListener();
    }
    return this.instance;
  }

  addTabsOnRightListener() {
    const update = value => {
      this.#libraryOnRight = value;
      if (value) {
        this.setAttribute("right", "");
      } else {
        this.removeAttribute("right");
      }
    };

    const prefObserver = (subject, topic, prefName) => {
      if (prefName === "zen.tabs.vertical.right-side") {
        const isRightSide = Services.prefs.getBoolPref(prefName);
        update(isRightSide);
      }
    };

    update(Services.prefs.getBoolPref("zen.tabs.vertical.right-side"));
    Services.prefs.addObserver("zen.tabs.vertical.right-side", prefObserver);
  }

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    if (super.connectedCallback) {
      super.connectedCallback();
    }
    this._onDocClick = this._onDocClick.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    document.addEventListener("click", this._onDocClick, true);
    document.addEventListener("keydown", this._onKeyDown, true);
  }

  disconnectedCallback() {
    if (this._springFrameId !== undefined) {
      cancelAnimationFrame(this._springFrameId);
      this._springFrameId = undefined;
    }
    this._springAnimationId = (this._springAnimationId ?? 0) + 1;
    this._springAnimating = false;
    if (super.disconnectedCallback) {
      super.disconnectedCallback();
    }
    document.removeEventListener("click", this._onDocClick, true);
    document.removeEventListener("keydown", this._onKeyDown, true);
  }

  _onDocClick(e) {
    if (!this.hasAttribute("open")) {
      return;
    }
    const panel = this.querySelector("#zen-library-panel");
    if (panel && !panel.contains(e.target)) {
      ZenLibrary.toggle();
    }
  }

  _onKeyDown(e) {
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
      <link rel="stylesheet" href="chrome://browser/content/zen-styles/zen-library.css" />
      <div id="zen-library-panel">
        <div id="zen-library-side">
          <toolbar id="zen-library-footer" class="chromeclass-location" mode="icons" fullscreentoolbar="true"></toolbar>
        </div>
        <div id="zen-library-content">
        </div>
      </div>
    `;
  }
}

customElements.define("zen-library", ZenLibrary);