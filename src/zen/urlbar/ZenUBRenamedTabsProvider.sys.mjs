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
  UrlbarPrefs: "moz-src:///browser/components/urlbar/UrlbarPrefs.sys.mjs",
  UrlbarProviderOpenTabs:
    "moz-src:///browser/components/urlbar/UrlbarProviderOpenTabs.sys.mjs",
  UrlbarResult: "moz-src:///browser/components/urlbar/UrlbarResult.sys.mjs",
  UrlbarTokenizer:
    "moz-src:///browser/components/urlbar/UrlbarTokenizer.sys.mjs",
});

/**
 * Provides switch-to-tab results that match a tab's Zen-specific static label.
 */
export class ZenUrlbarProviderRenamedTabs extends UrlbarProvider {
  /**
   * @returns {Values<typeof UrlbarUtils.PROVIDER_TYPE>}
   */
  get type() {
    return UrlbarUtils.PROVIDER_TYPE.PROFILE;
  }

  /**
   * @param {UrlbarQueryContext} queryContext The query context object.
   * @returns {Promise<boolean>}
   */
  async isActive(queryContext) {
    return (
      queryContext.sources.includes(UrlbarUtils.RESULT_SOURCE.TABS) &&
      queryContext.tokens.some(
        token => token.value && !lazy.UrlbarTokenizer.isRestrictionToken(token)
      )
    );
  }

  /**
   * @param {UrlbarQueryContext} queryContext The query context object.
   * @param {(provider: UrlbarProvider, result: UrlbarResult) => void} addCallback
   *   Callback invoked by the provider to add a result.
   */
  async startQuery(queryContext, addCallback) {
    const tokens = queryContext.tokens.filter(
      token => token.value && !lazy.UrlbarTokenizer.isRestrictionToken(token)
    );
    const activeWindow = lazy.BrowserWindowTracker.getTopWindow({
      private: queryContext.isPrivate,
    });

    for (const browserWindow of lazy.BrowserWindowTracker.orderedWindows) {
      if (
        browserWindow.closed ||
        !browserWindow.gBrowser ||
        lazy.PrivateBrowsingUtils.isWindowPrivate(browserWindow) !=
          queryContext.isPrivate
      ) {
        continue;
      }

      for (const tab of browserWindow.gBrowser.tabs) {
        const title = tab.zenStaticLabel;
        if (
          tab.closing ||
          typeof title != "string" ||
          !title.trim() ||
          (browserWindow == activeWindow && tab.selected)
        ) {
          continue;
        }

        const lowerCaseTitle = title.toLocaleLowerCase();
        if (
          !tokens.every(token => lowerCaseTitle.includes(token.lowerCaseValue))
        ) {
          continue;
        }

        const url = tab.linkedBrowser?.currentURI?.spec;
        if (!url || browserWindow.isBlankPageURL(url)) {
          continue;
        }

        const userContextId =
          lazy.UrlbarProviderOpenTabs.getUserContextIdForOpenPagesTable(
            tab.userContextId,
            queryContext.isPrivate
          );
        const payload = {
          url,
          title,
          icon:
            browserWindow.gBrowser.getIcon(tab) ||
            UrlbarUtils.getIconForUrl(url),
          userContextId,
          action: lazy.UrlbarPrefs.get("secondaryActions.switchToTab")
            ? UrlbarUtils.createTabSwitchSecondaryAction(userContextId)
            : undefined,
        };
        if (tab.group?.id) {
          payload.tabGroup = tab.group.id;
        }

        addCallback(
          this,
          new lazy.UrlbarResult({
            type: UrlbarUtils.RESULT_TYPE.TAB_SWITCH,
            source: UrlbarUtils.RESULT_SOURCE.TABS,
            payload,
            highlights: {
              url: UrlbarUtils.HIGHLIGHT.TYPED,
              title: UrlbarUtils.HIGHLIGHT.TYPED,
            },
          })
        );
      }
    }
  }

  /**
   * @returns {number} The provider priority.
   */
  getPriority() {
    return 0;
  }
}
