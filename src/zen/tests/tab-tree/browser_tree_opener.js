/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_opener_autonest_content_link() {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.tab-tree.auto-nest-by-opener", true]],
  });
  const opener = await addNormalTab();
  gBrowser.selectedTab = opener;

  // A link opened in a new tab from the current tab is "related to current"
  // (it carries an in-content opener), so addTab records `_zenOpenerTab` = the
  // current tab and the new tab nests under it.
  const child = gBrowser.addTab("about:blank", {
    relatedToCurrent: true,
    triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
  });

  Assert.equal(
    gZenTabTree.getParent(child),
    opener,
    "a link opened in a new tab from the current tab auto-nests as its child"
  );

  await cleanupTabs(opener, child);
  await SpecialPowers.popPrefEnv();
});

// Regression: a tab opened from a bookmark, the address bar, or another app has
// no in-content opener (no referrer / openerBrowser). When opened in the
// foreground Firefox still sets `tab.owner` to the current tab — but that must
// NOT make it a child; it has to open at root.
add_task(async function test_no_autonest_without_content_opener() {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.tab-tree.auto-nest-by-opener", true]],
  });
  const opener = await addNormalTab();
  const tab = await addNormalTab();
  // Mimic a foreground bookmark/address-bar/external open: owner points at the
  // current tab, but there is no in-content opener.
  tab.owner = opener;
  tab._zenOpenerTab = null;
  tab.dispatchEvent(
    new CustomEvent("TabOpen", { bubbles: true, detail: tab })
  );

  Assert.equal(
    gZenTabTree.getParent(tab),
    null,
    "a bookmark/address-bar/external open is a root tab, never nested under the current tab"
  );

  await cleanupTabs(opener, tab);
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
    "auto-nest uses the durable in-content opener after Firefox cleared owner"
  );

  await cleanupTabs(opener, child);
  await SpecialPowers.popPrefEnv();
});

add_task(async function test_opener_autonest_off() {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.tab-tree.auto-nest-by-opener", false]],
  });
  const opener = await addNormalTab();
  gBrowser.selectedTab = opener;
  const child = gBrowser.addTab("about:blank", {
    relatedToCurrent: true,
    triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
  });

  Assert.equal(gZenTabTree.getParent(child), null, "no auto-nest when pref off");

  await cleanupTabs(opener, child);
  await SpecialPowers.popPrefEnv();
});
