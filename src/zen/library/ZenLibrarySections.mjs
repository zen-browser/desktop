// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { html } from "chrome://global/content/vendor/lit.all.mjs";
import { MozLitElement } from "chrome://global/content/lit-utils.mjs";

let lazy = {};

ChromeUtils.defineLazyGetter(lazy, "l10n", function () {
  return new Localization(
    ["browser/zen-library.ftl"],
    true
  );
});

class LibrarySection extends MozLitElement {
  static largeContent = false;

  static get id() {
    throw new Error("Unimplemented");
  }

  static get label() {
    throw new Error("Unimplemented");
  }
}

class SearchSection extends LibrarySection {
  static properties = {
    searchTerm: { type: String },
  };

  connectedCallback() {
    this.searchTerm = "";
    super.connectedCallback();
  }

  _onSearchInput(event) {
    this.searchTerm = event.target.value;
    this.requestUpdate();
  }

  renderSearchResults() {
    return html`${this.searchTerm}`;
  }

  render() {
    return html`
      <link rel="stylesheet" href="chrome://browser/content/zen-styles/zen-library.css" />
      <hbox class="search-section">
        <image src="chrome://browser/skin/zen-icons/search-glass.svg" />
        <input
          class="search-input"
          type="search"
          placeholder=${lazy.l10n.formatValueSync("library-search-placeholder")}
          @input=${this._onSearchInput}
          .value=${this.searchTerm}
        />
      </hbox>
      <div class="search-results">
        ${this.renderSearchResults()}
      </div>
    `;
  }
}

export const ZenLibrarySections = {
  history: class extends SearchSection {
    static id = "history";
    static label = "library-history-section-title";
  },
  downloads: class extends SearchSection {
    static id = "downloads";
    static label = "library-downloads-section-title";
  },
  spaces: class extends LibrarySection {
    static largeContent = true;
    static id = "spaces";
    static label = "library-spaces-section-title";
  },
};

for (const section of Object.values(ZenLibrarySections)) {
  customElements.define(`zen-library-section-${section.id}`, section)
  ;
}
