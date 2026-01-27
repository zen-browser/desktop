/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_Create_Pinned() {
  let resolvePromise;
  const promise = new Promise((resolve) => {
    resolvePromise = resolve;
  });

  await BrowserTestUtils.openNewForegroundTab(window.gBrowser, "https://example.com/", true);

  const newTab = gBrowser.selectedTab;
  gBrowser.pinTab(newTab);
  await gBrowser.TabStateFlusher.flush(newTab.linkedBrowser);

  ok(newTab.pinned, "The tab should be pinned after calling gBrowser.pinTab()");

  await new Promise((r) => setTimeout(r, 500));
  const pinObject = newTab._zenPinnedInitialState;
  ok(pinObject, "The pin object should be created in the tab's _zenPinnedInitialState");
  Assert.equal(
    pinObject.entry.url,
    "https://example.com/",
    "The pin object should have the correct URL"
  );

  resolvePromise();

  await promise;
  await BrowserTestUtils.removeTab(newTab);
});
