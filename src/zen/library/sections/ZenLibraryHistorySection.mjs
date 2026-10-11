/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { html, repeat } from "chrome://global/content/vendor/lit.all.mjs";
import {
  MS_PER_DAY,
  PAGE_SIZE,
  ZenLibrarySearchSection,
  whenFilterGroup,
} from "moz-src:///zen/library/sections/ZenLibrarySearchSection.mjs";

let lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  BrowserUtils: "resource://gre/modules/BrowserUtils.sys.mjs",
  PlacesQuery: "resource://gre/modules/PlacesQuery.sys.mjs",
  PlacesUIUtils: "moz-src:///browser/components/places/PlacesUIUtils.sys.mjs",
  PlacesUtils: "resource://gre/modules/PlacesUtils.sys.mjs",
  SessionStore:
    "moz-src:///browser/components/sessionstore/SessionStore.sys.mjs",
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

ChromeUtils.defineLazyGetter(
  lazy,
  "visitFormat",
  () =>
    new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    })
);

const HISTORY_DAYS_OLD = 120;
const SORT_OPTIONS = ["date", "site", "mostvisited", "lastvisited"];
const CLOSED_TABS_PREF = "zen.library.history.closed-tabs";
const CLOSED_OBJECTS_TOPIC = "sessionstore-closed-objects-changed";

const visitKey = visit => `${visit.guid}-${visit.date.getTime()}`;

const MS_PER_HOUR = 60 * 60 * 1000;

const CLEAR_RANGES = [
  { l10nId: "library-history-clear-last-hour", hours: 1 },
  { l10nId: "library-history-clear-last-12-hours", hours: 12 },
  { l10nId: "library-history-clear-today", sinceMidnight: true },
  { l10nId: "library-history-clear-last-week", hours: 24 * 7 },
  { l10nId: "library-history-clear-last-month", hours: 24 * 30 },
  { l10nId: "library-history-clear-all", separatorBefore: true },
];

/** @returns {Promise<boolean>} Whether the user agreed to forget the pages */
async function confirmClear() {
  const [title, message, accept] = await document.l10n.formatValues([
    "library-history-clear-prompt-title",
    "library-history-clear-prompt-message",
    "library-history-clear-prompt-accept",
  ]);
  const flags = accept
    ? Services.prompt.BUTTON_POS_0 * Services.prompt.BUTTON_TITLE_IS_STRING +
      Services.prompt.BUTTON_POS_1 * Services.prompt.BUTTON_TITLE_CANCEL
    : Services.prompt.STD_OK_CANCEL_BUTTONS;
  const pressed = Services.prompt.confirmEx(
    window,
    title ?? "",
    message ?? "",
    flags,
    accept,
    null,
    null,
    null,
    {}
  );
  return pressed === 0;
}

/**
 * Forgets every page visited within one of the `CLEAR_RANGES`, once the user
 * has confirmed it.
 *
 * @param {object} range - One of `CLEAR_RANGES`
 */
async function clearHistory(range) {
  if (!(await confirmClear())) {
    return;
  }
  let beginDate;
  if (range.sinceMidnight) {
    beginDate = new Date();
    beginDate.setHours(0, 0, 0, 0);
  } else if (range.hours) {
    beginDate = new Date(Date.now() - range.hours * MS_PER_HOUR);
  } else {
    await lazy.PlacesUtils.history.clear();
    return;
  }
  await lazy.PlacesUtils.history.removeVisitsByFilter({
    beginDate,
    endDate: new Date(),
  });
}

export class ZenLibraryHistorySection extends ZenLibrarySearchSection {
  static id = "history";
  static label = "library-history-section-title";

