/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { XPCOMUtils } from "resource://gre/modules/XPCOMUtils.sys.mjs";
import { UrlbarProvider } from "moz-src:///browser/components/urlbar/UrlbarUtils.sys.mjs";
import { UrlbarShared } from "chrome://browser/content/urlbar/UrlbarShared.mjs";

const lazy = {};

const DYNAMIC_TYPE_NAME = "zen-pinned-tab";

// Most pinned tab rows shown for a single query.
const MAX_PINNED_RESULTS = 5;

ChromeUtils.defineESModuleGetters(lazy, {
  UrlbarResult: "chrome://browser/content/urlbar/UrlbarResult.mjs",
  BrowserWindowTracker: "resource:///modules/BrowserWindowTracker.sys.mjs",
});

ChromeUtils.defineLazyGetter(lazy, "l10n", () => {
  return new Localization(["browser/browser.ftl"], true);
});

XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "enabledPref",
  "zen.urlbar.suggestions.pinned-tabs",
  true
);

XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "allSpacesPref",
  "zen.urlbar.suggestions.pinned-tabs.all-spaces",
  false
);

/**
 * Whether the typed text should be treated as a URL, in which case the
 * heuristic row must stay Firefox's own and pinned tabs go below it.
 *
 * @param {string} text The trimmed search string.
 * @returns {boolean}
 */
function looksLikeUrl(text) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(text)) {
    return true;
  }
  return !/\s/.test(text) && text.includes(".");
}

function hostOf(url) {
  try {
    let host = new URL(url).hostname;
    if (host.startsWith("www.")) {
      host = host.slice(4);
    }
    return host;
  } catch (e) {
    return "";
  }
}

/**
 * Returns the labels of the folders containing a tab, outermost first.
 *
 * @param {MozTabbrowserTab} tab The tab.
 * @returns {string[]}
 */
function folderPath(tab) {
  const names = [];
  let element = tab.parentElement;
  while (element) {
    const folder = element.closest("zen-folder");
    if (!folder) {
      break;
    }
    const label = (folder.label || folder.getAttribute("label") || "").trim();
    if (label) {
      names.unshift(label);
    }
    element = folder.parentElement;
  }
  return names;
}

function tabIcon(tab, url) {
  const image =
    tab.getAttribute("image") ||
    tab.zenStaticIcon ||
    tab._zenPinnedInitialState?.image ||
    "";
  if (image) {
    return image;
  }
  if (url && /^https?:/i.test(url)) {
    return "page-icon:" + url;
  }
  return "chrome://browser/skin/zen-icons/pin.svg";
}

function wordStartsWith(text, needle) {
  if (text.startsWith(needle)) {
    return true;
  }
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp("[\\s\\-_./:]" + escaped).test(text);
}

