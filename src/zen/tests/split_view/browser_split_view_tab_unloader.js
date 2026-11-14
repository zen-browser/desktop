/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// When memory runs low, the tab unloader must leave the tabs on screen alone,
// and in a split view that includes the panes next to the selected tab.

const { TabUnloader } = ChromeUtils.importESModule(
  "moz-src:///browser/components/tabbrowser/TabUnloader.sys.mjs"
);

add_task(async function test_Visible_Split_Panes_Are_Not_Unloaded() {
  const backgroundTab = await addTabTo(gBrowser, getUrlForNthTab(3));
  try {
    await basicSplitNTabs(async tabs => {
      // Passing no duration also considers recently used tabs.
      const sortedTabs = await TabUnloader.getSortedTabs(null);
      const isDiscardable = tab => {
        const entry = sortedTabs.find(sorted => sorted.tab === tab);
        Assert.ok(entry, "The unloader should consider the tab");
        return TabUnloader.isDiscardable(entry);
      };

      ok(
        isDiscardable(backgroundTab),
        "A tab that isn't on screen should be discardable"
      );
      for (const tab of tabs) {
        ok(!isDiscardable(tab), "A split pane on screen should be kept");
      }
    });
  } finally {
    BrowserTestUtils.removeTab(backgroundTab);
  }
});
