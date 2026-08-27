/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import {
  UrlbarProvider,
  UrlbarUtils,
} from "moz-src:///browser/components/urlbar/UrlbarUtils.sys.mjs";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  BrowserWindowTracker: "resource:///modules/BrowserWindowTracker.sys.mjs",
  PrivateBrowsingUtils: "resource://gre/modules/PrivateBrowsingUtils.sys.mjs",
  SessionStore: "resource:///modules/sessionstore/SessionStore.sys.mjs",
  UrlbarResult: "chrome://browser/content/urlbar/UrlbarResult.mjs",
  UrlbarShared: "chrome://browser/content/urlbar/UrlbarShared.mjs",
});

const targets = new Map();

function getQueryTerms(queryContext) {
  return queryContext.trimmedLowerCaseSearchString
    .split(/\s+/)
    .filter(
      term =>
        term && term != lazy.UrlbarShared.RESTRICT_TOKENS.OPENPAGE.toLowerCase()
    );
}

function getSessionEntry(tab) {
  try {
    const state = JSON.parse(lazy.SessionStore.getTabState(tab));
    const entries = state.entries || [];
    const index = Math.max(0, (state.index || entries.length) - 1);
    return entries[index] || null;
  } catch (error) {
    console.error("Unable to read Essential tab session state", error);
    return null;
  }
}

function getTabInfo(tab) {
  let sessionEntry = null;
  let url = tab.linkedBrowser?.currentURI?.spec;
  let title = tab.getAttribute("label") || tab.label;

  if (tab.hasAttribute("pending") || !url || !title) {
    sessionEntry = getSessionEntry(tab);
  }
  if (
    sessionEntry?.url &&
    (tab.hasAttribute("pending") || !url || url == "about:blank")
  ) {
    url = sessionEntry.url;
  }
  title ||= sessionEntry?.title || url;

  return {
    title,
    url,
    userContextId: parseInt(tab.getAttribute("usercontextid") || "0", 10),
  };
}

function scoreValue(value, term, baseScore) {
  value = value.toLocaleLowerCase();
  if (value == term) {
    return baseScore + 400;
  }
  if (value.startsWith(term)) {
    return baseScore + 300;
  }
  if (value.split(/[\s./:_-]+/).some(word => word.startsWith(term))) {
    return baseScore + 200;
  }
  if (value.includes(term)) {
    return baseScore + 100;
  }
  return 0;
}

function scoreMatch({ title, url }, terms) {
  let score = 0;
  for (const term of terms) {
    const termScore = Math.max(
      scoreValue(title || "", term, 400),
      scoreValue(url || "", term, 0)
    );
    if (!termScore) {
      return 0;
    }
    score += termScore;
  }
  return score;
}

function isValidTarget(tab, entry, payload, isPrivate) {
  const targetWindow = entry.windowRef.deref();
  if (
    !tab ||
    !targetWindow ||
    targetWindow.closed ||
    tab.closing ||
    !tab.isConnected ||
    tab.documentGlobal != targetWindow ||
    !targetWindow.gBrowser?.isTab(tab) ||
    !tab.hasAttribute("zen-essential") ||
    lazy.PrivateBrowsingUtils.isWindowPrivate(targetWindow) != isPrivate
  ) {
    return false;
  }

  const info = getTabInfo(tab);
  return (
    info.url == entry.url &&
    info.url == payload.url &&
    info.userContextId == entry.userContextId &&
    info.userContextId == payload.userContextId &&
    scoreMatch(info, entry.terms) > 0
  );
}

/**
 * Provides exact, high-priority switch-to-tab results for Essential tabs.
 */
export class ZenUrlbarProviderEssentials extends UrlbarProvider {
  get type() {
    return UrlbarUtils.PROVIDER_TYPE.PROFILE;
  }

  async isActive(queryContext) {
    return (
      queryContext.sapName == "urlbar" &&
      !!getQueryTerms(queryContext).length &&
      (!queryContext.sources ||
        queryContext.sources.includes(lazy.UrlbarShared.RESULT_SOURCE.TABS))
    );
  }

  startQuery(queryContext, addCallback) {
    targets.clear();

    const terms = getQueryTerms(queryContext);
    const sourceWindow = lazy.BrowserWindowTracker.getTopWindow({
      private: queryContext.isPrivate,
    });
    const matches = [];

    for (const targetWindow of lazy.BrowserWindowTracker.getOrderedWindows({
      private: queryContext.isPrivate,
    })) {
      if (targetWindow.closed || !targetWindow.gZenWorkspaces) {
        continue;
      }
      for (const tab of targetWindow.gZenWorkspaces.allStoredTabs) {
        if (
          tab == sourceWindow?.gBrowser.selectedTab ||
          !tab.hasAttribute("zen-essential") ||
          tab.closing
        ) {
          continue;
        }

        const info = getTabInfo(tab);
        const score = scoreMatch(info, terms);
        if (!score || !info.url) {
          continue;
        }

        matches.push({ info, score, tab, targetWindow });
      }
    }

    matches
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.info.title.length - b.info.title.length ||
          a.info.url.localeCompare(b.info.url)
      )
      .forEach(({ info, tab, targetWindow }) => {
        const token = Services.uuid.generateUUID().toString();
        targets.set(token, {
          tabRef: new WeakRef(tab),
          windowRef: new WeakRef(targetWindow),
          url: info.url,
          userContextId: info.userContextId,
          terms,
        });

        addCallback(
          this,
          new lazy.UrlbarResult({
            type: lazy.UrlbarShared.RESULT_TYPE.TAB_SWITCH,
            source: lazy.UrlbarShared.RESULT_SOURCE.TABS,
            group: UrlbarUtils.RESULT_GROUP.ZEN_ESSENTIAL,
            payload: {
              url: info.url,
              title: info.title,
              icon:
                tab.getAttribute("image") ||
                UrlbarUtils.getIconForUrl(info.url),
              userContextId: info.userContextId,
              tabGroup: tab.group?.id,
              zenEssentialTarget: token,
            },
            highlights: {
              title: UrlbarUtils.HIGHLIGHT.TYPED,
              url: UrlbarUtils.HIGHLIGHT.TYPED,
            },
          })
        );
      });
  }

  /**
   * Re-resolves and switches to an Essential result's exact runtime target.
   *
   * @param {object} payload The picked result payload.
   * @param {boolean} isPrivate Whether the source window is private.
   * @returns {boolean} Whether a valid target was found.
   */
  static switchToTarget(payload, isPrivate) {
    const entry = targets.get(payload.zenEssentialTarget);
    targets.delete(payload.zenEssentialTarget);
    const tab = entry?.tabRef.deref();
    if (!entry || !isValidTarget(tab, entry, payload, isPrivate)) {
      return false;
    }

    const targetWindow = entry.windowRef.deref();
    targetWindow.focus();
    void targetWindow.gZenWorkspaces.switchTabIfNeeded(tab).then(() => {
      if (!targetWindow.closed) {
        targetWindow.gBrowser.selectedBrowser.focus();
      }
    });
    return true;
  }
}
