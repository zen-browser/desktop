/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { html, repeat } from "chrome://global/content/vendor/lit.all.mjs";
import { ZenLibrarySearchSection } from "moz-src:///zen/library/sections/ZenLibrarySearchSection.mjs";

let lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  PlacesQuery: "resource://gre/modules/PlacesQuery.sys.mjs",
  PlacesUtils: "resource://gre/modules/PlacesUtils.sys.mjs",
});

ChromeUtils.defineLazyGetter(
  lazy,
  "relativeDayFormat",
  () => new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })
);

ChromeUtils.defineLazyGetter(
  lazy,
  "dateFormat",
  () => new Intl.DateTimeFormat(undefined, { dateStyle: "medium" })
);

const PAGE_SIZE = 100;
const HISTORY_DAYS_OLD = 120;
const MS_PER_DAY = 86400000;
const WHEN_DAYS = { today: 1, week: 7, month: 30 };
const SORT_OPTIONS = ["date", "site", "mostvisited", "lastvisited"];

const visitKey = visit => `${visit.guid}-${visit.date.getTime()}`;

export class ZenLibraryHistorySection extends ZenLibrarySearchSection {
  static id = "history";
  static label = "library-history-section-title";

  static render(library) {
    return html`
      <zen-library-history-section
        class="zen-library-section"
        data-section="history"
        .library=${library}
      ></zen-library-history-section>
    `;
  }

  static properties = {
    visits: { state: true },
  };

  #placesQuery = null;
  #limit = PAGE_SIZE;
  #fetchGeneration = 0;
  #exhausted = false;

  constructor() {
    super();
    this.visits = null;
    this.activeFilters.add("sort:date");
  }

  connectedCallback() {
    super.connectedCallback();
    this.#placesQuery = new lazy.PlacesQuery();
    this.#placesQuery.observeHistory(() => this.#fetch());
    this.#fetch();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#placesQuery?.close();
    this.#placesQuery = null;
  }

  get searchPlaceholderL10nId() {
    return "library-history-search-placeholder";
  }

  get filterTitleL10nId() {
    return "library-history-filter-title";
  }

  get filterGroups() {
    return [
      {
        id: "when",
        titleL10nId: "library-history-filter-when",
        exclusive: true,
        options: [
          { id: "today", l10nId: "library-history-filter-today" },
          { id: "week", l10nId: "library-history-filter-week" },
          { id: "month", l10nId: "library-history-filter-month" },
        ],
      },
      {
        id: "sort",
        titleL10nId: "library-history-filter-sort",
        exclusive: true,
        options: [
          { id: "date", l10nId: "library-history-sort-date" },
          { id: "site", l10nId: "library-history-sort-site" },
          { id: "mostvisited", l10nId: "library-history-sort-most-visited" },
          { id: "lastvisited", l10nId: "library-history-sort-last-visited" },
        ],
      },
    ];
  }