function isSubsequence(text, needle) {
  let i = 0;
  for (const ch of text) {
    if (ch === needle[i]) {
      i++;
      if (i === needle.length) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Scores a candidate against the query. Higher is better, 0 is no match.
 * Label matches rank above host matches, which rank above URL matches.
 *
 * @param {object} candidate A candidate built by #describeTab.
 * @param {string} query The lower case query.
 * @param {string[]} tokens The lower case query tokens.
 * @returns {number}
 */
function scoreCandidate(candidate, query, tokens) {
  const { labelLower, hostLower, urlLower, pinnedUrlLower } = candidate;
  if (labelLower === query) {
    return 1000;
  }
  if (labelLower.startsWith(query)) {
    return 900;
  }
  if (wordStartsWith(labelLower, query)) {
    return 850;
  }
  if (labelLower.includes(query)) {
    return 800;
  }
  if (hostLower && hostLower.startsWith(query)) {
    return 700;
  }
  if (hostLower && hostLower.includes(query)) {
    return 600;
  }
  if (urlLower.includes(query) || pinnedUrlLower.includes(query)) {
    return 500;
  }
  if (tokens.length > 1) {
    const haystack = `${labelLower} ${hostLower} ${urlLower}`;
    if (tokens.every(token => haystack.includes(token))) {
      return 400;
    }
  }
  if (query.length >= 2 && isSubsequence(labelLower, query)) {
    return 300;
  }
  return 0;
}

function highlightsFor(tokens, text) {
  if (!text || !tokens.length) {
    return [];
  }
  return UrlbarShared.getTokenMatches(
    tokens,
    text,
    UrlbarShared.HIGHLIGHT.TYPED
  );
}

/**
 * A provider that offers pinned tabs and Essentials of the current space as
 * switch-to-tab results, whether or not the tab is loaded. Firefox's own
 * switch-to-tab results only cover browsers registered in the open pages
 * table, which unloaded pins are not.
 *
 * Results are DYNAMIC rather than TAB_SWITCH on purpose: picking a TAB_SWITCH
 * result calls `switchToTabHavingURI(uri, true)`, which opens a new tab when no
 * browser's current URI matches, and that is exactly the state of a pin that
 * is being restored from session store. Selecting the tab ourselves in
 * `onEngagement` is the same path a click in the sidebar takes.
 */
export class ZenUrlbarProviderPinnedTabs extends UrlbarProvider {
  #tabsByKey = new Map();
  #keyCounter = 0;

  get name() {
    return "ZenUrlbarProviderPinnedTabs";
  }

  /**
   * @returns {Values<typeof UrlbarShared.PROVIDER_TYPE>}
   */
  get type() {
    // Heuristic so the rows arrive with the first batch of results and the
    // list does not reorder once the pins show up. The query is synchronous
    // and only walks the pinned tabs of the window.
    return UrlbarShared.PROVIDER_TYPE.HEURISTIC;
  }

  /**
   * Whether this provider should be invoked for the given context.
   *
   * @param {UrlbarQueryContext} queryContext The query context object
   */
  async isActive(queryContext) {
    if (!lazy.enabledPref || queryContext.isPrivate) {
      return false;
    }
    const window = lazy.BrowserWindowTracker.getTopWindow();
    if (
      !window?.gZenWorkspaces ||
      window.gZenWorkspaces.privateWindowOrDisabled
    ) {
      return false;
    }
    const mode = queryContext.searchMode;
    if (
      mode &&
      (mode.engineName || mode.source != UrlbarShared.RESULT_SOURCE.TABS)
    ) {
      return false;
    }
    if (this.#hasForeignRestrictToken(queryContext)) {
      return false;
    }
    const query = this.#queryText(queryContext);
    return !!query && query.length < UrlbarShared.MAX_TEXT_LENGTH;
  }

  #hasForeignRestrictToken(queryContext) {
    const T = UrlbarShared.TOKEN_TYPE;
    return (queryContext.tokens || []).some(
      t =>
        t.type === T.RESTRICT_HISTORY ||
        t.type === T.RESTRICT_BOOKMARK ||
        t.type === T.RESTRICT_TAG ||
        t.type === T.RESTRICT_SEARCH ||
        t.type === T.RESTRICT_ACTION ||
        t.type === T.RESTRICT_WORKSPACE
    );
  }

  #textTokens(queryContext) {
    const T = UrlbarShared.TOKEN_TYPE;
    const restrict = new Set([
      T.RESTRICT_HISTORY,
      T.RESTRICT_BOOKMARK,
      T.RESTRICT_TAG,
      T.RESTRICT_OPENPAGE,
      T.RESTRICT_SEARCH,
      T.RESTRICT_TITLE,
      T.RESTRICT_URL,
      T.RESTRICT_ACTION,
      T.RESTRICT_WORKSPACE,
    ]);
    return (queryContext.tokens || []).filter(
      t => !restrict.has(t.type) && t.lowerCaseValue
    );
  }

  #queryText(queryContext) {
    const tokens = this.#textTokens(queryContext);
    if (tokens.length) {
      return tokens.map(t => t.lowerCaseValue).join(" ");
    }
    return queryContext.trimmedLowerCaseSearchString || "";
  }

  #describeTab(tab, window, index) {
    const pinnedUrl = tab._zenPinnedInitialState?.entry?.url || "";
    let tabUrl = "";
    try {
      // For a lazy browser this getter returns the session entry, which is
      // the URL the tab restores to, not about:blank.
      tabUrl = tab.linkedBrowser?.currentURI?.spec || "";
    } catch (e) {
      tabUrl = "";
    }
    if (!tabUrl || tabUrl == "about:blank") {
      tabUrl = pinnedUrl;
    }
    const url = tabUrl || pinnedUrl;
    const host = hostOf(url);
    const label = (
      tab.zenStaticLabel ||
      tab.label ||
      tab._zenPinnedInitialState?.entry?.title ||
      host ||
      url
    ).trim();
    const isEssential = tab.hasAttribute("zen-essential");
    const workspaceId = tab.getAttribute("zen-workspace-id") || "";
    let spaceName = "";
    if (!isEssential && workspaceId) {
      spaceName =
        window.gZenWorkspaces.getWorkspaceFromId(workspaceId)?.name || "";
    }
    return {
      tab,
      index,
      label,
      labelLower: label.toLowerCase(),
      url,
      urlLower: url.toLowerCase(),
      pinnedUrl,
      pinnedUrlLower: pinnedUrl.toLowerCase(),
      host,
      folders: folderPath(tab),
      spaceName,
      isEssential,
      isPending: tab.hasAttribute("pending"),
      icon: tabIcon(tab, url),
    };
  }

  /**
   * Collects pinned tabs and Essentials visible in the active space, in
   * sidebar order, pins first.
   *
   * @param {Window} window The browser window.
   * @returns {object[]}
   */
  #collectCandidates(window) {
    const gZenWorkspaces = window.gZenWorkspaces;
    const workspaces = gZenWorkspaces.getWorkspaces();
    const active = gZenWorkspaces.getActiveWorkspaceFromCache();
    const pins = [];
    const essentials = [];
    let index = 0;
    for (const tab of gZenWorkspaces.allStoredTabs) {
      if (
        !tab.pinned ||
        tab.closing ||
        !tab.isConnected ||
        tab.hasAttribute("zen-empty-tab") ||
        tab.hasAttribute("zen-glance-tab")
      ) {
        continue;
      }
      const isEssential = tab.hasAttribute("zen-essential");
      if (
        !lazy.allSpacesPref &&
        active &&
        !gZenWorkspaces._shouldShowTab(
          tab,
          active.uuid,
          active.containerTabId,
          workspaces
        )
      ) {
        continue;
      }
      (isEssential ? essentials : pins).push(
        this.#describeTab(tab, window, index++)
      );
    }
    return pins.concat(essentials);
  }

  /**
   * Starts a search query among the pinned tabs of the current window.
   *
   * @param {UrlbarQueryContext} queryContext
   * @param {(provider: UrlbarProvider, result: UrlbarResult) => void} addCallback
   */
  async startQuery(queryContext, addCallback) {
    const window = lazy.BrowserWindowTracker.getTopWindow();
    if (!window?.gZenWorkspaces) {
      return;
    }
    const tokens = this.#textTokens(queryContext);
    const query = this.#queryText(queryContext);
    if (!query) {
      return;
    }
    const tokenValues = tokens.map(t => t.lowerCaseValue);
    const inTabsMode =
      queryContext.searchMode?.source == UrlbarShared.RESULT_SOURCE.TABS;

    const matches = this.#collectCandidates(window)
      .map(candidate => ({
        candidate,
        score: scoreCandidate(candidate, query, tokenValues),
      }))
      .filter(match => match.score > 0)
      .sort(
        (a, b) => b.score - a.score || a.candidate.index - b.candidate.index
      )
      .slice(0, MAX_PINNED_RESULTS);
    if (!matches.length) {
      return;
    }

    // The best match is the heuristic, so it is pre-selected and Enter
    // switches to it. That is skipped when the input looks like a URL (the
    // heuristic must stay Firefox's own) and in tabs search mode, where
    // Firefox drops heuristic results.
    const takeTop =
      !inTabsMode && !looksLikeUrl(queryContext.trimmedSearchString || query);
    let nextIndex = inTabsMode ? 0 : 1;
    const source = inTabsMode
      ? UrlbarShared.RESULT_SOURCE.TABS
      : UrlbarShared.RESULT_SOURCE.ZEN_PINNED_TABS;
    const actionLabel = lazy.l10n.formatValueSync(
      "urlbar-result-action-switch-tab"
    );

    this.#tabsByKey.clear();
    let isFirst = true;
    for (const { candidate } of matches) {
      const key = String(++this.#keyCounter);
      this.#tabsByKey.set(key, new WeakRef(candidate.tab));

      const crumbs = [];
      if (lazy.allSpacesPref && candidate.spaceName) {
        crumbs.push(candidate.spaceName);
      }
      crumbs.push(...candidate.folders);
      const breadcrumb = crumbs.join(" / ");

      const heuristic = isFirst && takeTop;
      const result = new lazy.UrlbarResult({
        type: UrlbarShared.RESULT_TYPE.DYNAMIC,
        source,
        payload: {
          dynamicType: DYNAMIC_TYPE_NAME,
          title: candidate.label,
          titleHighlights: highlightsFor(tokens, candidate.label),
          breadcrumb,
          breadcrumbHighlights: highlightsFor(tokens, breadcrumb),
          host: candidate.host,
          hostHighlights: highlightsFor(tokens, candidate.host),
          // Deliberately not `url`: a url payload would make the input load
          // it on pick instead of leaving the switch to onEngagement.
          tabUrl: candidate.url,
          pinnedUrl: candidate.pinnedUrl,
          icon: candidate.icon,
          isPending: candidate.isPending,
          isEssential: candidate.isEssential,
          actionLabel,
          // Keeps the typed text in the input when the row is arrowed onto.
          query: queryContext.searchString,
          pinKey: key,
          tabId: candidate.tab.id || "",
        },
        heuristic,
        suggestedIndex: heuristic ? undefined : nextIndex++,
      });
      addCallback(this, result);
      isFirst = false;
    }
  }

  getPriority() {
    return 0;
  }

  getViewTemplate() {
    return {
      name: "root",
      attributes: {
        selectable: true,
      },
      children: [
        {
          name: "icon",
          tag: "img",
          classList: ["urlbarView-favicon"],
        },
        {
          name: "title",
          tag: "span",
          classList: ["urlbarView-title", "urlbarView-overflowable"],
        },
        {
          name: "separator",
          tag: "span",
          classList: ["urlbarView-title-separator"],
        },
        {
          name: "breadcrumb",
          tag: "span",
          classList: [
            "urlbarView-url",
            "urlbarView-overflowable",
            "zen-pinned-tab-breadcrumb",
          ],
        },
        {
          name: "breadcrumbSeparator",
          tag: "span",
          classList: ["urlbarView-title-separator"],
        },
        {
          name: "url",
          tag: "span",
          classList: ["urlbarView-url", "urlbarView-overflowable"],
        },
        {
          name: "action",
          tag: "span",
          classList: ["urlbarView-action"],
        },
      ],
    };
  }

  getViewUpdate(result) {
    const payload = result.payload;
    const hasBreadcrumb = !!payload.breadcrumb;
    const hasHost = !!payload.host;
    return {
      root: {
        attributes: {
          "zen-pending": !!payload.isPending,
          "zen-essential": !!payload.isEssential,
        },
      },
      icon: {
        attributes: { src: payload.icon || "" },
      },
      title: {
        textContent: payload.title,
        highlights: payload.titleHighlights,
        attributes: { dir: "auto" },
      },
      separator: {
        attributes: { hidden: !(hasBreadcrumb || hasHost) },
      },
      breadcrumb: {
        textContent: payload.breadcrumb || "",
        highlights: payload.breadcrumbHighlights,
        attributes: { hidden: !hasBreadcrumb, dir: "auto" },
      },
      breadcrumbSeparator: {
        attributes: { hidden: !(hasBreadcrumb && hasHost) },
      },
      url: {
        textContent: payload.host || "",
        highlights: payload.hostHighlights,
        attributes: { hidden: !hasHost, dir: "ltr" },
      },
      action: {
        textContent: payload.actionLabel,
      },
    };
  }

  onEngagement(queryContext, controller, details) {
    const result = details.result;
    if (result?.providerName != this.name) {
      return;
    }
    const ownerGlobal = details.element.documentGlobal;
    const payload = result.payload;
    let tab = this.#tabsByKey.get(payload.pinKey)?.deref();
    if ((!tab || !tab.isConnected) && payload.tabId) {
      tab = ownerGlobal.document.getElementById(payload.tabId);
    }
    if (
      !tab ||
      !ownerGlobal.gBrowser.isTab(tab) ||
      tab.closing ||
      !tab.isConnected
    ) {
      return;
    }
    // Same call a sidebar click makes: Zen's setter switches space when the
    // tab lives elsewhere and session store restores a pending pin.
    if (ownerGlobal.gBrowser.selectedTab !== tab) {
      ownerGlobal.gBrowser.selectedTab = tab;
    }
    tab.linkedBrowser?.focus();
  }
}
