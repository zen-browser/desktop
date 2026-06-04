/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

async function addNormalTab(url = "about:blank") {
  const tab = BrowserTestUtils.addTab(gBrowser, url, { skipAnimation: true });
  await BrowserTestUtils.browserLoaded(gBrowser.getBrowserForTab(tab));
  return tab;
}

function domOrder(tabs) {
  // Returns the subset `tabs` sorted by their position in the tab strip.
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
