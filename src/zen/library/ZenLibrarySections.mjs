// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { html } from "chrome://global/content/vendor/lit.all.mjs";
import { MozLitElement } from "chrome://global/content/lit-utils.mjs";

let lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  Downloads: "resource://gre/modules/Downloads.sys.mjs",
  DownloadHistory: "resource://gre/modules/DownloadHistory.sys.mjs",
  DownloadUtils: "resource://gre/modules/DownloadUtils.sys.mjs",
  PlacesQuery: "resource://gre/modules/PlacesQuery.sys.mjs",
});

ChromeUtils.defineLazyGetter(lazy, "l10n", function () {
  return new Localization(["browser/zen-library.ftl"], true);
});

class LibrarySection extends MozLitElement {
  static largeContent = false;

  static get id() {
    throw new Error("LibrarySection subclass must define a static `id`.");
  }

  static get label() {
    throw new Error("LibrarySection subclass must define a static `label`.");
  }
}

class SearchSection extends LibrarySection {
  static properties = {
    searchTerm: { type: String },
    isEmpty: { type: Boolean },
  };

  connectedCallback() {
    this.searchTerm = "";
    this.isEmpty = false;
    super.connectedCallback();
  }

  _onSearchInput(event) {
    this.searchTerm = event.target.value;
    this.requestUpdate();
  }

  renderSearchResults() {
    return html``;
  }

  render() {
    return html`
      <link
        rel="stylesheet"
        href="chrome://browser/content/zen-styles/zen-library.css"
      />
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
      <div class="search-results">${this.renderSearchResults()}</div>
    `;
  }
}

// History section
class ZenLibraryHistorySection extends SearchSection {
  static id = "history";
  static label = "library-history-section-title";

  #placesQuery = null;
  #history = null;

  renderSearchResults() {
    if (this.isEmpty) {
      return html`<div class="empty-state">
        ${lazy.l10n.formatValueSync("library-history-empty")}
      </div>`;
    }
    return html`${this.searchTerm}`;
  }

  async connectedCallback() {
    super.connectedCallback();
    try {
      this.#placesQuery = new lazy.PlacesQuery();
      this.#history = await this.#placesQuery.getHistory();
      this.isEmpty = this.#history.size === 0;
      this.#placesQuery.observeHistory((newHistory) => {
        this.#history = newHistory;
        this.isEmpty = this.#history.size === 0;
        this.requestUpdate();
      });
      this.requestUpdate();
    } catch (ex) {
      console.error("Zen Library: Failed to initialize history section.", ex);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#placesQuery?.close();
    this.#placesQuery = null;
    this.#history = null;
  }
}

// Downloads section
class ZenLibraryDownloadsSection extends SearchSection {
  static id = "downloads";
  static label = "library-downloads-section-title";

  #downloadList = null;
  #downloads = [];
  #downloadsView = null;
  #batchLoading = false;

  renderSearchResults() {
    if (this.isEmpty) {
      return html`<div class="empty-state">
        ${lazy.l10n.formatValueSync("library-downloads-empty")}
      </div>`;
    }
    return html`${this.searchTerm}`;
  }

  async connectedCallback() {
    super.connectedCallback();
    try {
      this.#downloadList = await lazy.DownloadHistory.getList({
        type: lazy.Downloads.PUBLIC,
      });
      this.#downloadsView = {
        onDownloadAdded: (dl) => {
          // During the initial batch replay addView fires onDownloadAdded for
          // every existing download oldest-first, so we push to preserve order.
          // After init, new downloads are unshifted to the front.
          if (this.#batchLoading) {
            this.#downloads.push(dl);
          } else {
            this.#downloads.unshift(dl);
            this.isEmpty = false;
            this.requestUpdate();
          }
        },
        onDownloadBatchEnded: () => {
          this.#batchLoading = false;
          this.isEmpty = this.#downloads.length === 0;
          this.requestUpdate();
        },
        onDownloadChanged: (dl) => {
          this.requestUpdate();
        },
        onDownloadRemoved: (dl) => {
          this.#downloads = this.#downloads.filter((d) => d !== dl);
          this.isEmpty = this.#downloads.length === 0;
          this.requestUpdate();
        },
      };
      this.#batchLoading = true;
      this.#downloadList.addView(this.#downloadsView);
    } catch (ex) {
      console.error("Zen Library: Failed to initialize downloads section.", ex);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.#downloadList && this.#downloadsView) {
      this.#downloadList.removeView(this.#downloadsView);
    }
    this.#downloadList = null;
    this.#downloadsView = null;
    this.#downloads = [];
  }
}

// Spaces section
class ZenLibrarySpacesSection extends LibrarySection {
  static largeContent = true;
  static id = "spaces";
  static label = "library-spaces-section-title";
}

export const ZenLibrarySections = {
  history: ZenLibraryHistorySection,
  downloads: ZenLibraryDownloadsSection,
  spaces: ZenLibrarySpacesSection,
};

for (const Section of Object.values(ZenLibrarySections)) {
  customElements.define(`zen-library-section-${Section.id}`, Section);
}
