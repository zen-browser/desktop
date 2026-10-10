/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import {
  UrlbarProvider,
  UrlbarUtils,
} from "moz-src:///browser/components/urlbar/UrlbarUtils.sys.mjs";
import { UrlbarShared } from "chrome://browser/content/urlbar/UrlbarShared.mjs";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  PlacesUtils: "resource://gre/modules/PlacesUtils.sys.mjs",
  UrlbarPrefs: "moz-src:///browser/components/urlbar/UrlbarPrefs.sys.mjs",
  UrlbarProviderOpenTabs:
    "moz-src:///browser/components/urlbar/UrlbarProviderOpenTabs.sys.mjs",
  UrlbarResult: "chrome://browser/content/urlbar/UrlbarResult.mjs",
});

const ENABLED_PREF = "zen.urlbar.suggestions.recent-history";
const MAX_RESULTS_PREF = "zen.urlbar.suggestions.recent-history.max-results";

// Most recently visited, non-hidden pages. moz_places has one row per url, so
// a page visited several times only shows up once.
const QUERY = `
  SELECT h.url, h.title, h.last_visit_date
  FROM moz_places h
  WHERE h.hidden = 0
    AND h.last_visit_date NOTNULL
    AND h.url_hash NOT BETWEEN hash('place', 'prefix_lo') AND hash('place', 'prefix_hi')
  ORDER BY h.last_visit_date DESC
  LIMIT :maxResults`;

export class ZenUrlbarProviderRecentHistory extends UrlbarProvider {
  get name() {
    return "ZenUrlbarProviderRecentHistory";
  }

  /**
   * @returns {Values<typeof UrlbarShared.PROVIDER_TYPE>}
   */
  get type() {
    return UrlbarShared.PROVIDER_TYPE.PROFILE;
  }

  async isActive(queryContext) {
    return (
      !queryContext.isPrivate &&
      !queryContext.searchString &&
      !queryContext.restrictSource &&
      !queryContext.restrictInSearchMode() &&
      Services.prefs.getBoolPref(ENABLED_PREF, true)
    );
  }

  /**
   * Same priority as UrlbarProviderTopSites, which would otherwise restrict
   * the empty search to top sites only.
   */
  getPriority() {
    return 1;
  }

  async startQuery(queryContext, addCallback) {
    const instance = this.queryInstance;
    const maxResults = Math.min(
      Services.prefs.getIntPref(MAX_RESULTS_PREF, 5),
      queryContext.maxResults
    );
    if (maxResults <= 0) {
      return;
    }
    const conn = await lazy.PlacesUtils.promiseLargeCacheDBConnection();
    if (instance != this.queryInstance) {
      return;
    }
    // Ask for one extra row in case the current page is among them.
    const rows = await conn.executeCached(QUERY, { maxResults: maxResults + 1 });
    if (instance != this.queryInstance) {
      return;
    }
    const openTabUrls = lazy.UrlbarPrefs.get("suggest.openpage")
      ? lazy.UrlbarProviderOpenTabs.getOpenTabUrls()
      : new Map();
    let resultsAdded = 0;
    for (const row of rows) {
      const url = row.getResultByName("url");
      if (url == queryContext.currentPage) {
        continue;
      }
      const lastVisit = lazy.PlacesUtils.toDate(
        row.getResultByName("last_visit_date")
      ).getTime();
      const title = row.getResultByName("title") || "";
      // Pages that are already open switch to their tab instead of opening
      // a new one.
      const openTab = [...(openTabUrls.get(url) || [])][0];
      if (openTab) {
        const [userContextId, tabGroup] = openTab;
        addCallback(
          this,
          new lazy.UrlbarResult({
            type: UrlbarShared.RESULT_TYPE.TAB_SWITCH,
            source: UrlbarShared.RESULT_SOURCE.TABS,
            payload: {
              url,
              title,
              icon: UrlbarShared.getIconForUrl(url),
              userContext: UrlbarUtils.getUserContextData(userContextId),
              tabGroup,
              lastVisit,
              action: lazy.UrlbarPrefs.get("secondaryActions.switchToTab")
                ? UrlbarUtils.createTabSwitchSecondaryAction(userContextId)
                : undefined,
            },
          })
        );
      } else {
        addCallback(
          this,
          new lazy.UrlbarResult({
            type: UrlbarShared.RESULT_TYPE.URL,
            source: UrlbarShared.RESULT_SOURCE.HISTORY,
            payload: {
              url,
              title,
              icon: UrlbarShared.getIconForUrl(url),
              lastVisit,
            },
          })
        );
      }
      if (++resultsAdded == maxResults) {
        return;
      }
    }
  }
}
