// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { html } from "chrome://global/content/vendor/lit.all.mjs";
import { MozLitElement } from "chrome://global/content/lit-utils.mjs";

let lazy = {};
let gZenLibraryInstance = null;

ChromeUtils.defineESModuleGetters(lazy, {
  ZenLibrarySections: "moz-src:///zen/library/ZenLibrarySections.mjs",
}, { global: "current" });

ChromeUtils.defineLazyGetter(lazy, "l10n", function () {
  return new Localization(
    ["browser/zen-library.ftl"],
    true
  );
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
  #initialized = false;
  #resizeObserver = null;
  _deletionIdleCallbackId = null;

  static properties = {
    activeTab: { type: String },
  };

  static queries = {
    _content: "#zen-library-content",
    _tabs: { all: "#zen-library-sidebar-tabs > .library-tab" },
  };

  constructor() {
    super();
    this.activeTab = "history";
  }

  connectedCallback() {
    super.connectedCallback();
    if (this.#initialized) {
      return;
    }
    window.addEventListener("keydown", this);
    // Add connected call back and make `appContentWrapper` transform translate the oposite of this element
    this.#resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        let width = window.windowUtils.getBoundsWithoutFlushing(this).width;
        if (gZenVerticalTabsManager._prefsRightSide) {
          width = -width;
        }
        lazy.appContentWrapper.style.transform = `translateX(${width}px)`;
      });
    });
    this.#resizeObserver.observe(this);
    this.#initialized = true;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("keydown", this);
    if (this.#resizeObserver) {
      this.#resizeObserver.disconnect();
      this.#resizeObserver = null;
    }
    this.#initialized = false;
  }

  render() {
    return html`
      <link rel="stylesheet" href="chrome://browser/content/zen-styles/zen-library.css" />
      <vbox id="zen-library-sidebar">
        <vbox id="zen-library-sidebar-header"></vbox>
        <vbox id="zen-library-sidebar-tabs">
          ${Object.values(lazy.ZenLibrarySections).map(
            Section => html`
              <vbox
                class="zen-library-tab"
                ?active=${this.activeTab === Section.id}
                @click=${() => this.activeTab = Section.id}
              >
                <label>${lazy.l10n.formatValueSync(Section.label)}</label>
              </vbox>
            `
          )}
        </vbox>
        <vbox id="zen-library-sidebar-footer"></vbox>
      </vbox>
      <vbox id="zen-library-content" flex="1" ?large-content=${lazy.ZenLibrarySections[this.activeTab].largeContent}>
        
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
    }
  }

  get isOpen() {
    return this.hasAttribute("open");
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
    window.docShell.treeOwner.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIAppWindow).rollupAllPopups();
    let instance = this.getInstance();
    instance.toggleAttribute("open");
    if (!instance.isOpen) {
      gNavToolbox.style.display = "";
      lazy.appContentWrapper.style.transform = "";
      if (!instance._deletionIdleCallbackId) {
      instance._deletionIdleCallbackId = requestIdleCallback(() => {
        this.clearInstance();
      });
      }
    } else {
      if (instance._deletionIdleCallbackId) {
        cancelIdleCallback(instance._deletionIdleCallbackId);
        instance._deletionIdleCallbackId = null;
      }
      gNavToolbox.style.display = "none";
    }
  }
}

customElements.define("zen-library", ZenLibrary);
