/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { ZenTabUnloader } = ChromeUtils.importESModule(
  "resource:///modules/zen/ZenTabUnloader.sys.mjs"
);

const TIMEOUT_PREF = "zen.tabs.unload-inactive-after-minutes";

// Pretends the tab was last used well before a one minute timeout. This sets
// the raw value so that it also works on the selected tab, whose lastAccessed
// would otherwise always be "now".
function makeInactive(tab) {
  tab._lastAccessed = Date.now() - 5 * 60 * 1000;
}

add_task(async function test_disabled_by_default() {
  is(Services.prefs.getIntPref(TIMEOUT_PREF), 0, "The unloader is opt-in");

  const tab = await addTab();
  makeInactive(tab);

  await ZenTabUnloader.unloadInactiveTabs();
  ok(tab.linkedPanel, "Nothing is unloaded while the pref is 0");

  await BrowserTestUtils.removeTab(tab);
});

add_task(async function test_unload_inactive_tabs() {
  await SpecialPowers.pushPrefEnv({ set: [[TIMEOUT_PREF, 1]] });

  const selectedTab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "https://example.com/"
  );
  const inactiveTab = await addTab();
  const inactivePinnedTab = await addTab();
  gBrowser.pinTab(inactivePinnedTab);
  const recentTab = await addTab();

  makeInactive(selectedTab);
  makeInactive(inactiveTab);
  makeInactive(inactivePinnedTab);

  await ZenTabUnloader.unloadInactiveTabs();

  ok(!inactiveTab.linkedPanel, "An inactive background tab is unloaded");
  ok(!inactivePinnedTab.linkedPanel, "An inactive pinned tab is unloaded");
  ok(recentTab.linkedPanel, "A recently used tab stays loaded");
  ok(selectedTab.linkedPanel, "The selected tab stays loaded");
  is(gBrowser.selectedTab, selectedTab, "The selected tab does not change");

  for (const tab of [inactiveTab, inactivePinnedTab, recentTab, selectedTab]) {
    await BrowserTestUtils.removeTab(tab);
  }
  await SpecialPowers.popPrefEnv();
});
