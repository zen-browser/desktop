/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { html } from "chrome://global/content/vendor/lit.all.mjs";
import { MozLitElement } from "chrome://global/content/lit-utils.mjs";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  DownloadsCommon:
    "moz-src:///browser/components/downloads/DownloadsCommon.sys.mjs",
  DownloadsViewUI:
    "moz-src:///browser/components/downloads/DownloadsViewUI.sys.mjs",
  DownloadUtils: "resource://gre/modules/DownloadUtils.sys.mjs",
  PlacesUtils: "resource://gre/modules/PlacesUtils.sys.mjs",
});

ChromeUtils.defineLazyGetter(
  lazy,
  "l10n",
  () => new Localization(["browser/zen-library.ftl"], true)
);

const SEARCH_DEBOUNCE_MS = 300;

// Intl singletons (construction is expensive in SpiderMonkey)
const TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  timeStyle: "short",
});
const WEEKDAY_FORMATTER = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
});
const LONG_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "long",
});

/**
 * Base for all library section custom elements.
 * Subclasses must define static `id` and `label`.
 */
class LibrarySection extends MozLitElement {
  static largeContent = false;

  static get id() {
    throw new Error("LibrarySection subclass must define a static `id`.");
  }

  static get label() {
    throw new Error("LibrarySection subclass must define a static `label`.");
  }

  _l10n(key) {
    return lazy.l10n.formatValueSync(key);
  }
}

/**
 * Base class for sections with a search bar and scrollable results list.
 * Subclasses implement renderSearchResults() and override _onSearch().
 */
class SearchSection extends LibrarySection {
  static properties = {
    searchTerm: { type: String },
    inputValue: { type: String },
    isEmpty: { type: Boolean },
    isScrolledToTop: { type: Boolean },
  };

  #canDebug = false;
  #searchTimer = null;

  connectedCallback() {
    // don't wipe a live search term if re-inserted by a parent re-render.
    if (!this.searchTerm) {
      this.searchTerm = "";
    }
    if (this.inputValue === undefined) {
      this.inputValue = this.searchTerm;
    }
    this.isScrolledToTop = true;
    this.isEmpty = false;
    super.connectedCallback();

    XPCOMUtils.defineLazyPreferenceGetter(
      this,
      "#canDebug",
      "zen.library.debug",
      false
    );
  }

