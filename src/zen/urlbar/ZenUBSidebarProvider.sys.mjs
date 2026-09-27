/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import {
  UrlbarProvider,
  UrlbarUtils,
} from "moz-src:///browser/components/urlbar/UrlbarUtils.sys.mjs";
import { UrlbarShared } from "chrome://browser/content/urlbar/UrlbarShared.mjs";
import { formatValueSync } from "resource:///modules/ZenUBGlobalActions.sys.mjs";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  UrlbarResult: "chrome://browser/content/urlbar/UrlbarResult.mjs",
  BrowserWindowTracker: "resource:///modules/BrowserWindowTracker.sys.mjs",
  UrlbarPrefs: "moz-src:///browser/components/urlbar/UrlbarPrefs.sys.mjs",
  UrlbarProviderOpenTabs:
    "moz-src:///browser/components/urlbar/UrlbarProviderOpenTabs.sys.mjs",
  ZenSessionStore: "resource:///modules/zen/ZenSessionManager.sys.mjs",
});

const DYNAMIC_TYPE_NAME = "zen-folders";

export class ZenUrlbarProviderSidebar extends UrlbarProvider {
  get name() {
    return "ZenUrlbarProviderSidebar";
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
      !!queryContext.tokens.length &&
      queryContext.sources.includes(UrlbarShared.RESULT_SOURCE.TABS) &&
      lazy.UrlbarPrefs.get("suggest.openpage")
    );
  }

  async startQuery(queryContext, addCallback) {
    const sidebar = lazy.ZenSessionStore.getSidebarData();
    if (!sidebar) {
      return;
    }
    const tokens = queryContext.tokens.map(t => t.lowerCaseValue);
    const score = text => {
      text = text.toLowerCase();
      if (!tokens.every(token => text.includes(token))) {
        return 0;
      }
      return tokens.reduce((sum, token) => sum + token.length, 0) / text.length;
    };
    this.#addFolders(sidebar, score, queryContext, addCallback);
    this.#addTabs(sidebar, score, queryContext, addCallback);
  }

  #addTabs(sidebar, score, queryContext, addCallback) {
    const openTabUrls = lazy.UrlbarProviderOpenTabs.getOpenTabUrls();
    const activeSpace =
      lazy.BrowserWindowTracker.getTopWindow().gZenWorkspaces.activeWorkspace;
    let resultsAdded = 0;
    for (const tabData of sidebar.tabs || []) {
      // Essentials have no space, they are part of every one of them.
      if (!tabData.zenEssential && tabData.zenWorkspace != activeSpace) {
        continue;
      }
      const entries = tabData.entries || [];
      const entry = entries[(tabData.index || entries.length) - 1];
      const label = tabData.zenStaticLabel || entry?.title;
      if (typeof label !== "string" || !label || !score(label)) {
        continue;
      }
      const url = entry?.url;
      if (!url || url == queryContext.currentPage) {
        // Don't suggest switching to the current tab.
        continue;
      }
      const userContextId = tabData.userContextId || 0;
      // The sidebar data can lag behind a navigation, only offer tabs that
      // are still registered as open with this url.
      const openTab = [...(openTabUrls.get(url) || [])].find(
        ([contextId]) => contextId == userContextId
      );
      if (!openTab) {
        continue;
      }
      addCallback(
        this,
        new lazy.UrlbarResult({
          type: UrlbarShared.RESULT_TYPE.TAB_SWITCH,
          source: UrlbarShared.RESULT_SOURCE.TABS,
          payload: {
            url,
            title: label,
            icon: UrlbarShared.getIconForUrl(url),
            userContext: UrlbarUtils.getUserContextData(userContextId),
            tabGroup: openTab[1],
            action: lazy.UrlbarPrefs.get("secondaryActions.switchToTab")
              ? UrlbarUtils.createTabSwitchSecondaryAction(userContextId)
              : undefined,
          },
          highlights: {
            url: UrlbarShared.HIGHLIGHT.TYPED,
            title: UrlbarShared.HIGHLIGHT.TYPED,
          },
        })
      );
      if (++resultsAdded == queryContext.maxResults) {
        return;
      }
    }
  }

  #addFolders(sidebar, score, queryContext, addCallback) {
    const folders = new Map(
      (sidebar.folders || []).map(folder => [folder.id, folder])
    );
    const matched = [...folders.values()]
      .filter(folder => !folder.splitViewGroup && folder.name)
      .map(folder => ({ folder, score: score(folder.name) }))
      .filter(match => match.score)
      .sort((a, b) => b.score - a.score);
    for (const match of matched) {
      const { folder } = match;
      const space = sidebar.spaces?.find(s => s.uuid == folder.workspaceId);
      const path = [folder.name];
      for (
        let parent = folders.get(folder.parentId);
        parent;
        parent = folders.get(parent.parentId)
      ) {
        path.unshift(parent.name);
      }
      if (space?.name) {
        path.unshift(space.name);
      }
      addCallback(
        this,
        new lazy.UrlbarResult({
          type: UrlbarShared.RESULT_TYPE.DYNAMIC,
          source: UrlbarShared.RESULT_SOURCE.TABS,
          payload: {
            dynamicType: DYNAMIC_TYPE_NAME,
            zenFolderId: folder.id,
            titleL10n: "zen-action-open",
            userIcon: folder.userIcon,
            icon: "chrome://browser/skin/zen-icons/folder.svg",
            path: path.join(" / "),
          },
          suggestedIndex:
            1 +
            Math.round(
              (1 - Math.min(match.score, 1)) * (queryContext.maxResults - 2)
            ),
        })
      );
    }
  }

  getViewUpdate(result) {
    return {
      icon: { attributes: { src: result.payload.icon } },
      titleStrong: {
        textContent: formatValueSync(result.payload.titleL10n),
        attributes: { dir: "ltr" },
      },
      path: {
        textContent: result.payload.path,
        attributes: { dir: "ltr", hidden: !result.payload.path },
      },
      userIcon: {
        attributes: {
          src: result.payload.userIcon,
          hidden: !result.payload.userIcon,
        },
      },
    };
  }

  getViewTemplate() {
    return {
      attributes: {
        selectable: true,
      },
      children: [
        {
          name: "icon",
          tag: "img",
          classList: ["urlbarView-favicon", "urlbarView-action-favicon"],
        },
        {
          name: "title",
          tag: "span",
          classList: ["urlbarView-title"],
          children: [
            {
              name: "titleStrong",
              tag: "strong",
            },
          ],
        },
        {
          tag: "span",
          classList: ["urlbarView-prettyName"],
          children: [
            {
              name: "userIcon",
              tag: "img",
              attributes: { hidden: true },
            },
            {
              name: "path",
              tag: "span",
            },
          ],
        },
      ],
    };
  }

  onEngagement(queryContext, controller, details) {
    const { zenFolderId } = details.result.payload;
    if (!zenFolderId) {
      return;
    }
    const ownerGlobal = details.element.documentGlobal;
    ownerGlobal.gBrowser.selectedBrowser.focus();
    const folder = ownerGlobal.document.getElementById(zenFolderId);
    if (folder?.isZenFolder) {
      ownerGlobal.gZenFolders.revealFolder(folder);
    }
  }
}
