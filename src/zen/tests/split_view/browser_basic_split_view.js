/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_Basic_Split_View() {
  await basicSplitNTabs(() => {
    ok(
      gBrowser.tabpanels.hasAttribute("zen-split-view"),
      "The split view should not have crashed with two tabs in it"
    );
  });
  ok(
    !gBrowser.tabpanels.hasAttribute("zen-split-view"),
    "Unsplit view should not have crashed with two tabs in it"
  );
});

add_task(async function test_Browser_Elements_Attributes() {
  await basicSplitNTabs(() => {
    Assert.equal(
      document.querySelectorAll('.browserSidebarContainer[zen-split="true"]')
        .length,
      2,
      "There should be two split browser sidebars"
    );
  });
  ok(
    !document.querySelector('.browserSidebarContainer[zen-split="true"]'),
    "There should be no split browser sidebars in unsplit view"
  );
});

add_task(async function test_Reapply_Max_Size_Split_View() {
  await basicSplitNTabs(tabs => {
    const group = gZenViewSplitter.splitTabs(tabs, undefined, -1, {
      activate: false,
    });

    Assert.ok(group, "Reapplying an existing four-tab split should succeed");
    Assert.equal(
      group.tabs.length,
      gZenViewSplitter.MAX_TABS,
      "Reapplying the split should keep the same number of tabs"
    );
  }, "grid", 4);
});

add_task(async function test_Reject_Split_Exceeding_Max_Size() {
  await basicSplitNTabs(async tabs => {
    const extraTabs = await Promise.all([
      addTabTo(gBrowser, getUrlForNthTab(4)),
      addTabTo(gBrowser, getUrlForNthTab(5)),
    ]);

    try {
      const group = gZenViewSplitter._data.find(split =>
        split.tabs.includes(tabs[0])
      );
      const result = gZenViewSplitter.splitTabs(
        [tabs[0], ...extraTabs],
        undefined,
        -1,
        { activate: false }
      );

      Assert.equal(result, undefined, "A five-tab split should be rejected");
      Assert.equal(
        group.tabs.length,
        3,
        "Rejected tabs should not be added to the existing split"
      );
    } finally {
      for (const tab of extraTabs) {
        await BrowserTestUtils.removeTab(tab);
      }
    }
  }, "grid", 3);
});