  log(...args) {
    if (this.#canDebug) {
      /* eslint-disable no-console */
      console.debug(`[ZenLibrary/${this.constructor.id}]:`, ...args);
      /* eslint-enable no-console */
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearTimeout(this.#searchTimer);
    this.#searchTimer = null;
  }

  _onSearchInput(event) {
    this.inputValue = event.target.value;
    clearTimeout(this.#searchTimer);
    this.#searchTimer = setTimeout(() => {
      this.#searchTimer = null;
      this.searchTerm = this.inputValue;
      this._onSearch(this.searchTerm);
    }, SEARCH_DEBOUNCE_MS);
  }

  _onClearSearch() {
    clearTimeout(this.#searchTimer);
    this.#searchTimer = null;
    this.searchTerm = "";
    this.inputValue = "";
    this.renderRoot.querySelector("#zen-library-search-input")?.focus();
    this._onSearch("");
  }

  _onSearch(_term) {}

  _dayLabel(date) {
    const d = date instanceof Date ? date : new Date(date);
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const dayStart = new Date(d).setHours(0, 0, 0, 0);
    const diffDays = Math.round((todayStart - dayStart) / 86_400_000);
    if (diffDays === 0) {
      return this._l10n("library-history-today");
    }
    if (diffDays === 1) {
      return this._l10n("library-history-yesterday");
    }
    if (diffDays < 7) {
      return WEEKDAY_FORMATTER.format(d);
    }
    return LONG_DATE_FORMATTER.format(d);
  }

  get _searchPlaceholder() {
    return "library-search-placeholder";
  }

  _formatTime(date) {
    if (!date) {
      return "";
    }
    const d = date instanceof Date ? date : new Date(date);
    return TIME_FORMATTER.format(d);
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
      <link rel="localization" href="browser/zen-library.ftl" />
      <div class="search-bar">
        <div class="search-urlbar">
          <div class="search-urlbar-background"></div>
          <div class="search-input-container">
            <img
              class="search-icon"
              src="chrome://browser/skin/zen-icons/search-glass.svg"
              alt=""
            />
            <input
              id="zen-library-search-input"
              class="search-input"
              type="text"
              inputmode="search"
              aria-autocomplete="list"
              data-l10n-id=${this._searchPlaceholder}
              @input=${this._onSearchInput}
              .value=${this.inputValue}
            />
            <button
              class="search-clear-button"
              tabindex="-1"
              @click=${this._onClearSearch}
            >
              <img src="chrome://browser/skin/zen-icons/close.svg" alt="" />
            </button>
          </div>
        </div>
        <button class="search-filter-button">
          <img src="chrome://browser/skin/zen-icons/search-glass.svg" alt="" />
          <label data-l10n-id="library-filter-button"></label>
        </button>
      </div>
      <div
        class="search-results"
        @scroll=${() => {
            const el = this.renderRoot.querySelector(".search-results");
            if (!el) {
              return;
            }
            this.isScrolledToTop = el.scrollTop === 0;
          }}
        ?scrolled-to-top=${this.isScrolledToTop}
      >
        ${this.renderSearchResults()}
      </div>
    `;
  }
}

/**
 * Adds progressive background rendering to SearchSection.
 * Renders the first 50 items immediately, then fills the rest in idle chunks
 * so the main thread stays responsive and the scrollbar tracks correctly.
 */
class ProgressiveSearchSection extends SearchSection {
  _allItems = [];

  #renderedItemCount = 0;
  #renderTask = null;

  _getRenderedSlice() {
    return this._allItems.slice(0, this.#renderedItemCount);
  }

  /** Call when _allItems is fully replaced (new query / search term). */
  _resetProgressiveRender() {
    this.#cancelTask();
    this.#renderedItemCount = Math.min(50, this._allItems.length);
    this.isEmpty = this._allItems.length === 0;
    this.#scheduleNextBatch();
  }

  /** Call when _allItems grows incrementally to avoid resetting scroll position. */
  _maintainProgressiveRender() {
    this.#renderedItemCount = Math.max(
      this.#renderedItemCount,
      Math.min(50, this._allItems.length)
    );
    this.isEmpty = this._allItems.length === 0;
    this.#scheduleNextBatch();
  }

  #scheduleNextBatch() {
    if (this.#renderedItemCount >= this._allItems.length) {
      return;
    }
    this.#renderTask = requestIdleCallback(() => {
      this.#renderTask = null;
      this.#renderedItemCount = Math.min(
        this.#renderedItemCount + 100,
        this._allItems.length
      );
      this.requestUpdate();
      this.#scheduleNextBatch();
    });
  }

  #cancelTask() {
    if (this.#renderTask) {
      cancelIdleCallback(this.#renderTask);
      this.#renderTask = null;
    }
  }

  disconnectedCallback() {
    // Cancel before super so no stale idle callback fires against cleared base state.
    this.#cancelTask();
    this._allItems = [];
    super.disconnectedCallback();
  }
}

/**
 * History section, backed by nsINavHistoryService
 * with a live observer for real-time updates.
 */
class ZenLibraryHistorySection extends ProgressiveSearchSection {
  static id = "history";
  static label = "library-history-section-title";

  /** @type {nsINavHistoryResult|null} */
  #result = null;

  /** @type {object|null} */
  #observer = null;

  /** Suppresses observer-triggered rebuilds during our own tree walk. */
  #walking = false;

  /** Coalesces rapid observer notifications into a single rebuild. */
  #rebuildTimer = null;

  get _searchPlaceholder() {
    return "library-history-search-placeholder";
  }

  async connectedCallback() {
    super.connectedCallback();
    try {
      await this.#init();
    } catch (ex) {
      console.error("[ZenLibrary/History] Failed to initialize:", ex);
    }
  }

  async #init() {
    this.#executeQuery("");
    await this.updateComplete;
    // Element may have been removed while awaiting; #teardownResult already ran.
    if (!this.isConnected) {
      return;
    }
    this.requestUpdate();
  }

  disconnectedCallback() {
    // Teardown before super: a pending #rebuildTimer could otherwise fire
    // #walkAndPopulate against base-class state super is about to clear.
    this.#teardownResult();
    super.disconnectedCallback();
  }

  _onSearch(term) {
    this.#executeQuery(term);
  }

  /** @param {string} searchTerm - empty string for the default chronological view. */
  #executeQuery(searchTerm) {
    this.#teardownResult();

    const NHQO = Ci.nsINavHistoryQueryOptions;
    // eslint-disable-next-line no-shadow
    const history = lazy.PlacesUtils.history;
    const query = history.getNewQuery();
    const options = history.getNewQueryOptions();

    options.sortingMode = NHQO.SORT_BY_DATE_DESCENDING;

    if (searchTerm) {
      query.searchTerms = searchTerm;
      options.includeHidden = true;
      options.maxResults = 500;
      options.resultType = NHQO.RESULTS_AS_URI; // Required by Places when searchTerms is set.
    } else {
      options.maxResults = 2500;
      options.resultType = NHQO.RESULTS_AS_VISIT; // De-duplicated per day in #walkAndPopulate.
    }

    const result = history.executeQuery(query, options);
    this.#observer = this.#createObserver();
    result.addObserver(this.#observer);
    this.#result = result;

    result.root.containerOpen = true; // Triggers the native query and populates children.

    this.#walkAndPopulate();
    this._resetProgressiveRender();
    this.requestUpdate();
  }

  #walkAndPopulate() {
    this.#walking = true;
    try {
      this._allItems = [];

      const root = this.#result?.root;
      if (!root?.containerOpen) {
        return;
      }

      // RESULTS_AS_VISIT produces one node per visit; de-duplicate per day-bucket.
      const seenNodes = new Set();
      for (let i = 0; i < root.childCount; i++) {
        const node = root.getChild(i);
        const date = new Date(node.time / 1000);
        const dayStart = new Date(date).setHours(0, 0, 0, 0);

        const key = `${dayStart}|${node.uri}`;
        if (seenNodes.has(key)) {
          continue;
        }
        seenNodes.add(key);

        this._allItems.push({
          title: node.title,
          url: node.uri,
          date,
        });
      }

      this.log(
        `#walkAndPopulate — ${this._allItems.length} items, search=${!!this.searchTerm}`
      );
    } finally {
      this.#walking = false;
    }
  }

