/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { PromiseTestUtils } = ChromeUtils.importESModule(
  "resource://testing-common/PromiseTestUtils.sys.mjs"
);
const { TabStateFlusher } = ChromeUtils.importESModule(
  "resource:///modules/sessionstore/TabStateFlusher.sys.mjs"
);
add_setup(function allowBenignEnvironmentRejections() {
  // Two pre-existing, environment-only rejections unrelated to the tree feature:
  //  - closing tabs tears down the ZenGlance actor mid-query ("destroyed before
  //    query");
  //  - opening the tab context menu in this unofficial/`faster` build hits
  //    Fluent strings that aren't packaged ("Couldn't find a message: ...").
  PromiseTestUtils.allowMatchingRejectionsGlobally(
    /destroyed before query|Couldn't find a message/
  );
});

async function addNormalTab(url = "about:blank") {
  // NB: don't await browserLoaded() for about:blank — its load event doesn't
  // fire the way browserLoaded expects, so the wait hangs the whole test. The
  // tree tests only need the tab to exist in the strip, which addTab provides
  // synchronously (TabOpen fires before it returns).
  return BrowserTestUtils.addTab(gBrowser, url, { skipAnimation: true });
}

function domOrder(tabs) {
  return [...tabs].sort((a, b) => {
    const pos = a.compareDocumentPosition(b);
    if (pos & Node.DOCUMENT_POSITION_FOLLOWING) {
      return -1;
    }
    if (pos & Node.DOCUMENT_POSITION_PRECEDING) {
      return 1;
    }
    return 0;
  });
}

async function cleanupTabs(...tabs) {
  for (const tab of tabs) {
    if (tab && tab.isConnected && !tab.closing) {
      BrowserTestUtils.removeTab(tab);
    }
  }
}
