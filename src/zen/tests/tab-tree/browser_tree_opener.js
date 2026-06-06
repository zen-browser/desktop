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

  Assert.equal(
    gZenTabTree.getParent(child),
    opener,
    "tab opened from opener auto-nests as its child"
  );

  await cleanupTabs(opener, child);
  await SpecialPowers.popPrefEnv();
});

// Firefox clears `owner` on each successive related tab opened from one opener,
// so only the first would keep it. The durable _zenOpenerTab capture lets the
// later ones still auto-nest.
add_task(async function test_opener_autonest_uses_durable_opener() {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.tab-tree.auto-nest-by-opener", true]],
  });
  const opener = await addNormalTab();
  const child = await addNormalTab();
  // Mimic the post-clear state: owner is gone, but our durable capture remains.
  child.owner = null;
  child._zenOpenerTab = opener;
  child.dispatchEvent(new CustomEvent("TabOpen", { bubbles: true, detail: child }));

  Assert.equal(
    gZenTabTree.getParent(child),
    opener,
    "auto-nest falls back to the durable opener after Firefox cleared owner"
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

  Assert.equal(gZenTabTree.getParent(child), null, "no auto-nest when pref off");

  await cleanupTabs(opener, child);
  await SpecialPowers.popPrefEnv();
});