  #createObserver() {
    const rebuild = () => this.#scheduleRebuild();
    return {
      QueryInterface: ChromeUtils.generateQI([
        "nsINavHistoryResultObserver",
        "nsISupportsWeakReference",
      ]),
      skipHistoryDetailsNotifications: true,
      nodeInserted: rebuild,
      nodeRemoved: rebuild,
      nodeTitleChanged: rebuild,
      invalidateContainer: rebuild,
      containerStateChanged() {},
      nodeHistoryDetailsChanged() {},
      nodeTagsChanged() {},
      nodeDateAddedChanged() {},
      nodeLastModifiedChanged() {},
      nodeKeywordChanged() {},
      nodeURIChanged() {},
      nodeIconChanged() {},
      sortingChanged() {},
      nodeMoved() {},
      batching() {},
    };
  }

  #scheduleRebuild() {
    if (this.#walking) {
      return;
    }
    clearTimeout(this.#rebuildTimer);
    this.#rebuildTimer = setTimeout(() => {
      this.#rebuildTimer = null;
      if (!this.#result) {
        return;
      }
      this.#walkAndPopulate();
      this._maintainProgressiveRender();
      this.requestUpdate();
    }, 250);
  }

  #teardownResult() {
    clearTimeout(this.#rebuildTimer);
    this.#rebuildTimer = null;

    if (this.#result) {
      if (this.#observer) {
        this.#result.removeObserver(this.#observer);
        this.#observer = null;
      }
      try {
        this.#result.root.containerOpen = false;
      } catch {
        /* Container may already be closed. */
      }
      this.#result = null;
    }

    this._allItems = [];
  }

  renderSearchResults() {
    if (!this.#result) {
      return html``;
    }
    if (this.isEmpty) {
      return html`
        <div
          class="empty-state"
          data-l10n-id=${this.searchTerm ? "library-search-no-results" : "library-history-empty"}
        ></div>
      `;
    }

    const slice = this._getRenderedSlice();
    this.log(
      `renderSearchResults — ${slice.length}/${this._allItems.length} items`
    );

    const rows = [];
    let lastLabel = null;

    for (const v of slice) {
      const dayLabel = this._dayLabel(v.date);
      if (dayLabel !== lastLabel) {
        lastLabel = dayLabel;
        rows.push(html`
          <label class="library-date-separator"> ${lastLabel} </label>
        `);
      }

      rows.push(html`
        <div class="library-item">
          <div class="library-item-stack">
            <div class="library-item-background"></div>
            <div class="library-item-content">
              <div class="library-item-icon-stack">
                <img
                  class="library-item-icon-image"
                  src="page-icon:${v.url || ""}"
                  alt=""
                  role="presentation"
                />
              </div>
              <div class="library-item-label-container">
                <label class="library-item-label">${v.title || v.url}</label>
                <label class="library-item-sublabel"
                  >${
                  v.url?.replace(/^[\w-]+:\/\//, "").replace(/\/$/, "") || ""
                }</label
                >
              </div>
              <label class="library-item-time"
                >${this._formatTime(v.date)}</label
              >
            </div>
          </div>
        </div>
      `);
    }

    return html`${rows}`;
  }
}

