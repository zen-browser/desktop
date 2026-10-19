/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

let initialWorkspace;

function splitDoc(pinned) {
  return {
    shared: {
      type: "splitView",
      tabs: [
        {
          type: "tab",
          url: "https://example.com/one",
          label: "One",
          ...(pinned && { isPinned: true }),
        },
        {
          type: "tab",
          url: "https://example.com/two",
          label: "Two",
          ...(pinned && { isPinned: true }),
        },
      ],
    },
  };
}

function waitForSplitGroups(count) {
  return TestUtils.waitForCondition(
    () =>
      document.querySelectorAll("tab-group[split-view-group]").length >= count,
    `${count} split group(s) should exist`
  );
}

add_setup(async function () {
  initialWorkspace = gZenWorkspaces.activeWorkspace;
  registerCleanupFunction(() => cleanupSpaces(initialWorkspace));
});

add_task(async function test_pinned_split_link_opens_directly() {
  const restore = stubSharePreview(splitDoc(true));
  const shareTab = gBrowser.addTrustedTab(`${SHARE_BASE}/split/${SHARE_ID}`, {
    inBackground: false,
  });
  gBrowser.selectedTab = shareTab;

  await waitForSplitGroups(1);
  await TestUtils.waitForCondition(
    () => !gBrowser.tabs.includes(shareTab),
    "the share tab closes once the split opens"
  );

  const group = document.querySelector("tab-group[split-view-group]");
  Assert.ok(gZenViewSplitter.splitViewActive, "the split view is active");
  Assert.ok(
    group.tabs.every(t => t.pinned),
    "an all-pinned shared split opens pinned"
  );
  Assert.ok(
    group.closest(".zen-workspace-pinned-tabs-section"),
    "and lives in the pinned section"
  );

  restore();
  await cleanupSpaces(initialWorkspace);
});

add_task(async function test_unpinned_split_link_stays_normal() {
  const restore = stubSharePreview(splitDoc(false));
  const shareTab = gBrowser.addTrustedTab(`${SHARE_BASE}/split/${SHARE_ID}`, {
    inBackground: false,
  });
  gBrowser.selectedTab = shareTab;

  await waitForSplitGroups(1);
  const group = document.querySelector("tab-group[split-view-group]");
  Assert.ok(
    group.tabs.every(t => !t.pinned),
    "an unpinned shared split opens unpinned"
  );
  Assert.ok(
    group.closest(".zen-workspace-normal-tabs-section"),
    "and lives in the normal section"
  );

  restore();
  await cleanupSpaces(initialWorkspace);
});

add_task(async function test_failed_split_link_restores_tab() {
  const restore = stubMethod(ZenShareClient, "fetchSharePreview", async () => {
    throw new ZenShareError("not-found", "share not found");
  });
  const restoreToast = stubMethod(gZenUIManager, "showToast", () => {});
  const shareTab = gBrowser.addTrustedTab(`${SHARE_BASE}/split/${SHARE_ID}`, {
    inBackground: false,
  });
  gBrowser.selectedTab = shareTab;

  await TestUtils.waitForCondition(
    () => gBrowser.selectedTab === shareTab && !shareTab.hidden,
    "the share tab is shown again when the split fails to load"
  );
  Assert.ok(gBrowser.tabs.includes(shareTab), "the tab is not closed");

  restoreToast();
  restore();
  BrowserTestUtils.removeTab(shareTab);
});
