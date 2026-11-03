/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// Regression test for gh-14049: closing a Glance ("preview") opened from a
// pinned tab in a pinned-only window used to drop the user on a blank new tab
// instead of restoring the pinned parent. The glance child is the last unpinned
// tab, so removing it tripped `handleTabBeforeClose`'s "last unpinned tab
// closed" handling, which switched to an empty tab and clobbered the
// restore-to-parent.

add_setup(async function () {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.workspaces.open-new-tab-if-last-unpinned-tab-is-closed", true]],
  });
  registerCleanupFunction(async () => {
    await SpecialPowers.popPrefEnv();
  });
});

add_task(async function test_Glance_Close_Pinned_Parent() {
  if (!gZenWorkspaces.workspaceEnabled) {
    ok(true, "Workspaces disabled; the regression cannot occur. Skipping.");
    return;
  }

  // Recreate the "only pinned tabs open" state by pinning every existing tab.
  // The glance child opened below is then guaranteed to be the sole unpinned
  // tab, which is the precondition the regression depends on.
  const pinnedByTest = gBrowser.visibleTabs.filter(t => !t.pinned);
  for (const tab of pinnedByTest) {
    gBrowser.pinTab(tab);
  }
  registerCleanupFunction(() => {
    for (const tab of pinnedByTest) {
      if (tab.pinned && !tab.closing) {
        gBrowser.unpinTab(tab);
      }
    }
  });

  const parentTab = gBrowser.selectedTab;
  ok(parentTab.pinned, "Parent tab should be pinned");

  // selectEmptyTab() is a no-op while Zen's testing mode is enabled, so the
  // regression cannot be observed through the resulting selection alone. Spy on
  // it instead: the bug is "selectEmptyTab gets called when a glance is closed".
  let selectEmptyTabCalled = false;
  const originalSelectEmptyTab = gZenWorkspaces.selectEmptyTab;
  gZenWorkspaces.selectEmptyTab = function (...args) {
    selectEmptyTabCalled = true;
    return originalSelectEmptyTab.apply(this, args);
  };
  registerCleanupFunction(() => {
    gZenWorkspaces.selectEmptyTab = originalSelectEmptyTab;
  });

  await openGlanceOnTab(async glanceTab => {
    ok(
      glanceTab.hasAttribute("glance-id"),
      "The glance tab should have a glance-id"
    );
    ok(!glanceTab.pinned, "The glance child should be unpinned");

    // `handleTabBeforeClose` bails early without a workspace id, so make sure
    // the glance child carries one (as it does at teardown time).
    if (!glanceTab.getAttribute("zen-workspace-id")) {
      glanceTab.setAttribute(
        "zen-workspace-id",
        gZenWorkspaces.activeWorkspace
      );
    }

    Assert.deepEqual(
      gBrowser.visibleTabs.filter(t => !t.pinned),
      [glanceTab],
      "The glance child should be the only unpinned visible tab"
    );

    // Close the glance through the real tab-removal flow, which is what runs
    // handleTabBeforeClose and the glance teardown.
    await BrowserTestUtils.removeTab(glanceTab);
  }, false);

  ok(
    !selectEmptyTabCalled,
    "Closing a glance tab must not switch to an empty tab"
  );

  await TestUtils.waitForCondition(
    () => gBrowser.selectedTab === parentTab && parentTab.selected,
    "The pinned parent tab should be selected after closing the glance"
  );
  Assert.equal(
    gBrowser.selectedTab,
    parentTab,
    "The pinned parent tab should be selected after closing the glance"
  );
  ok(parentTab.selected, "The pinned parent tab should be visually selected");
});
