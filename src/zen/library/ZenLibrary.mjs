// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { html } from "chrome://global/content/vendor/lit.all.mjs";
import { MozLitElement } from "chrome://global/content/lit-utils.mjs";

let gZenLibraryInstance = null;

/**
 * The ZenLibrary class is responsible for managing the UI for the library feature.
 * This feature allows users to view and manage their browsing history, downloads,
 * spaces, and other related data in a unified interface.
 */
export class ZenLibrary extends MozLitElement {
  #initialized = false;

  static properties = {
    activeTab: { type: String },
  };

  static queries = {
    content: "#zen-library-content",
    tabs: { all: "#zen-library-sidebar-tabs > .library-tab" },
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
    this.#initialized = true;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("keydown", this);
    this.#initialized = false;
  }

  render() {
    return html`
      <link rel="stylesheet" href="chrome://browser/content/zen-styles/zen-library.css" />
      <hbox>
        <vbox id="zen-library-sidebar">
          <vbox id="zen-library-sidebar-header"></vbox>
          <vbox id="zen-library-sidebar-tabs"></vbox>
          <vbox id="zen-library-sidebar-footer"></vbox>
        </vbox>
        <vbox id="zen-library-content"> test </vbox>
      </hbox>
    `;
  }

  handleEvent() {
    // Handle events related to the library UI here
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
      gZenLibraryInstance.remove();
      gZenLibraryInstance = null;
    }
  }

  static toggle() {
    let instance = this.getInstance();
    instance.toggleAttribute("open");
  }
}

customElements.define("zen-library", ZenLibrary);
