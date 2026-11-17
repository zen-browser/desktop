/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

async function pinTab(url) {
  const tab = await BrowserTestUtils.openNewForegroundTab(gBrowser, url);
  gBrowser.pinTab(tab);
  await gBrowser.TabStateFlusher.flush(tab.linkedBrowser);
  // eslint-disable-next-line mozilla/no-arbitrary-setTimeout
  await new Promise(r => setTimeout(r, 500));
  return tab;
}

async function navigate(tab, url) {
  BrowserTestUtils.startLoadingURIString(tab.linkedBrowser, url);
  await BrowserTestUtils.browserLoaded(tab.linkedBrowser, false, url);
}

function isReplaceItemDisabled(tab) {
  gZenPinnedTabManager.updatePinnedTabContextMenu(tab);
  return document.getElementById("context_zen-replace-pinned-url-with-current")
    .disabled;
}

add_task(async function test_ReplaceWithCurrent_DisabledOnPinnedUrl() {
  const tab = await pinTab("https://example.com/1");
  try {
    ok(
      isReplaceItemDisabled(tab),
      "Replace with Current URL is disabled while the tab is on its pinned URL"
    );

    await navigate(tab, "https://example.com/2");
    ok(
      !isReplaceItemDisabled(tab),
      "Replace with Current URL is enabled once the tab leaves its pinned URL"
    );

    await navigate(tab, "https://example.com/1#section");
    ok(
      isReplaceItemDisabled(tab),
      "A fragment on the pinned URL still counts as the pinned URL"
    );
  } finally {
    await BrowserTestUtils.removeTab(tab);
  }
});

add_task(async function test_ReplaceWithCurrent_EssentialOnPinnedUrl() {
  const tab = await pinTab("https://example.com/1");
  gZenPinnedTabManager.addToEssentials(tab);
  try {
    ok(
      isReplaceItemDisabled(tab),
      "Replace with Current URL is disabled for an Essential on its URL"
    );

    await navigate(tab, "https://example.com/2");
    ok(
      !isReplaceItemDisabled(tab),
      "Replace with Current URL is enabled for an Essential that navigated away"
    );
  } finally {
    await BrowserTestUtils.removeTab(tab);
  }
});