/**
 * Downloads section: date-grouped, progressively-rendered download list.
 * Single additions use binary insertion; batch loads sort once on completion.
 */
class ZenLibraryDownloadsSection extends ProgressiveSearchSection {
  static id = "downloads";
  static label = "library-downloads-section-title";

  #downloadsData = null;
  #allDownloads = [];
  #downloadsView = null;
  #batchLoading = false;

  get _searchPlaceholder() {
    return "library-downloads-search-placeholder";
  }

  connectedCallback() {
    super.connectedCallback();
    try {
      this.#init();
    } catch (ex) {
      console.error("[ZenLibrary/Downloads] Failed to initialize:", ex);
    }
  }

  #init() {
    this.#downloadsData = lazy.DownloadsCommon.getData(window, true);
    this.#setupDownloadsView();
    this.#downloadsData.addView(this.#downloadsView);
  }

  #setupDownloadsView() {
    this.#downloadsView = {
      onDownloadAdded: dl => {
        if (this.#batchLoading) {
          this.#allDownloads.push(dl);
          return;
        }
        this.#insertSorted(dl);
        this.#rebuildItems();
        this._maintainProgressiveRender();
        this.requestUpdate();
      },
      onDownloadBatchStarting: () => {
        this.#batchLoading = true;
      },
      onDownloadBatchEnded: async () => {
        this.#batchLoading = false;
        this.#allDownloads.sort(
          (a, b) => this.#downloadTime(b) - this.#downloadTime(a)
        );
        this.#rebuildItems();
        this.log(
          `batch complete — ${this.#allDownloads.length} downloads loaded`
        );
        await this.updateComplete;
        // Guard: library may have closed while the batch was loading.
        if (!this.isConnected) {
          return;
        }
        this._resetProgressiveRender();
        this.requestUpdate();
      },
      onDownloadChanged: () => {
        this.requestUpdate();
      },
      onDownloadRemoved: dl => {
        const idx = this.#allDownloads.indexOf(dl);
        if (idx !== -1) {
          this.#allDownloads.splice(idx, 1);
          this.#rebuildItems();
          this._maintainProgressiveRender();
          this.requestUpdate();
        }
      },
    };
  }

  disconnectedCallback() {
    // Teardown before super so base-class cleanup doesn't observe nullified state.
    try {
      this.#downloadsData?.removeView(this.#downloadsView);
    } catch (ex) {
      console.error("[ZenLibrary/Downloads] Failed to teardown:", ex);
    }
    this.#downloadsView = null;
    this.#downloadsData = null;
    this.#allDownloads = [];
    super.disconnectedCallback();
  }

  _onSearch(term) {
    this.log(
      `_onSearch — term: "${term}", total: ${this.#allDownloads.length}`
    );
    this.#rebuildItems();
    this._resetProgressiveRender();
    this.requestUpdate();
  }

  renderSearchResults() {
    const slice = this._getRenderedSlice();

    if (this.isEmpty) {
      return html`
        <div
          class="empty-state"
          data-l10n-id=${this.searchTerm ? "library-search-no-results" : "library-downloads-empty"}
        ></div>
      `;
    }

    const groups = this.#groupByDate(slice);
    return html`
      ${Array.from(groups).map(
        ([key, downloads]) => html`
          <label class="library-date-separator">
            ${this._dayLabel(new Date(key))}
          </label>
          ${downloads.map(dl => this.#renderDownloadItem(dl))}
        `
      )}
    `;
  }

  #renderDownloadItem(dl) {
    // getDisplayName may return an {l10n} object for blocked/spam downloads.
    const displayName = lazy.DownloadsViewUI.getDisplayName(dl);
    const nameStr =
      typeof displayName === "string" ? displayName : dl.source.url;
    const iconPath = dl.target.path
      ? `moz-icon://${dl.target.path}?size=16`
      : "moz-icon://.unknown?size=16";

    return html`
      <div class="library-item">
        <div class="library-item-stack">
          <div class="library-item-background"></div>
          <div class="library-item-content">
            <div class="library-item-icon-stack">
              <img
                class="library-item-icon-image"
                src=${iconPath}
                alt=""
                role="presentation"
              />
            </div>
            <div class="library-item-label-container">
              <label class="library-item-label">${nameStr}</label>
              <label class="library-item-sublabel"
                >${this.#getStatusLabel(dl)}</label
              >
            </div>
            <label class="library-item-time">
              ${this._formatTime(this.#downloadTime(dl))}
            </label>
          </div>
        </div>
      </div>
    `;
  }

  #downloadTime(dl) {
    // Fallback to 0 (epoch) keeps binary search comparisons valid.
    return (dl.endTime ?? dl.startTime) || 0;
  }

  /**
   * Binary insertion into #allDownloads (newest-first).
   * O(log N) vs O(N log N) for a full sort on every add.
   *
   * @param {object} dl - Download object from DownloadsCommon.getData()
   */
  #insertSorted(dl) {
    const time = this.#downloadTime(dl);
    let lo = 0;
    let hi = this.#allDownloads.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.#downloadTime(this.#allDownloads[mid]) >= time) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    this.#allDownloads.splice(lo, 0, dl);
  }

  #rebuildItems() {
    const term = this.searchTerm?.trim().toLowerCase();
    if (term) {
      this._allItems = this.#allDownloads.filter(dl =>
        this.#matchesSearchTerm(dl, term)
      );
    } else {
      this._allItems = [...this.#allDownloads];
    }
  }

  #matchesSearchTerm(dl, term) {
    if (!term) {
      return true;
    }
    const displayName = lazy.DownloadsViewUI.getDisplayName(dl);
    const nameStr =
      typeof displayName === "string" ? displayName.toLowerCase() : "";
    const url = (dl.source.originalUrl || dl.source.url || "").toLowerCase();
    return nameStr.includes(term) || url.includes(term);
  }

  #groupByDate(downloads) {
    const groups = new Map();
    for (const dl of downloads) {
      const t = this.#downloadTime(dl);
      if (!t) {
        continue;
      }
      const key = new Date(t).setHours(0, 0, 0, 0);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(dl);
    }
    return groups;
  }

  #getStatusLabel(dl) {
    const strings = lazy.DownloadsCommon.strings;
    const state = lazy.DownloadsCommon.stateOfDownload(dl);

    switch (state) {
      case lazy.DownloadsCommon.DOWNLOAD_DOWNLOADING: {
        const totalBytes = dl.hasProgress ? dl.totalBytes : -1;
        // eslint-disable-next-line no-shadow
        const [status] = lazy.DownloadUtils.getDownloadStatus(
          dl.currentBytes,
          totalBytes,
          dl.speed
        );
        return status;
      }
      case lazy.DownloadsCommon.DOWNLOAD_FINISHED:
        if (dl.deleted) {
          return strings.fileDeleted;
        }
        if (dl.target.exists === false) {
          return strings.fileMovedOrMissing;
        }
        return lazy.DownloadsViewUI.getSizeWithUnits(dl) || strings.sizeUnknown;
      case lazy.DownloadsCommon.DOWNLOAD_FAILED:
        return strings.stateFailed;
      case lazy.DownloadsCommon.DOWNLOAD_CANCELED:
        return strings.stateCanceled;
      case lazy.DownloadsCommon.DOWNLOAD_PAUSED: {
        const total = dl.hasProgress ? dl.totalBytes : -1;
        const transfer = lazy.DownloadUtils.getTransferTotal(
          dl.currentBytes,
          total
        );
        return strings.statusSeparatorBeforeNumber(
          strings.statePaused,
          transfer
        );
      }
      case lazy.DownloadsCommon.DOWNLOAD_BLOCKED_PARENTAL:
        return strings.stateBlockedParentalControls;
      case lazy.DownloadsCommon.DOWNLOAD_DIRTY:
      case lazy.DownloadsCommon.DOWNLOAD_BLOCKED_CONTENT_ANALYSIS:
        return strings.stateDirty ?? strings.stateFailed;
      case lazy.DownloadsCommon.DOWNLOAD_NOTSTARTED:
        return strings.stateStarting;
      default:
        return "";
    }
  }
}

/** Spaces section: Borgir man will do it :) */
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
