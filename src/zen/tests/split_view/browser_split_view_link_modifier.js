/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const LINK_URL = "https://example.org/";

async function addTabWithLink() {
  const tab = await addTabTo(gBrowser, "https://example.com/");
  gBrowser.selectedTab = tab;
  await SpecialPowers.spawn(tab.linkedBrowser, [LINK_URL], url => {
    const link = content.document.createElement("a");
    link.id = "link";
    link.href = url;
    link.textContent = "link";
    content.document.body.append(link);
  });
  return tab;
}

async function modifierClickOpensSplit(modifiers) {
  const tab = await addTabWithLink();
  const activated = BrowserTestUtils.waitForEvent(
    window,
    "ZenViewSplitter:SplitViewActivated"
  );
  const opened = BrowserTestUtils.waitForNewTab(gBrowser, LINK_URL, true);
  await BrowserTestUtils.synthesizeMouseAtCenter(
    "#link",
    modifiers,
    tab.linkedBrowser
  );
  const newTab = await opened;
  await activated;

  ok(tab.splitView, "The source tab is in a split");
  ok(newTab.splitView, "The new tab is in the same split");
  is(tab.group, newTab.group, "Both tabs share one split group");
  ok(!newTab.hasAttribute("zen-glance-tab"), "The link did not open in Glance");
  is(gBrowser.selectedTab, newTab, "The new tab is focused");

  gZenViewSplitter.unsplitCurrentView();
  BrowserTestUtils.removeTab(newTab);
  BrowserTestUtils.removeTab(tab);
}

add_task(async function test_Split_Link_Modifier_Opens_Split() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.glance.enabled", true],
      ["zen.glance.activation-method", "ctrl"],
      ["zen.splitView.link-activation-method", "alt"],
    ],
  });
  await modifierClickOpensSplit({ altKey: true });
  await SpecialPowers.popPrefEnv();
});

add_task(async function test_Split_Link_Modifier_Wins_Over_Glance() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.glance.enabled", true],
      ["zen.glance.activation-method", "alt"],
      ["zen.splitView.link-activation-method", "alt"],
    ],
  });
  await modifierClickOpensSplit({ altKey: true });
  await SpecialPowers.popPrefEnv();
});

add_task(async function test_Split_Link_Modifier_Off_Keeps_Glance() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.glance.enabled", true],
      ["zen.glance.activation-method", "alt"],
      ["zen.splitView.link-activation-method", "none"],
    ],
  });
  const tab = await addTabWithLink();
  const opened = BrowserTestUtils.waitForNewTab(gBrowser, LINK_URL, true);
  await BrowserTestUtils.synthesizeMouseAtCenter(
    "#link",
    { altKey: true },
    tab.linkedBrowser
  );
  const glanceTab = await opened;
  ok(
    glanceTab.hasAttribute("zen-glance-tab"),
    "With the pref off, the same click still opens Glance"
  );
  ok(!tab.splitView, "No split was created");

  await gZenGlanceManager.closeGlance({ onTabClose: true });
  BrowserTestUtils.removeTab(tab);
  await SpecialPowers.popPrefEnv();
});

add_task(async function test_Split_Link_Modifier_Joins_Existing_Split() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.glance.enabled", true],
      ["zen.glance.activation-method", "ctrl"],
      ["zen.splitView.link-activation-method", "alt"],
    ],
  });
  const tab = await addTabWithLink();
  const other = await addTabTo(gBrowser, "https://example.com/");
  await createSplitView([tab, other]);
  gBrowser.selectedTab = tab;
  const group = tab.group;

  const opened = BrowserTestUtils.waitForNewTab(gBrowser, LINK_URL, true);
  await BrowserTestUtils.synthesizeMouseAtCenter(
    "#link",
    { altKey: true },
    tab.linkedBrowser
  );
  const newTab = await opened;
  await TestUtils.waitForCondition(
    () => newTab.group === group,
    "The new tab joins the existing split"
  );
  is(group.tabs.length, 3, "The split now has three tabs");

  gZenViewSplitter.unsplitCurrentView();
  BrowserTestUtils.removeTab(newTab);
  BrowserTestUtils.removeTab(other);
  BrowserTestUtils.removeTab(tab);
  await SpecialPowers.popPrefEnv();
});
