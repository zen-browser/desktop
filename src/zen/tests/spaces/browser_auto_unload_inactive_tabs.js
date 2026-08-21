/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const INACTIVE_DURATION_MS = 15 * 60 * 1000;

add_setup(async function setup() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.tabs.auto-unload.enabled", true],
      ["zen.tabs.auto-unload.after-minutes", 15]
    ]
  });
});

add_task(async function test_respects_disabled_preference() {
  Services.prefs.setBoolPref("zen.tabs.auto-unload.enabled", false);
  const inactiveTab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "https://example.com/?disabled"
  );
  const activeTab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "https://example.org/?disabled-active"
  );
  inactiveTab._lastAccessed = Date.now() - INACTIVE_DURATION_MS - 1000;

  const unloadedCount = await gZenWorkspaces.unloadInactiveTabs();

  is(unloadedCount, 0, "Disabled auto unload should not unload tabs");
  ok(inactiveTab.linkedPanel, "Inactive tab should remain loaded");

  Services.prefs.setBoolPref("zen.tabs.auto-unload.enabled", true);
  await BrowserTestUtils.removeTab(inactiveTab);
  await BrowserTestUtils.removeTab(activeTab);
});

add_task(async function test_unloads_inactive_regular_tab() {
  const inactiveTab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "https://example.com/"
  );
  const activeTab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "https://example.org/"
  );
  inactiveTab._lastAccessed = Date.now() - INACTIVE_DURATION_MS - 1000;

  const unloadedCount = await gZenWorkspaces.unloadInactiveTabs();

  is(unloadedCount, 1, "One inactive tab should be unloaded");
  ok(inactiveTab.hasAttribute("pending"), "Inactive tab should be pending");
  ok(!inactiveTab.linkedPanel, "Inactive tab should release its browser");
  ok(!activeTab.hasAttribute("pending"), "Active tab should remain loaded");

  await BrowserTestUtils.removeTab(inactiveTab);
  await BrowserTestUtils.removeTab(activeTab);
});

add_task(async function test_protects_recent_and_special_tabs() {
  const recentTab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "https://example.com/?recent"
  );
  const pinnedTab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "https://example.com/?pinned"
  );
  gBrowser.pinTab(pinnedTab);
  const essentialTab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "https://example.com/?essential"
  );
  essentialTab.setAttribute("zen-essential", "true");
  const mediaTab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "https://example.com/?media"
  );
  mediaTab.setAttribute("soundplaying", "true");
  const internalTab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "about:preferences"
  );
  const activeTab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "https://example.org/?active"
  );

  for (const tab of [pinnedTab, essentialTab, mediaTab, internalTab]) {
    tab._lastAccessed = Date.now() - INACTIVE_DURATION_MS - 1000;
  }
  recentTab._lastAccessed = Date.now();

  const unloadedCount = await gZenWorkspaces.unloadInactiveTabs();

  is(unloadedCount, 0, "Protected and recent tabs should not be unloaded");
  for (const tab of [
    recentTab,
    pinnedTab,
    essentialTab,
    mediaTab,
    internalTab,
    activeTab
  ]) {
    ok(tab.linkedPanel, `${tab.label} should remain loaded`);
  }

  mediaTab.removeAttribute("soundplaying");
  essentialTab.removeAttribute("zen-essential");
  for (const tab of [
    recentTab,
    pinnedTab,
    essentialTab,
    mediaTab,
    internalTab,
    activeTab
  ]) {
    await BrowserTestUtils.removeTab(tab);
  }
});
