/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const ORIG_STATE = SessionStore.getBrowserState();

registerCleanupFunction(async () => {
  await SessionStoreTestUtils.promiseBrowserState(ORIG_STATE);
});

// Restoring a split view sets this pref, which other tests expect to find
// unset.
registerCleanupFunction(() => {
  Services.prefs.clearUserPref("browser.tabs.splitview.hasUsed");
});

const GROUP_ID = "restored-group-id";
const UNKNOWN_GROUP_ID = "unknown-tab-group-id";
const SPLIT_VIEW_ID = 42;

function tabState(url, { groupId, splitViewId } = {}) {
  let tab = { entries: [{ url, triggeringPrincipal_base64 }] };
  if (groupId) {
    tab.groupId = groupId;
  }
  if (splitViewId) {
    tab.splitViewId = splitViewId;
  }
  return tab;
}

function stateWith(tabs, { groups = [], splitViews = [] } = {}) {
  return {
    windows: [{ tabs, selected: 1, groups, splitViews }],
    maxSplitViewId: SPLIT_VIEW_ID,
  };
}

const GROUP_STATE = {
  id: GROUP_ID,
  name: "group",
  color: "blue",
  collapsed: false,
};

/**
 * A tab whose groupId refers to a tab group that is not in the window's groups
 * list must still be restored, ungrouped.
 *
 * Such a tab used to be created without ever being inserted into the tab strip:
 * createTabsForSessionRestore only appends a tab to a DOM fragment when it can
 * resolve the tab's group, and that append is what inserts the tab. An
 * uninserted tab has no position, so SessionStore's #restoreTab threw
 * "Shouldn't be trying to restore a tab that has no position", which discarded
 * every remaining tab of the window.
 */
add_task(async function test_unknownGroupIdTabIsRestoredUngrouped() {
  await SessionStoreTestUtils.promiseBrowserState(
    stateWith([
      tabState("about:robots"),
      tabState("about:about", { groupId: UNKNOWN_GROUP_ID }),
      tabState("about:logo"),
    ])
  );

  Assert.equal(gBrowser.tabs.length, 3, "every tab should be restored");
  for (let tab of gBrowser.tabs) {
    Assert.notEqual(
      tab.index,
      undefined,
      "every restored tab should have a position"
    );
  }

  Assert.ok(
    !gBrowser.tabs[1].group,
    "the tab with an unknown group id should be restored ungrouped"
  );
  Assert.equal(gBrowser.tabGroups.length, 0, "no tab group should be created");
});

/**
 * A split view becomes a DOM node only once its last tab has been processed,
 * and that node is what gets appended to the tab strip. So which tab of the
 * pair carries the unknown group id decides where the whole split view lands,
 * and both orders have to keep every tab restorable.
 */
add_task(async function test_splitViewWithUnknownGroupIdOnLastTab() {
  await SessionStoreTestUtils.promiseBrowserState(
    stateWith(
      [
        tabState("about:robots", {
          groupId: GROUP_ID,
          splitViewId: SPLIT_VIEW_ID,
        }),
        tabState("about:about", {
          groupId: UNKNOWN_GROUP_ID,
          splitViewId: SPLIT_VIEW_ID,
        }),
      ],
      {
        groups: [{ ...GROUP_STATE }],
        splitViews: [{ id: SPLIT_VIEW_ID, numberOfTabs: 2 }],
      }
    )
  );

  Assert.equal(
    gBrowser.tabs.length,
    2,
    "both tabs of the split view should be restored"
  );
  Assert.ok(gBrowser.tabs[0].splitview, "the split view should be restored");
  Assert.equal(
    gBrowser.tabs[0].splitview,
    gBrowser.tabs[1].splitview,
    "both tabs should share one split view"
  );
  Assert.equal(
    gBrowser.tabs[0].splitview.tabs.length,
    2,
    "the split view should hold both tabs"
  );
  Assert.equal(
    gBrowser.tabs[0].group,
    null,
    "the split view should not be restored into the group"
  );
  Assert.equal(
    gBrowser.tabs[1].group,
    null,
    "the tab with the unknown group id should be ungrouped"
  );
});

add_task(async function test_splitViewWithUnknownGroupIdOnFirstTab() {
  await SessionStoreTestUtils.promiseBrowserState(
    stateWith(
      [
        tabState("about:robots", {
          groupId: UNKNOWN_GROUP_ID,
          splitViewId: SPLIT_VIEW_ID,
        }),
        tabState("about:about", {
          groupId: GROUP_ID,
          splitViewId: SPLIT_VIEW_ID,
        }),
      ],
      {
        groups: [{ ...GROUP_STATE }],
        splitViews: [{ id: SPLIT_VIEW_ID, numberOfTabs: 2 }],
      }
    )
  );

  Assert.equal(
    gBrowser.tabs.length,
    2,
    "both tabs of the split view should be restored"
  );
  Assert.equal(
    gBrowser.tabGroups.length,
    1,
    "the known tab group should be restored"
  );

  let group = gBrowser.tabGroups[0];
  // A split view is restored as a unit, so it follows the group of the tab that
  // resolved, even though the other tab's group id refers to nothing.
  Assert.equal(
    gBrowser.tabs[0].group,
    group,
    "the split view should be restored into the group"
  );
  Assert.equal(
    gBrowser.tabs[1].group,
    group,
    "both tabs should be in the group"
  );
  Assert.equal(
    group.tabs.length,
    2,
    "the group should hold the whole split view"
  );
});