  get #activeDaysOld() {
    for (const [id, days] of Object.entries(WHEN_DAYS)) {
      if (this.isFilterActive("when", id)) {
        return days;
      }
    }
    return HISTORY_DAYS_OLD;
  }

  get #activeSort() {
    return SORT_OPTIONS.find(id => this.isFilterActive("sort", id)) ?? "date";
  }

  onSearchChanged() {
    this.#resetAndFetch();
  }

  onFiltersChanged() {
    if (!SORT_OPTIONS.some(id => this.isFilterActive("sort", id))) {
      this.activeFilters.add("sort:date");
      this.requestUpdate();
    }
    this.#resetAndFetch();
  }

  onListScrolledToEnd() {
    if (this.#exhausted || !this.#placesQuery) {
      return;
    }
    this.#limit += PAGE_SIZE;
    this.#fetch();
  }

  #resetAndFetch() {
    this.#limit = PAGE_SIZE;
    this.#exhausted = false;
    this.#fetch();
  }

  async #fetch() {
    if (!this.#placesQuery) {
      return;
    }
    const generation = ++this.#fetchGeneration;
    const daysOld = this.#activeDaysOld;
    let visits;
    if (this.searchQuery) {
      visits =
        (await this.#placesQuery.searchHistory(
          this.searchQuery,
          this.#limit
        )) ?? [];
    } else if (this.#activeSort === "mostvisited") {
      visits = this.#fetchMostVisited(daysOld, this.#limit);
    } else {
      visits = await this.#placesQuery.getHistory({
        daysOld,
        limit: this.#limit,
        sortBy: this.#activeSort,
      });
    }
    if (generation !== this.#fetchGeneration || !this.#placesQuery) {
      return;
    }
    this.#exhausted = this.#countVisits(visits) < this.#limit;
    if (this.searchQuery && daysOld !== HISTORY_DAYS_OLD) {
      const cutoff = Date.now() - daysOld * MS_PER_DAY;
      visits = visits.filter(visit => visit.date.getTime() >= cutoff);
    }
    this.visits = visits;
    // The cached Map is mutated in place, so its identity may not change.
    this.requestUpdate();
  }

  #countVisits(visits) {
    if (Array.isArray(visits)) {
      return visits.length;
    }
    let count = 0;
    for (const groupVisits of visits.values()) {
      count += groupVisits.length;
    }
    return count;
  }

  #fetchMostVisited(daysOld, limit) {
    const query = lazy.PlacesUtils.history.getNewQuery();
    query.beginTime = lazy.PlacesUtils.toPRTime(
      Date.now() - daysOld * MS_PER_DAY
    );
    const options = lazy.PlacesUtils.history.getNewQueryOptions();
    options.sortingMode = options.SORT_BY_VISITCOUNT_DESCENDING;
    options.maxResults = limit;
    const root = lazy.PlacesUtils.history.executeQuery(query, options).root;
    root.containerOpen = true;
    const visits = [];
    for (let i = 0; i < root.childCount; i++) {
      const node = root.getChild(i);
      visits.push({
        url: node.uri,
        title: node.title,
        date: lazy.PlacesUtils.toDate(node.time),
        guid: node.pageGuid,
      });
    }
    root.containerOpen = false;
    return visits;
  }

  #openVisit(visit) {
    window.openTrustedLinkIn(visit.url, "tab");
    this.library?.constructor.toggle();
  }

  #forgetVisit(visit) {
    lazy.PlacesUtils.history.remove(visit.url);
    this.visits = this.#withoutUrl(this.visits, visit.url);
  }

  #withoutUrl(container, url) {
    if (Array.isArray(container)) {
      return container.filter(visit => visit.url !== url);
    }
    const remaining = new Map();
    for (const [key, groupVisits] of container) {
      const filtered = groupVisits.filter(visit => visit.url !== url);
      if (filtered.length) {
        remaining.set(key, filtered);
      }
    }
    return remaining;
  }

  #formatDay(day) {
    const daysAgo = Math.round(
      (this.#placesQuery.getStartOfDayTimestamp(new Date()) - day) / MS_PER_DAY
    );
    const formatted =
      daysAgo <= 6
        ? lazy.relativeDayFormat.format(-daysAgo, "day")
        : lazy.dateFormat.format(day);
    return formatted.charAt(0).toLocaleUpperCase() + formatted.slice(1);
  }

  #formatUrl(url) {
    return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
  }

  #renderVisit(visit) {
    return html`
      <div
        class="zen-library-history-row"
        @click=${() => this.#openVisit(visit)}
      >
        <img
          class="zen-library-history-favicon"
          src="page-icon:${visit.url}"
          alt=""
        />
        <div class="zen-library-history-text">
          <span class="zen-library-history-title"
            >${visit.title || visit.url}</span
          >
          <span class="zen-library-history-url"
            >${this.#formatUrl(visit.url)}</span
          >
        </div>
        <div class="zen-library-history-actions">
          <button
            data-l10n-id="library-history-forget-button"
            @click=${event => {
              event.stopPropagation();
              this.#forgetVisit(visit);
            }}
          >
            <img src="chrome://browser/skin/zen-icons/trash.svg" alt="" />
          </button>
          <button
            data-l10n-id="library-history-reopen-button"
            @click=${event => {
              event.stopPropagation();
              this.#openVisit(visit);
            }}
          >
            <img
              src="chrome://browser/skin/zen-icons/arrow-rotate-anticlockwise.svg"
              alt=""
            />
          </button>
        </div>
      </div>
    `;
  }

  #renderVisits(visits) {
    return repeat(visits, visitKey, visit => this.#renderVisit(visit));
  }

  #renderGroupHeader(key) {
    if (typeof key === "number") {
      return html`<h3>${this.#formatDay(key)}</h3>`;
    }
    return key
      ? html`<h3>${key}</h3>`
      : html`<h3 data-l10n-id="library-history-site-other"></h3>`;
  }

  #renderEmpty() {
    return html`
      <div class="zen-library-empty" data-l10n-id="library-history-empty"></div>
    `;
  }

  renderItems() {
    if (!this.visits) {
      return null;
    }
    if (Array.isArray(this.visits)) {
      if (!this.visits.length) {
        return this.#renderEmpty();
      }
      return html`
        <div class="zen-library-history-group">
          ${this.#renderVisits(this.visits)}
        </div>
      `;
    }
    if (!this.visits.size) {
      return this.#renderEmpty();
    }
    return repeat(
      this.visits.entries(),
      ([key]) => key,
      ([key, groupVisits]) => html`
        <div class="zen-library-history-group">
          ${this.#renderGroupHeader(key)} ${this.#renderVisits(groupVisits)}
        </div>
      `
    );
  }
}

customElements.define("zen-library-history-section", ZenLibraryHistorySection);
