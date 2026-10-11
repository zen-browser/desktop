/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { UrlbarProvider } from "moz-src:///browser/components/urlbar/UrlbarUtils.sys.mjs";
import { UrlbarShared } from "chrome://browser/content/urlbar/UrlbarShared.mjs";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  UrlbarResult: "chrome://browser/content/urlbar/UrlbarResult.mjs",
});

const NOTE_URL = "mint://note";
const LABELS = ["notepad", "note", "notes"];

function matches(query) {
  if (!query || query.length < 2) {
    return false;
  }
  if (NOTE_URL.startsWith(query)) {
    return true;
  }
  return LABELS.some(label => label.startsWith(query));
}

/**
 * Suggests the local notepad when the address bar query looks like mint://note.
 */
export class ZenUrlbarProviderNotepad extends UrlbarProvider {
  get name() {
    return "ZenUrlbarProviderNotepad";
  }

  get type() {
    return UrlbarShared.PROVIDER_TYPE.PROFILE;
  }

  async isActive(queryContext) {
    return matches(queryContext.trimmedLowerCaseSearchString);
  }

  startQuery(queryContext, addCallback) {
    const result = new lazy.UrlbarResult({
      type: UrlbarShared.RESULT_TYPE.URL,
      source: UrlbarShared.RESULT_SOURCE.OTHER_LOCAL,
      suggestedIndex: 0,
      payload: {
        title: "Notepad",
        url: NOTE_URL,
        icon: "chrome://browser/skin/zen-icons/tab.svg",
      },
      highlights: {
        title: UrlbarShared.HIGHLIGHT.TYPED,
        url: UrlbarShared.HIGHLIGHT.TYPED,
      },
    });
    addCallback(this, result);
  }
}
