/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { UrlbarProvider } from "moz-src:///browser/components/urlbar/UrlbarUtils.sys.mjs";
import { UrlbarShared } from "chrome://browser/content/urlbar/UrlbarShared.mjs";
import { gZenUrlSnippets } from "resource:///modules/zen/urlsnippets/ZenUrlSnippetsManager.sys.mjs";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  UrlbarResult: "chrome://browser/content/urlbar/UrlbarResult.mjs",
});

/**
 * Shows URL snippets while the address bar is in snippets search mode.
 */
export class ZenUrlbarProviderSnippets extends UrlbarProvider {
  get name() {
    return "ZenUrlbarProviderSnippets";
  }

  get type() {
    return UrlbarShared.PROVIDER_TYPE.PROFILE;
  }

  /**
   * @param {UrlbarQueryContext} queryContext
   * @returns {Promise<boolean>}
   */
  async isActive(queryContext) {
    return queryContext.searchMode?.source == UrlbarShared.RESULT_SOURCE.SNIPPETS;
  }

  /**
   * @param {UrlbarQueryContext} queryContext
   * @param {(provider: UrlbarProvider, result: UrlbarResult) => void} addCallback
   */
  async startQuery(queryContext, addCallback) {
    await gZenUrlSnippets.ready();
    const matches = gZenUrlSnippets.match(queryContext.searchString);
    for (const { snippet, heuristic } of matches) {
      addCallback(
        this,
        new lazy.UrlbarResult({
          type: UrlbarShared.RESULT_TYPE.URL,
          source: UrlbarShared.RESULT_SOURCE.SNIPPETS,
          heuristic,
          payload: {
            title: snippet.shortcut,
            url: snippet.url,
            icon: "chrome://browser/skin/zen-icons/link.svg",
          },
        })
      );
    }
  }
}