  static get tabLabel() {
    return Services.prefs.getBoolPref(CLOSED_TABS_PREF, false)
      ? "library-archive-section-title"
      : this.label;
  }

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
    this.activeFilters.add(
      Services.prefs.getBoolPref(CLOSED_TABS_PREF, false)
        ? "source:closed"
        : "source:history"
    );
  }

  connectedCallback() {
    super.connectedCallback();
    this.#placesQuery = new lazy.PlacesQuery();
    this.#placesQuery.observeHistory(() => this.#fetch());
    Services.obs.addObserver(this.#closedObserver, CLOSED_OBJECTS_TOPIC);
    this.#fetch();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    Services.obs.removeObserver(this.#closedObserver, CLOSED_OBJECTS_TOPIC);
    this.#placesQuery?.close();
    this.#placesQuery = null;
  }

  #closedObserver = {
    observe: () => {
      if (this.#showingClosed) {
        this.#fetch();
      }
    },
  };

  /** @returns {boolean} Whether the list is of closed tabs, not of history */
  get #showingClosed() {
    return this.isFilterActive("source", "closed");
  }

  get searchPlaceholderL10nId() {
    return "library-history-search-placeholder";
  }

  get filterTitleL10nId() {
    return "library-history-filter-title";
  }

  get filterGroups() {
    const groups = [
      whenFilterGroup("library-history-filter-when"),
      {
        id: "sort",
        titleL10nId: "library-history-filter-sort",
        exclusive: true,
        options: [
          { id: "date", l10nId: "library-history-sort-date" },
          { id: "site", l10nId: "library-history-sort-site" },
          {
            id: "mostvisited",
            l10nId: "library-history-sort-most-visited",
            // A tab that was closed was never counted as visited.
            disabled: this.#showingClosed,
          },
          { id: "lastvisited", l10nId: "library-history-sort-last-visited" },
        ],
      },
    ];
    groups.push({
      id: "source",
      titleL10nId: "library-history-filter-source",
      exclusive: true,
      options: [
        { id: "history", l10nId: "library-history-source-history" },
        { id: "closed", l10nId: "library-history-source-closed" },
      ],
    });
    return groups;
  }

  get #activeDaysOld() {
    return this.activeWhenDays ?? HISTORY_DAYS_OLD;
  }

  get #activeSort() {
    return SORT_OPTIONS.find(id => this.isFilterActive("sort", id)) ?? "date";
  }

  onSearchChanged() {
    this.#resetAndFetch();
  }

  onFiltersChanged() {
    if (!this.#showingClosed && !this.isFilterActive("source", "history")) {
      this.activeFilters.add("source:history");
      this.requestUpdate();
    }
    if (this.#showingClosed && this.isFilterActive("sort", "mostvisited")) {
      this.activeFilters.delete("sort:mostvisited");
      this.activeFilters.add("sort:date");
      this.requestUpdate();
    }
    Services.prefs.setBoolPref(CLOSED_TABS_PREF, this.#showingClosed);
    this.library.requestUpdate();
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

  /**
   * The tabs this window has lost, a day at a time as history is read, each
   * of them the shape of a visit with what it takes to put the tab back.
   *
   * @returns {Map<number, object[]>} The days, newest first, and their tabs
   */
  #closedTabs() {
    const cutoff = Date.now() - this.#activeDaysOld * MS_PER_DAY;
    const query = this.searchQuery.toLowerCase();
    const tabs = [];
    for (const tab of lazy.SessionStore.getClosedTabData(window)) {
      const entry = tab.state?.entries?.[tab.state.index - 1];
      if (!entry?.url || tab.closedAt < cutoff) {
        continue;
      }
      const title = tab.title || entry.title || entry.url;
      if (query && !`${title} ${entry.url}`.toLowerCase().includes(query)) {
        continue;
      }
      tabs.push({
        url: entry.url,
        title,
        image: tab.image,
        date: new Date(tab.closedAt),
        lastAccessed: tab.state.lastAccessed ?? tab.closedAt,
        guid: `closed-${tab.closedId}`,
        closedId: tab.closedId,
      });
    }
    tabs.sort((a, b) => b.date - a.date);
    switch (this.#activeSort) {
      case "site":
        return this.#tabsBySite(tabs);
      case "lastvisited":
        // As history lists what was last visited: a plain list, newest first.
        return tabs.sort((a, b) => b.lastAccessed - a.lastAccessed);
      default:
        return this.#tabsByDay(tabs);
    }
  }

  /**
   * @param {object[]} tabs - Closed tabs, newest first
   * @returns {Map<number, object[]>} The days they were closed on and theirs
   */
  #tabsByDay(tabs) {
    const byDay = new Map();
    for (const tab of tabs) {
      const day = this.#placesQuery.getStartOfDayTimestamp(tab.date);
      const sameDay = byDay.get(day);
      if (sameDay) {
        sameDay.push(tab);
      } else {
        byDay.set(day, [tab]);
      }
    }
    return byDay;
  }

  /**
   * The sites, named as history names them, in the order history lists them:
   * by name, with what has no site of its own last.
   *
   * @param {object[]} tabs - Closed tabs, newest first
   * @returns {Map<string, object[]>} The sites and the tabs that were on them
   */
  #tabsBySite(tabs) {
    const bySite = new Map();
    for (const tab of tabs) {
      const protocol = URL.parse(tab.url)?.protocol;
      const site =
        protocol === "http:" || protocol === "https:"
          ? lazy.BrowserUtils.formatURIStringForDisplay(tab.url)
          : "";
      const sameSite = bySite.get(site);
      if (sameSite) {
        sameSite.push(tab);
      } else {
        bySite.set(site, [tab]);
      }
    }
    return new Map(
      [...bySite].sort(([one], [other]) => {
        if (!one || !other) {
          return one ? -1 : 1;
        }
        return one.localeCompare(other);
      })
    );
  }

  async #fetch() {
    if (this.#showingClosed) {
      this.#fetchGeneration++;
      this.#exhausted = true;
      this.visits = this.#closedTabs();
      this.requestUpdate();
      return;
    }
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

  /**
   * Opens a visit in a tab. Holding the accel key, or clicking with the
   * middle button, leaves the tab in the background and the library open.
   *
   * @param {object} visit
   * @param {MouseEvent} [event] - What asked for it
   */
  #openVisit(visit, event) {
    const inBackground =
      !!event && (event.getModifierState("Accel") || event.button === 1);
    const openTab =
      visit.closedId === undefined
        ? () => window.openTrustedLinkIn(visit.url, "tab", { inBackground })
        : () => this.#restoreTab(visit, inBackground);
    if (!inBackground) {
      openTab();
      this.library.constructor.toggle();
      return;
    }
    this.library.keepOpenWhile(openTab);
    gZenUIManager.showToast("library-history-opened-in-background");
  }

  /**
   * Puts a closed tab back where it was. A tab asked for in the background
   * is left behind the one being looked at, which the session store would
   * otherwise bring to the front.
   *
   * @param {object} visit - The closed tab a row stands for
   * @param {boolean} inBackground - Whether it is wanted out of the way
   */
  #restoreTab(visit, inBackground) {
    const selected = gBrowser.selectedTab;
    lazy.SessionStore.undoCloseById(visit.closedId, true, window);
    if (inBackground && gBrowser.selectedTab !== selected) {
      gBrowser.selectedTab = selected;
    }
  }

  /** The view of the old library window this section stands in for. */
  static legacyLibraryView = "History";

  /** @returns {object[]} What a right click on the history tab offers */
  static get tabMenu() {
    return [
      {
        l10nId: "library-history-clear",
        items: CLEAR_RANGES.map(range => ({
          l10nId: range.l10nId,
          separatorBefore: range.separatorBefore,
          command: () => clearHistory(range).catch(console.error),
        })),
      },
    ];
  }

  #forgetVisit(visit) {
    if (visit.closedId !== undefined) {
      lazy.SessionStore.forgetClosedTabById(visit.closedId);
      this.visits = this.#withoutClosedId(this.visits, visit.closedId);
      return;
    }
    lazy.PlacesUtils.history.remove(visit.url);
    this.visits = this.#withoutUrl(this.visits, visit.url);
  }

  #withoutClosedId(container, closedId) {
    const remaining = new Map();
    for (const [day, tabs] of container) {
      const left = tabs.filter(tab => tab.closedId !== closedId);
      if (left.length) {
        remaining.set(day, left);
      }
    }
    return remaining;
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

  /**
   * A visit drags as a link, so it can be dropped onto content, the tab
   * strip or another app.
   *
   * @param {DragEvent} event
   * @param {object} visit
   */
  #onDragStart(event, visit) {
    const { dataTransfer } = event;
    const title = visit.title || visit.url;
    dataTransfer.setData("text/x-moz-url", `${visit.url}\n${title}`);
    dataTransfer.setData("text/uri-list", visit.url);
    dataTransfer.setData("text/plain", visit.url);
    dataTransfer.effectAllowed = "copyLink";
    dataTransfer.addElement(event.currentTarget);
    // eslint-disable-next-line mozilla/valid-services
    Services.zen.playHapticFeedback();
  }

  #renderVisit(visit) {
    return html`
      <div
        class="zen-library-row"
        draggable="true"
        @click=${event => this.#openVisit(visit, event)}
        @auxclick=${event => {
          if (event.button === 1) {
            event.preventDefault();
            this.#openVisit(visit, event);
          }
        }}
        @dragstart=${event => this.#onDragStart(event, visit)}
      >
        <img
          class="zen-library-row-icon"
          src=${
            visit.image
              ? lazy.PlacesUIUtils.getImageURL(visit.image)
              : `page-icon:${visit.url}`
          }
          decoding="async"
          alt=""
        />
        <div class="zen-library-row-text">
          <span class="zen-library-row-title">${visit.title || visit.url}</span>
          <span class="zen-library-row-subtitle"
            ><span class="zen-library-visit-url"
              >${this.#formatUrl(visit.url)}</span
            ><span class="zen-library-visit-date"
              >${lazy.visitFormat.format(visit.date)}</span
            ></span
          >
        </div>
        <div class="zen-library-row-actions">
          <toolbarbutton
            class="toolbarbutton-1"
            data-l10n-id="library-history-forget-button"
            @click=${event => {
              event.stopPropagation();
              this.#forgetVisit(visit);
            }}
          >
            <img
              class="toolbarbutton-icon"
              src="chrome://browser/skin/zen-icons/trash.svg"
              alt=""
            />
          </toolbarbutton>
          <toolbarbutton
            class="toolbarbutton-1"
            data-l10n-id="library-history-reopen-button"
            @click=${event => {
              event.stopPropagation();
              this.#openVisit(visit, event);
            }}
          >
            <img
              class="toolbarbutton-icon"
              src="chrome://browser/skin/zen-icons/u-turn-to-left.svg"
              alt=""
            />
          </toolbarbutton>
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
      <div
        class="zen-library-empty"
        data-l10n-id=${
          this.#showingClosed
            ? "library-history-closed-empty"
            : "library-history-empty"
        }
      ></div>
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
        <div class="zen-library-group">${this.#renderVisits(this.visits)}</div>
      `;
    }
    if (!this.visits.size) {
      return this.#renderEmpty();
    }
    return repeat(
      this.visits.entries(),
      ([key]) => key,
      ([key, groupVisits]) => html`
        <div class="zen-library-group">
          ${this.#renderGroupHeader(key)} ${this.#renderVisits(groupVisits)}
        </div>
      `
    );
  }
}

customElements.define("zen-library-history-section", ZenLibraryHistorySection);
