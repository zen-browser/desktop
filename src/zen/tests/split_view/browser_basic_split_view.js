/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

ChromeUtils.defineESModuleGetters(this, {
  sinon: "resource://testing-common/Sinon.sys.mjs",
});

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
    const showToast = sinon.stub(gZenUIManager, "showToast");
    try {
      const group = gZenViewSplitter.splitTabs(tabs, undefined, -1, {
        activate: false,
      });

      Assert.ok(group, "Reapplying an existing four-tab split should succeed");
      Assert.equal(
        group.tabs.length,
        gZenViewSplitter.MAX_TABS,
        "Reapplying the split should keep the same number of tabs"
      );
      sinon.assert.notCalled(showToast);
    } finally {
      showToast.restore();
    }
  }, "grid", 4);
});

add_task(async function test_Reject_Tab_Added_To_Max_Size_Split_View() {
  await basicSplitNTabs(async tabs => {
    const extraTab = await addTabTo(gBrowser, getUrlForNthTab(5));
    const showToast = sinon.stub(gZenUIManager, "showToast");

    try {
      const group = gZenViewSplitter._data.find(split =>
        split.tabs.includes(tabs[0])
      );
      const result = gZenViewSplitter.splitTabs(
        [tabs[0], extraTab],
        undefined,
        -1,
        { activate: false }
      );

      Assert.equal(result, undefined, "A fifth tab should be rejected");
      Assert.equal(
        group.tabs.length,
        gZenViewSplitter.MAX_TABS,
        "The split should remain at the maximum number of tabs"
      );
      sinon.assert.calledOnceWithExactly(
        showToast,
        "zen-split-view-limit-toast"
      );
    } finally {
      showToast.restore();
      await BrowserTestUtils.removeTab(extraTab);
    }
  }, "grid", 4);
});

