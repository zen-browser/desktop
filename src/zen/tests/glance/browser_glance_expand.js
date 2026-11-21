/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_Glance_Basic_Open() {
  const selectedTab = gBrowser.selectedTab;
  await openGlanceOnTab(async glanceTab => {
    await gZenGlanceManager.fullyOpenGlance();
    ok(
      !glanceTab.hasAttribute("zen-glance-tab"),
      "The glance tab should not have the zen-glance-tab attribute"
    );
    Assert.strictEqual(
      gBrowser.tabs.filter(tab => tab.hasAttribute("zen-glance-tab")).length,
      0,
      "There should be no zen-glance-tab attribute on any tab"
    );
    Assert.greater(
      glanceTab.index,
      selectedTab.index,
      "The glance tab should be on the right of the selected tab"
    );
    BrowserTestUtils.removeTab(glanceTab);
  }, false);
});

add_task(async function test_Glance_Open_Sibling() {
  const tabsToRemove = [];
  for (let i = 0; i < 5; i++) {
    await BrowserTestUtils.openNewForegroundTab(
      window.gBrowser,
      "https://example.com/",
      true
    );
    tabsToRemove.push(gBrowser.selectedTab);
  }

  gBrowser.selectedTab = gBrowser.tabs[2];
  const selectedTab = gBrowser.selectedTab;

  await openGlanceOnTab(async glanceTab => {
    await gZenGlanceManager.fullyOpenGlance();
    Assert.equal(
      glanceTab._index,
      selectedTab._index + 1,
      "The glance tab should be on the right of the selected tab"
    );
    BrowserTestUtils.removeTab(glanceTab);
  }, false);

  for (const tab of tabsToRemove) {
    await BrowserTestUtils.removeTab(tab);
  }
});

add_task(async function test_Glance_Basic_Open() {
  const tabsToRemove = [];
  for (let i = 0; i < 3; i++) {
    await BrowserTestUtils.openNewForegroundTab(
      window.gBrowser,
      "https://example.com/",
      true
    );
    gBrowser.pinTab(gBrowser.selectedTab);
    tabsToRemove.push(gBrowser.selectedTab);
  }

  gBrowser.selectedTab = gBrowser.tabs.find(tab => tab.pinned);

  await openGlanceOnTab(async glanceTab => {
    await gZenGlanceManager.fullyOpenGlance();
    Assert.equal(
      glanceTab,
      gBrowser.visibleTabs.find(tab => !tab.pinned),
      "The glance tab should be the first normal tab (Ignoring empty tabs)"
    );
    ok(
      glanceTab.closest(".zen-workspace-normal-tabs-section"),
      "Expanded glance from a pinned parent should land in the normal section"
    );
    BrowserTestUtils.removeTab(glanceTab);
  }, false);

  for (const tab of tabsToRemove) {
    await BrowserTestUtils.removeTab(tab);
  }
});

// Regression test for gh-15937: expanding a glance from a pinned tab must
// place it in the normal section, and a following new tab must not stack in
// the saved/pinned area.
add_task(async function test_Glance_Expand_From_Pinned_Then_New_Tab() {
  const tabsToRemove = [];
  await BrowserTestUtils.openNewForegroundTab(
    window.gBrowser,
    "https://example.com/",
    true
  );
  gBrowser.pinTab(gBrowser.selectedTab);
  tabsToRemove.push(gBrowser.selectedTab);

  gBrowser.selectedTab = gBrowser.tabs.find(tab => tab.pinned);

  await openGlanceOnTab(async glanceTab => {
    await gZenGlanceManager.fullyOpenGlance();
    ok(!glanceTab.pinned, "Expanded glance tab should not be pinned");
    ok(
      !glanceTab.closest(".zen-workspace-pinned-tabs-section"),
      "Expanded glance tab should not remain in the pinned section DOM"
    );
    ok(
      glanceTab.closest(".zen-workspace-normal-tabs-section"),
      "Expanded glance tab should be in the normal tabs section"
    );

    gBrowser.selectedTab = tabsToRemove[0];
    const newTab = await BrowserTestUtils.openNewForegroundTab(
      window.gBrowser,
      "https://example.com/new",
      true
    );
    tabsToRemove.push(newTab);

    ok(!newTab.pinned, "New tab opened from a pinned tab should not be pinned");
    ok(
      !newTab.closest(".zen-workspace-pinned-tabs-section"),
      "New tab should not appear in the pinned/saved tabs section"
    );
    ok(
      newTab.closest(".zen-workspace-normal-tabs-section"),
      "New tab should be in the normal tabs section"
    );

    BrowserTestUtils.removeTab(glanceTab);
  }, false);

  for (const tab of tabsToRemove) {
    if (!tab.closing) {
      await BrowserTestUtils.removeTab(tab);
    }
  }
});

add_task(async function test_Glance_New_From_essential() {
  ok(true, "todo:");
  return; // TODO: Fix this test, it currently fails
  /* eslint-disable no-unreachable, no-unused-vars */
  await BrowserTestUtils.withNewTab(
    { gBrowser, url: "https://example.com/" },
    async browser => {
      const selectedTab = gBrowser.selectedTab;
      gZenPinnedTabManager.addToEssentials(selectedTab);
      await openGlanceOnTab(async glanceTab => {
        await gZenGlanceManager.fullyOpenGlance();
        ok(!glanceTab.pinned, "The glance tab should not be pinned");
        ok(
          !glanceTab.parentNode.hasAttribute("container"),
          "The glance tab should not be in an essentials container"
        );
        await BrowserTestUtils.removeTab(gBrowser.selectedTab);
        await BrowserTestUtils.removeTab(glanceTab);
      }, false);
    }
  );
});
