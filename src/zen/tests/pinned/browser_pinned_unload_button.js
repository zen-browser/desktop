/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// The unload ("-") button on pinned tabs follows
// `zen.pinned-tab-manager.unload-button-behavior` instead of the close
// shortcut behavior. By default it unloads without resetting the tab to its
// pinned URL, matching the "Unload tab" context menu entry (gh-16670).

async function pinAndNavigateTab(url, navigateTo) {
  const tab = await BrowserTestUtils.openNewForegroundTab(gBrowser, url);
  gBrowser.pinTab(tab);
  await gBrowser.TabStateFlusher.flush(tab.linkedBrowser);
  /* eslint-disable-next-line mozilla/no-arbitrary-setTimeout */
  await new Promise(r => setTimeout(r, 500));

  BrowserTestUtils.startLoadingURIString(tab.linkedBrowser, navigateTo);
  await BrowserTestUtils.browserLoaded(tab.linkedBrowser, false, navigateTo);
  return tab;
}

function fakeClickEvent() {
  return {
    stopPropagation() {},
    preventDefault() {},
  };
}

add_task(async function test_UnloadButton_KeepsUrlByDefault() {
  await SpecialPowers.pushPrefEnv({
    set: [
      // Close shortcut behavior must not leak into the unload button.
      ["zen.pinned-tab-manager.close-shortcut-behavior", "reset-unload-switch"],
      ["zen.pinned-tab-manager.unload-button-behavior", "unload"],
    ],
  });

  const tab = await pinAndNavigateTab(
    "https://example.com/1",
    "https://example.com/2"
  );
  // Open another tab so the unload button also switches away.
  const otherTab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "https://example.com/other"
  );
  ok(
    tab.hasAttribute("zen-pinned-changed"),
    "The tab should be marked as changed before unloading"
  );

  await gZenPinnedTabManager.onCloseTabShortcut(fakeClickEvent(), tab, {
    fromUnloadButton: true,
  });

  ok(!tab.linkedPanel, "The tab should be unloaded after clicking unload");
  ok(
    tab.hasAttribute("zen-pinned-changed"),
    "The tab should keep its changed state when unloading without reset"
  );
  await BrowserTestUtils.waitForCondition(
    () => tab.linkedBrowser.currentURI.spec === "https://example.com/2",
    "The tab should keep its current URL after unloading"
  );
  Assert.notEqual(
    gBrowser.selectedTab,
    tab,
    "The tab should not be selected after unloading"
  );

  gBrowser.removeTab(otherTab);
  gBrowser.removeTab(tab);
  await SpecialPowers.popPrefEnv();
});

add_task(async function test_UnloadButton_ResetsUrlWhenConfigured() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.pinned-tab-manager.close-shortcut-behavior", "unload-switch"],
      ["zen.pinned-tab-manager.unload-button-behavior", "reset-unload"],
    ],
  });

  const tab = await pinAndNavigateTab(
    "https://example.com/1",
    "https://example.com/2"
  );
  const otherTab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "https://example.com/other"
  );

  await gZenPinnedTabManager.onCloseTabShortcut(fakeClickEvent(), tab, {
    fromUnloadButton: true,
  });

  ok(!tab.linkedPanel, "The tab should be unloaded after clicking unload");
  ok(
    !tab.hasAttribute("zen-pinned-changed"),
    "The tab should no longer be marked as changed after reset"
  );
  await BrowserTestUtils.waitForCondition(
    () => tab.linkedBrowser.currentURI.spec === "https://example.com/1",
    "The tab should be reset to its pinned URL after unloading"
  );
  Assert.notEqual(
    gBrowser.selectedTab,
    tab,
    "The tab should not be selected after unloading"
  );

  gBrowser.removeTab(otherTab);
  gBrowser.removeTab(tab);
  await SpecialPowers.popPrefEnv();
});
