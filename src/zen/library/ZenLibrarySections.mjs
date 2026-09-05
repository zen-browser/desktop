/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { html } from "chrome://global/content/vendor/lit.all.mjs";
import { MozLitElement } from "chrome://global/content/lit-utils.mjs";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  BrowserUtils: "resource://gre/modules/BrowserUtils.sys.mjs",
  DownloadsCommon:
    "moz-src:///browser/components/downloads/DownloadsCommon.sys.mjs",
  DownloadsViewUI:
    "moz-src:///browser/components/downloads/DownloadsViewUI.sys.mjs",
  DownloadUtils: "resource://gre/modules/DownloadUtils.sys.mjs",
  FileUtils: "resource://gre/modules/FileUtils.sys.mjs",
  gZenBoostsManager: "resource:///modules/zen/boosts/ZenBoostsManager.sys.mjs",
  PlacesUtils: "resource://gre/modules/PlacesUtils.sys.mjs",
});

ChromeUtils.defineLazyGetter(
  lazy,
  "l10n",
  () => new Localization(["browser/zen-library.ftl"], true)
);

ChromeUtils.defineLazyGetter(lazy, "clipboardHelper", () =>
  Cc["@mozilla.org/widget/clipboardhelper;1"].getService(Ci.nsIClipboardHelper)
);

const SEARCH_DEBOUNCE_MS = 300;
const DAY_MS = 86_400_000;

const HISTORY_FILTERS = [
  { id: "all", label: "library-history-filter-all", days: null },
  { id: "today", label: "library-history-filter-today", days: 0 },
  { id: "yesterday", label: "library-history-filter-yesterday", days: 1 },
  { id: "last-7-days", label: "library-history-filter-last-7-days", days: 7 },
  {
    id: "last-30-days",
    label: "library-history-filter-last-30-days",
    days: 30,
  },
];

