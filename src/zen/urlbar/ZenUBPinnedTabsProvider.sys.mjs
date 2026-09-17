/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { UrlbarProvider, UrlbarUtils } from "moz-src:///browser/components/urlbar/UrlbarUtils.sys.mjs";
import { UrlbarShared } from "chrome://browser/content/urlbar/UrlbarShared.mjs";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  UrlbarResult: "chrome://browser/content/urlbar/UrlbarResult.mjs",
  BrowserWindowTracker: "resource:///modules/BrowserWindowTracker.sys.mjs",
  PrivateBrowsingUtils: "resource://gre/modules/PrivateBrowsingUtils.sys.mjs",
});

/**
 * Matches pinned tabs that the user has renamed to a custom name by their
 * custom name, not just by the page's title. Regular "switch to tab" results
 * only match the actual page title recorded in Places, which never reflects
 * a pinned tab's Zen-specific custom label.
 */
export class ZenUrlbarProviderPinnedTabs extends UrlbarProvider {
  get name() {
    return "ZenUrlbarProviderPinnedTabs";
  }

  /**
   * @returns {Values<typeof UrlbarShared.PROVIDER_TYPE>}
   */
  get type() {
    return UrlbarShared.PROVIDER_TYPE.PROFILE;
  }

  async isActive(queryContext) {
    return (
      !queryContext.searchMode &&
      !!queryContext.searchString &&
      queryContext.searchString.length > 1
    );
  }

  #matchingPinnedTabs(queryContext) {
    const needle = queryContext.searchString.toLocaleLowerCase();
    const tabs = [];
    for (const win of lazy.BrowserWindowTracker.orderedWindows) {
      if (!win.gBrowser || win.closed) {
        continue;
      }
      if (
        lazy.PrivateBrowsingUtils.isWindowPrivate(win) != queryContext.isPrivate
      ) {
        continue;
      }
      for (const tab of win.gBrowser.tabs) {
        if (!tab.pinned) {
          continue;
        }
        const candidates = [
          tab.zenStaticLabel,
          tab.linkedBrowser?.contentTitle,
        ].filter(candidate => typeof candidate == "string" && candidate);
        if (
          candidates.some(candidate =>
            candidate.toLocaleLowerCase().includes(needle)
          )
        ) {
          tabs.push([win, tab]);
        }
      }
    }
    return tabs;
  }

  async startQuery(queryContext, addCallback) {
    const seen = new Set();
    for (const [win, tab] of this.#matchingPinnedTabs(queryContext)) {
      const url = tab.linkedBrowser?.currentURI?.spec;
      if (!url) {
        continue;
      }
      const userContextId = tab.userContextId ?? 0;
      const key = `${url}#${userContextId}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      addCallback(
        this,
        new lazy.UrlbarResult({
          type: UrlbarShared.RESULT_TYPE.TAB_SWITCH,
          source: UrlbarShared.RESULT_SOURCE.TABS,
          payload: {
            url,
            title: tab.zenStaticLabel || tab.linkedBrowser?.contentTitle,
            icon: win.gBrowser.getIcon(tab),
            userContext: UrlbarUtils.getUserContextData(userContextId),
            tabGroup: tab.group?.id ?? null,
          },
          highlights: {
            title: UrlbarShared.HIGHLIGHT.TYPED,
          },
        })
      );
    }
  }
}
