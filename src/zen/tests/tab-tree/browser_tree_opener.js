/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_opener_autonest_on() {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.tab-tree.auto-nest-by-opener", true]],
  });
  const opener = await addNormalTab();
  gBrowser.selectedTab = opener;

  const child = gBrowser.addTab("about:blank", {
    ownerTab: opener,
    triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
  });
  await BrowserTestUtils.browserLoaded(gBrowser.getBrowserForTab(child));

  Assert.equal(
    gZenTabTree.getParent(child),
    opener,
    "tab opened from opener auto-nests as its child"
  );

  await cleanupTabs(opener, child);
  await SpecialPowers.popPrefEnv();
});

add_task(async function test_opener_autonest_off() {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.tab-tree.auto-nest-by-opener", false]],
  });
  const opener = await addNormalTab();
  const child = gBrowser.addTab("about:blank", {
    ownerTab: opener,
    triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
  });
  await BrowserTestUtils.browserLoaded(gBrowser.getBrowserForTab(child));

  Assert.equal(gZenTabTree.getParent(child), null, "no auto-nest when pref off");

  await cleanupTabs(opener, child);
  await SpecialPowers.popPrefEnv();
});