const DOWNLOAD_FILTERS = [
  { id: "all", label: "library-downloads-filter-all" },
  { id: "completed", label: "library-downloads-filter-completed" },
  { id: "in-progress", label: "library-downloads-filter-in-progress" },
  { id: "failed", label: "library-downloads-filter-failed" },
  { id: "paused", label: "library-downloads-filter-paused" },
];

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

  /**
   * Returns the named attribute (e.g. "label") of a Fluent message, or "".
   *
   * @param {string} key
   * @param {string} attrName
   */
  _l10nAttr(key, attrName) {
    const [msg] = lazy.l10n.formatMessagesSync([{ id: key }]);
    return msg?.attributes?.find(a => a.name === attrName)?.value ?? "";
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
    activeFilter: { type: String },
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
    if (!this.activeFilter) {
      this.activeFilter = this._filters()[0]?.id ?? "";
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

  /** Subclasses override to expose filter options. Empty array hides the button. */
  _filters() {
    return [];
  }

  /**
   * Called when the user picks a filter; subclasses re-query or re-filter.
   *
   * @param {string} _id
   */
  _onFilterChange(_id) {}

  _onFilterButtonClick(event) {
    event.stopPropagation();
    const filters = this._filters();
    if (filters.length === 0) {
      return;
    }
    const items = filters.map(f => ({
      l10nId: f.label,
      type: "radio",
      checked: this.activeFilter === f.id,
      onClick: () => this._onSelectFilter(f.id),
    }));
    this._openNativeContextMenu(items, {
      type: "anchor",
      el: event.currentTarget,
    });
  }

  _onSelectFilter(id) {
    if (id === this.activeFilter) {
      return;
    }
    this.activeFilter = id;
    this._onFilterChange(id);
  }

  _activeFilterLabel() {
    const filters = this._filters();
    const active = filters.find(f => f.id === this.activeFilter) ?? filters[0];
    return active ? this._l10nAttr(active.label, "label") : "";
  }

  /**
   * Renders one item row. `sideTop`/`sideBottom` are the stacked right-side
   * info slots (e.g. domain over time for downloads, just time for history).
   *
   * @param {object} root0
   * @param {string} root0.key
   * @param {string} root0.iconSrc
   * @param {object} root0.iconTemplate
   * @param {string} root0.label
   * @param {string} root0.sublabel
   * @param {string} root0.sideTop
   * @param {string} root0.sideBottom
   * @param {object} root0.payload
   */
  _renderItem({
    key,
    iconSrc,
    iconTemplate,
    label,
    sublabel,
    sideTop,
    sideBottom,
    payload,
    fileMissing = false,
  }) {
    return html`
      <div
        class="library-item"
        data-key=${key ?? ""}
        ?file-missing=${fileMissing}
        @click=${e => this._onItemClick(e, payload)}
        @auxclick=${e => this._onItemClick(e, payload)}
        @contextmenu=${e => this._onItemContextMenu(e, payload)}
      >
        <div class="library-item-stack">
          <div class="library-item-background"></div>
          <div class="library-item-content">
            <div class="library-item-icon-stack">
              ${
                iconTemplate ??
                html`
                  <img
                    class="library-item-icon-image"
                    src=${iconSrc || ""}
                    alt=""
                    role="presentation"
                  />
                `
              }
            </div>
            <div class="library-item-label-container">
              <label class="library-item-label">${label}</label>
              <label class="library-item-sublabel">${sublabel ?? ""}</label>
            </div>
            ${
              sideTop || sideBottom
                ? html`
                    <div class="library-item-side">
                      ${
                        sideTop
                          ? html`<label class="library-item-side-top"
                              >${sideTop}</label
                            >`
                          : ""
                      }
                      ${
                        sideBottom
                          ? html`<label class="library-item-side-bottom"
                              >${sideBottom}</label
                            >`
                          : ""
                      }
                    </div>
                  `
                : ""
            }
            <div class="library-item-actions">
              ${this._renderItemActions(payload).map(
                action => html`
                  <button
                    class="library-item-action-button"
                    tabindex="-1"
                    data-l10n-id=${action.l10nId ?? ""}
                    @click=${e => {
                      e.stopPropagation();
                      e.preventDefault();
                      action.onClick?.(e);
                    }}
                    @auxclick=${e => e.stopPropagation()}
                  >
                    <img src=${action.icon} alt="" />
                  </button>
                `
              )}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Subclasses override to provide trailing action buttons. Default is a single
   * "more options" button that opens the context menu.
   *
   * @param {object} payload
   */
  _renderItemActions(payload) {
    return [
      {
        icon: "chrome://browser/skin/zen-icons/menu.svg",
        onClick: e => this._onItemMenuButtonClick(e, payload),
      },
    ];
  }

  /**
   * Subclasses override; default is a no-op.
   *
   * @param {Event} _event
   * @param {object} _payload
   */
  _onItemClick(_event, _payload) {}

  /**
   * Subclasses override to build a menu; return null to skip the menu.
   *
   * @param {object} _payload
   */
  _buildContextMenu(_payload) {
    return null;
  }

  _onItemContextMenu(event, payload) {
    const items = this._buildContextMenu(payload);
    if (!items?.length) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this._openNativeContextMenu(items, {
      type: "screen",
      x: event.screenX,
      y: event.screenY,
    });
  }

  _onItemMenuButtonClick(event, payload) {
    event.stopPropagation();
    event.preventDefault();
    const items = this._buildContextMenu(payload);
    if (!items?.length) {
      return;
    }
    this._openNativeContextMenu(items, {
      type: "anchor",
      el: event.currentTarget,
    });
  }

  /**
   * Build a native XUL menupopup, append it to the chrome popup-set, open at
   * the requested location, and remove it on hide. We rebuild on every open
   * because the action set depends on the row's payload.
   *
   * @param {Array} items
   * @param {object} anchor
   */
  _openNativeContextMenu(items, anchor) {
    const popupSet = document.getElementById("mainPopupSet");
    const popup = document.createXULElement("menupopup");

    for (const item of items) {
      if (item.separator) {
        popup.appendChild(document.createXULElement("menuseparator"));
        continue;
      }
      const menuitem = document.createXULElement("menuitem");
      menuitem.setAttribute("data-l10n-id", item.l10nId);
      if (item.type) {
        menuitem.setAttribute("type", item.type);
      }
      if (item.checked) {
        menuitem.setAttribute("checked", "true");
      }
      if (item.disabled) {
        menuitem.setAttribute("disabled", "true");
      }
      menuitem.addEventListener(
        "command",
        () => {
          try {
            item.onClick?.();
          } catch (ex) {
            console.error(ex);
          }
        },
        { once: true }
      );
      popup.appendChild(menuitem);
    }

    popup.addEventListener(
      "popuphidden",
      () => {
        popup.remove();
      },
      { once: true }
    );

    popupSet.appendChild(popup);

    if (anchor.type === "anchor") {
      popup.openPopup(anchor.el, "after_end", 0, 0, true, false);
    } else {
      popup.openPopupAtScreen(anchor.x, anchor.y, true);
    }
  }

  /**
   * True when the modifier configured for Glance activation is held.
   *
   * @param {Event} event
   */
  _isGlanceActivation(event) {
    if (!Services.prefs.getBoolPref("zen.glance.enabled", true)) {
      return false;
    }
    const method = Services.prefs.getStringPref(
      "zen.glance.activation-method",
      "ctrl"
    );
    return (
      (method === "ctrl" && event.ctrlKey) ||
      (method === "alt" && event.altKey) ||
      (method === "shift" && event.shiftKey) ||
      (method === "meta" && event.metaKey)
    );
  }

  /**
   * Open `url` in a Glance overlay anchored to the clicked item.
   *
   * @param {Event} event
   * @param {string} url
   */
  _openInGlance(event, url) {
    const itemEl = event.currentTarget;
    const rect = window.windowUtils.getBoundsWithoutFlushing(itemEl);
    const tabPanelRect = window.windowUtils.getBoundsWithoutFlushing(
      window.gBrowser.tabpanels
    );
    window.gZenGlanceManager.openGlance({
      url,
      clientX: rect.left - tabPanelRect.left,
      clientY: rect.top - tabPanelRect.top,
      width: 0,
      height: 0,
      triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
    });
  }

  /** Close the parent ZenLibrary overlay. */
  _closeLibrary() {
    const host = this.getRootNode().host?.closest?.("zen-library");
    // Section nodes live outside the ZenLibrary lit tree (they are returned
    // from render()), so walk to the document and toggle via the static API.
    if (host?.isOpen) {
      host.constructor.toggle();
      return;
    }
    const lib = document.querySelector("zen-library[open]");
    if (lib) {
      lib.constructor.toggle();
    }
  }

  renderSearchResults() {
    return html``;
  }

  render() {
    const hasFilters = !!this._filters().length;
    return html`
      <link
        rel="stylesheet"
        href="chrome://browser/content/zen-styles/zen-library.css"
      />
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
          </div>
        </div>
        ${
          hasFilters
            ? html`
                <button
                  class="search-filter-button"
                  @click=${this._onFilterButtonClick}
                >
                  <img
                    src="chrome://browser/skin/zen-icons/permissions.svg"
                    alt=""
                  />
                  <label>${this._activeFilterLabel()}</label>
                </button>
              `
            : ""
        }
      </div>
      <div
        class="search-results"
        @scroll=${e => {
          const el = e.currentTarget;
          this.isScrolledToTop = el.scrollTop === 0;
          this._onScroll?.(el);
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
  static INITIAL_BATCH = 50;
  static SCROLL_BATCH = 50;
  static SCROLL_THRESHOLD_PX = 400;

  _allItems = [];

  #renderedItemCount = 0;
  #fillScheduled = false;

  _getRenderedSlice() {
    return this._allItems.slice(0, this.#renderedItemCount);
  }

  /** Call when _allItems is fully replaced (new query / search term). */
  _resetProgressiveRender() {
    this.#renderedItemCount = Math.min(
      ProgressiveSearchSection.INITIAL_BATCH,
      this._allItems.length
    );
    this.isEmpty = this._allItems.length === 0;
    this.#scheduleViewportFill();
  }

  /** Call when _allItems grows/shrinks but the rendered prefix should stick. */
  _maintainProgressiveRender() {
    this.#renderedItemCount = Math.min(
      Math.max(
        this.#renderedItemCount,
        Math.min(ProgressiveSearchSection.INITIAL_BATCH, this._allItems.length)
      ),
      this._allItems.length
    );
    this.isEmpty = this._allItems.length === 0;
    this.#scheduleViewportFill();
  }

  /**
   * Top up the rendered slice until the list is at least one viewport tall;
   * a list shorter than the viewport never fires a scroll event, so without
   * this the user could never trigger more loads.
   */
  #scheduleViewportFill() {
    if (this.#fillScheduled) {
      return;
    }
    this.#fillScheduled = true;
    this.updateComplete.then(() => {
      this.#fillScheduled = false;
      if (!this.isConnected) {
        return;
      }
      const el = this.renderRoot.querySelector(".search-results");
      if (!el) {
        return;
      }
      if (
        el.scrollHeight <= el.clientHeight &&
        this.#renderedItemCount < this._allItems.length
      ) {
        this.#growBy(ProgressiveSearchSection.SCROLL_BATCH);
        this.#scheduleViewportFill();
      }
    });
  }

  #growBy(n) {
    if (this.#renderedItemCount >= this._allItems.length) {
      return;
    }
    this.#renderedItemCount = Math.min(
      this.#renderedItemCount + n,
      this._allItems.length
    );
    this.requestUpdate();
  }

  /**
   * Hook called from SearchSection's results scroll handler.
   *
   * @param {Element} el
   */
  _onScroll(el) {
    if (this.#renderedItemCount >= this._allItems.length) {
      return;
    }
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom <= ProgressiveSearchSection.SCROLL_THRESHOLD_PX) {
      this.#growBy(ProgressiveSearchSection.SCROLL_BATCH);
    }
  }

  disconnectedCallback() {
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

      const cutoff = this.#filterCutoff();
      const yesterdayWindow = this.#yesterdayWindow();

      // RESULTS_AS_VISIT produces one node per visit; de-duplicate per day-bucket.
      const seenNodes = new Set();
      for (let i = 0; i < root.childCount; i++) {
        const node = root.getChild(i);
        const date = new Date(node.time / 1000);
        const ts = date.getTime();

        if (yesterdayWindow) {
          if (ts < yesterdayWindow.start || ts >= yesterdayWindow.end) {
            continue;
          }
        } else if (cutoff !== null && ts < cutoff) {
          continue;
        }

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
        `#walkAndPopulate — ${this._allItems.length} items, search=${!!this.searchTerm}, filter=${this.activeFilter}`
      );
    } finally {
      this.#walking = false;
    }
  }

  /** Lower bound (timestamp ms) for the active time-range filter, or null for "all". */
  #filterCutoff() {
    const filter = HISTORY_FILTERS.find(f => f.id === this.activeFilter);
    if (!filter || filter.days === null) {
      return null;
    }
    if (filter.id === "today") {
      return new Date().setHours(0, 0, 0, 0);
    }
    if (filter.id === "yesterday") {
      return null; // handled by #yesterdayWindow
    }
    return new Date().setHours(0, 0, 0, 0) - filter.days * DAY_MS;
  }

  /** Yesterday is a single-day window, not just a lower bound. */
  #yesterdayWindow() {
    if (this.activeFilter !== "yesterday") {
      return null;
    }
    const start = new Date().setHours(0, 0, 0, 0) - DAY_MS;
    return { start, end: start + DAY_MS };
  }

  _filters() {
    return HISTORY_FILTERS;
  }

  _onFilterChange(_id) {
    this.#walkAndPopulate();
    this._resetProgressiveRender();
    this.requestUpdate();
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
          <label class="library-date-separator">${lastLabel}</label>
        `);
      }
      const domain =
        v.url?.replace(/^[\w-]+:\/\//, "").replace(/\/$/, "") || "";
      const time = this._formatTime(v.date);
      const sublabel = [domain, time].filter(Boolean).join(" · ");
      rows.push(
        this._renderItem({
          key: `${v.date.getTime()}|${v.url}`,
          iconSrc: `page-icon:${v.url || ""}`,
          label: v.title || v.url,
          sublabel,
          payload: v,
        })
      );
    }

    return html`${rows}`;
  }

  /**
   * Plain click on a history row opens the page in a Glance overlay; holding
   * Ctrl (or any other modifier / middle-click) falls back to the standard
   * "where to open" routing.
   *
   * @param {Event} event
   * @param {object} item
   */
  _onItemClick(event, item) {
    if (event.button === 2) {
      return;
    }
    if (!item?.url) {
      return;
    }
    event.preventDefault();

    const hasModifier =
      event.ctrlKey || event.metaKey || event.shiftKey || event.altKey;
    const isMiddleClick = event.button === 1;

    if (
      !hasModifier &&
      !isMiddleClick &&
      Services.prefs.getBoolPref("zen.glance.enabled", true)
    ) {
      // Glance overlays on top of the library; keep the library open so the
      // user can fire another glance without re-opening it.
      this._openInGlance(event, item.url);
      return;
    }

    const where = lazy.BrowserUtils.whereToOpenLink(event, false, true);
    window.openTrustedLinkIn(item.url, where === "current" ? "tab" : where);
    this._closeLibrary();
  }

  _renderItemActions(item) {
    if (!item?.url) {
      return [];
    }
    return [
      {
        icon: "chrome://browser/skin/zen-icons/edit-delete.svg",
        l10nId: "library-history-action-remove",
        onClick: () => {
          lazy.PlacesUtils.history.remove(item.url).catch(console.error);
        },
      },
      {
        icon: "chrome://browser/skin/zen-icons/arrow-right.svg",
        l10nId: "library-history-action-open-tab",
        onClick: () => {
          window.openTrustedLinkIn(item.url, "tab");
          this._closeLibrary();
        },
      },
    ];
  }

  _buildContextMenu(item) {
    if (!item?.url) {
      return null;
    }
    return [
      {
        l10nId: "library-item-context-open",
        onClick: () => {
          window.openTrustedLinkIn(item.url, "tab");
          this._closeLibrary();
        },
      },
      {
        l10nId: "library-item-context-open-glance",
        onClick: () => {
          // Use the section element as the anchor — context menu opens at
          // the cursor and the original item element isn't tracked here.
          const fakeEvent = { currentTarget: this };
          this._openInGlance(fakeEvent, item.url);
        },
      },
      {
        l10nId: "library-item-context-open-new-window",
        onClick: () => {
          window.openTrustedLinkIn(item.url, "window");
          this._closeLibrary();
        },
      },
      { separator: true },
      {
        l10nId: "library-item-context-copy-url",
        onClick: () => lazy.clipboardHelper.copyString(item.url),
      },
      {
        l10nId: "library-item-context-delete-history",
        onClick: () => {
          lazy.PlacesUtils.history.remove(item.url).catch(console.error);
        },
      },
    ];
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

  _filters() {
    return DOWNLOAD_FILTERS;
  }

  _onFilterChange(_id) {
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

    const sublabelParts = [
      this.#getStatusLabel(dl),
      this.#sourceDomain(dl),
      this._formatTime(this.#downloadTime(dl)),
    ].filter(Boolean);

    const state = lazy.DownloadsCommon.stateOfDownload(dl);
    const isActive =
      state === lazy.DownloadsCommon.DOWNLOAD_DOWNLOADING ||
      state === lazy.DownloadsCommon.DOWNLOAD_PAUSED ||
      state === lazy.DownloadsCommon.DOWNLOAD_NOTSTARTED;
    const fileMissing =
      dl.deleted ||
      (dl.succeeded && dl.target?.exists === false);

    return this._renderItem({
      key: `${this.#downloadTime(dl)}|${dl.source.url}`,
      iconSrc: iconPath,
      iconTemplate: isActive ? this.#renderDownloadProgress(dl) : null,
      label: nameStr,
      sublabel: sublabelParts.join(" · "),
      payload: dl,
      fileMissing,
    });
  }

  /**
   * SVG progress ring that replaces the file icon while a download is in
   * flight. The ring fills clockwise to match `currentBytes / totalBytes`;
   * downloads of unknown size spin instead. Hovering swaps the ring for an
   * X — clicking it cancels and drops any partial data.
   *
   * @param {object} dl
   */
  #renderDownloadProgress(dl) {
    const RADIUS = 8;
    const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
    const hasProgress = dl.hasProgress && dl.totalBytes > 0;
    const ratio = hasProgress
      ? Math.max(0, Math.min(1, dl.currentBytes / dl.totalBytes))
      : 0;
    const dashOffset = CIRCUMFERENCE * (1 - ratio);

    return html`
      <button
        class="library-download-progress"
        data-progress=${hasProgress ? "determinate" : "indeterminate"}
        title="Cancel download"
        @click=${e => {
          e.stopPropagation();
          e.preventDefault();
          dl.cancel().catch(() => {});
          dl.removePartialData().catch(console.error);
        }}
        @auxclick=${e => e.stopPropagation()}
      >
        <svg
          class="library-download-progress-ring"
          viewBox="0 0 18 18"
          width="20"
          height="20"
        >
          <circle class="track" cx="9" cy="9" r=${RADIUS}></circle>
          <circle
            class="arc"
            cx="9"
            cy="9"
            r=${RADIUS}
            stroke-dasharray=${CIRCUMFERENCE}
            stroke-dashoffset=${dashOffset}
          ></circle>
        </svg>
        <img
          class="library-download-progress-cancel"
          src="chrome://browser/skin/zen-icons/close.svg"
        />
      </button>
    `;
  }

  #sourceDomain(dl) {
    const url = dl.source.originalUrl || dl.source.url || "";
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  }

  _onItemClick(event, dl) {
    if (event.button === 2) {
      return;
    }
    if (!dl) {
      return;
    }
    event.preventDefault();

    const state = lazy.DownloadsCommon.stateOfDownload(dl);
    const isFinished = state === lazy.DownloadsCommon.DOWNLOAD_FINISHED;

    // Glance modifier — preview the source URL, regardless of file state.
    if (event.button !== 1 && this._isGlanceActivation(event)) {
      const previewUrl =
        dl.source.referrerInfo?.originalReferrer?.spec || dl.source.url;
      if (previewUrl) {
        this._openInGlance(event, previewUrl);
      }
      return;
    }

    // Middle-click or finished file with no path: fall back to opening source URL.
    if (event.button === 1 || !isFinished || !dl.target.path) {
      const url = dl.source.originalUrl || dl.source.url;
      if (url) {
        const where = lazy.BrowserUtils.whereToOpenLink(event, false, true);
        window.openTrustedLinkIn(url, where === "current" ? "tab" : where);
        this._closeLibrary();
      }
      return;
    }

    // Default: launch the downloaded file with the system handler.
    if (dl.target.exists !== false && !dl.deleted) {
      lazy.DownloadsCommon.openDownload(dl).catch(console.error);
    }
  }

  /**
   * Mirrors Firefox's `downloadsContextMenu` so the labels stay in sync with
   * the rest of the browser. Built dynamically because the relevant entries
   * change per state (pause/resume, show, delete, etc.).
   */
  _buildContextMenu(dl) {
    if (!dl) {
      return null;
    }
    const C = lazy.DownloadsCommon;
    const state = C.stateOfDownload(dl);
    const isFinished = state === C.DOWNLOAD_FINISHED;
    const isActive =
      state === C.DOWNLOAD_DOWNLOADING || state === C.DOWNLOAD_PAUSED;
    const fileExists = isFinished && dl.target.exists !== false && !dl.deleted;
    const sourceUrl = dl.source.originalUrl || dl.source.url;

    const items = [];

    if (state === C.DOWNLOAD_DOWNLOADING) {
      items.push({
        l10nId: "downloads-cmd-pause",
        onClick: () => dl.cancel().catch(() => {}),
      });
    } else if (state === C.DOWNLOAD_PAUSED) {
      items.push({
        l10nId: "downloads-cmd-resume",
        onClick: () => dl.start?.().catch(() => {}),
      });
    }

    if (fileExists) {
      items.push({
        l10nId: "downloads-cmd-show-menuitem-2",
        onClick: () => {
          try {
            const file = new lazy.FileUtils.File(dl.target.path);
            C.showDownloadedFile(file);
          } catch (ex) {
            console.error(ex);
          }
        },
      });
    }

    if (sourceUrl) {
      items.push({
        l10nId: "downloads-cmd-go-to-download-page",
        onClick: () => {
          window.openTrustedLinkIn(sourceUrl, "tab");
          this._closeLibrary();
        },
      });
      items.push({
        l10nId: "downloads-cmd-copy-download-link",
        onClick: () => lazy.clipboardHelper.copyString(sourceUrl),
      });
    }

    if (fileExists || !isActive) {
      items.push({ separator: true });
    }

    if (fileExists) {
      items.push({
        l10nId: "downloads-cmd-delete-file",
        onClick: () => {
          C.deleteDownloadFiles(
            dl,
            lazy.DownloadsViewUI.clearHistoryOnDelete
          ).catch(console.error);
        },
      });
    }
    if (!isActive) {
      items.push({
        l10nId: "downloads-cmd-remove-from-history",
        onClick: () => C.deleteDownload(dl).catch(console.error),
      });
    }
    return items;
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
    const filter = this.activeFilter;
    this._allItems = this.#allDownloads.filter(dl => {
      if (term && !this.#matchesSearchTerm(dl, term)) {
        return false;
      }
      return this.#matchesStatusFilter(dl, filter);
    });
  }

  #matchesStatusFilter(dl, filter) {
    if (!filter || filter === "all") {
      return true;
    }
    const state = lazy.DownloadsCommon.stateOfDownload(dl);
    const C = lazy.DownloadsCommon;
    switch (filter) {
      case "completed":
        return state === C.DOWNLOAD_FINISHED;
      case "in-progress":
        return (
          state === C.DOWNLOAD_DOWNLOADING || state === C.DOWNLOAD_NOTSTARTED
        );
      case "failed":
        return (
          state === C.DOWNLOAD_FAILED ||
          state === C.DOWNLOAD_CANCELED ||
          state === C.DOWNLOAD_DIRTY ||
          state === C.DOWNLOAD_BLOCKED_PARENTAL ||
          state === C.DOWNLOAD_BLOCKED_CONTENT_ANALYSIS
        );
      case "paused":
        return state === C.DOWNLOAD_PAUSED;
      default:
        return true;
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

/**
 * Boosts section: lists every saved boost across all domains. Each row shows
 * the boost's name + domain, a hover-revealed export button, and a toggle
 * pill that reflects (and flips) the domain's active-boost state.
 */
class ZenLibraryBoostsSection extends SearchSection {
  static id = "boosts";
  static label = "library-boosts-section-title";

  #observer = null;

  get _searchPlaceholder() {
    return "library-boosts-search-placeholder";
  }

  connectedCallback() {
    super.connectedCallback();
    this.#observer = () => this.requestUpdate();
    Services.obs.addObserver(this.#observer, "zen-boosts-update");
    Services.obs.addObserver(this.#observer, "zen-boosts-active-change");
  }

  disconnectedCallback() {
    if (this.#observer) {
      Services.obs.removeObserver(this.#observer, "zen-boosts-update");
      Services.obs.removeObserver(this.#observer, "zen-boosts-active-change");
      this.#observer = null;
    }
    super.disconnectedCallback();
  }

  _onSearch(_term) {
    this.requestUpdate();
  }

  /** Flat list of every boost across all domains, filtered by search term. */
  #getBoosts() {
    const manager = lazy.gZenBoostsManager;
    if (!manager?.registeredDomains) {
      return [];
    }
    const term = this.searchTerm?.trim().toLowerCase();
    const items = [];
    for (const [domain, entry] of manager.registeredDomains) {
      for (const [id, boostEntry] of entry.boostEntries) {
        const displayName = boostEntry.boostData?.boostName || "";
        if (
          term &&
          !displayName.toLowerCase().includes(term) &&
          !domain.toLowerCase().includes(term)
        ) {
          continue;
        }
        items.push({
          id,
          domain,
          name: displayName,
          isActive: entry.activeBoostId === id,
        });
      }
    }
    items.sort((a, b) =>
      (a.name || a.domain).localeCompare(b.name || b.domain)
    );
    return items;
  }

  renderSearchResults() {
    const boosts = this.#getBoosts();
    if (boosts.length === 0) {
      return html`
        <div
          class="empty-state"
          data-l10n-id=${this.searchTerm ? "library-search-no-results" : "library-boosts-empty"}
        ></div>
      `;
    }
    return html`${boosts.map(b => this.#renderBoost(b))}`;
  }

  #renderBoost(boost) {
    return html`
      <div
        class="library-item library-boost-item"
        data-key=${`${boost.domain}|${boost.id}`}
        ?active=${boost.isActive}
        @click=${e => this.#openBoost(e, boost)}
        @contextmenu=${e => this._onItemContextMenu(e, boost)}
      >
        <div class="library-item-stack">
          <div class="library-item-background"></div>
          <div class="library-item-content">
            <div class="library-boost-icon" ?inactive=${!boost.isActive}>
              <img
                class="library-boost-icon-image"
                src="page-icon:https://${boost.domain}/"
                alt=""
                role="presentation"
              />
            </div>
            <div class="library-item-label-container">
              <label class="library-item-label"
                >${boost.name || boost.domain}</label
              >
              <label class="library-item-sublabel">${boost.domain}</label>
            </div>
            <button
              class="library-boost-toggle"
              data-l10n-id="library-boost-toggle"
              role="switch"
              aria-checked=${boost.isActive ? "true" : "false"}
              ?checked=${boost.isActive}
              tabindex="-1"
              @click=${e => {
                e.stopPropagation();
                e.preventDefault();
                this.#toggle(boost);
              }}
              @auxclick=${e => e.stopPropagation()}
            >
              <span class="library-boost-toggle-thumb"></span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Open the boost's domain in a Glance overlay and pop the boost editor
   * window next to it so the user can tweak the boost while previewing.
   *
   * @param {Event} event
   * @param {object} boost
   */
  #openBoost(event, boost) {
    const url = `https://${boost.domain}/`;
    this._openInGlance(event, url);
    try {
      const stored = lazy.gZenBoostsManager.loadBoostFromStore(
        boost.domain,
        boost.id
      );
      if (stored) {
        const uri = Services.io.newURI(url);
        lazy.gZenBoostsManager.openBoostWindow(window, stored, uri);
      }
    } catch (ex) {
      console.error(ex);
    }
  }

  #toggle(boost) {
    lazy.gZenBoostsManager.toggleBoostActiveForDomain(boost.domain, boost.id);
  }

  #export(boost) {
    const manager = lazy.gZenBoostsManager;
    const stored = manager.loadBoostFromStore(boost.domain, boost.id);
    if (!stored) {
      return;
    }
    manager.exportBoost(window, {
      domain: boost.domain,
      id: boost.id,
      boostEntry: stored.boostEntry,
    });
  }

  _buildContextMenu(boost) {
    if (!boost) {
      return null;
    }
    return [
      {
        l10nId: "library-boost-context-edit",
        onClick: () => {
          const stored = lazy.gZenBoostsManager.loadBoostFromStore(
            boost.domain,
            boost.id
          );
          if (!stored) {
            return;
          }
          try {
            const uri = Services.io.newURI(`https://${boost.domain}/`);
            lazy.gZenBoostsManager.openBoostWindow(window, stored, uri);
          } catch (ex) {
            console.error(ex);
          }
        },
      },
      {
        l10nId: "library-boost-context-export",
        onClick: () => this.#export(boost),
      },
      { separator: true },
      {
        l10nId: "library-boost-context-delete",
        onClick: () => {
          lazy.gZenBoostsManager.deleteBoost({
            domain: boost.domain,
            id: boost.id,
          });
        },
      },
    ];
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
  boosts: ZenLibraryBoostsSection,
  spaces: ZenLibrarySpacesSection,
};

for (const Section of Object.values(ZenLibrarySections)) {
  customElements.define(`zen-library-section-${Section.id}`, Section);
}
