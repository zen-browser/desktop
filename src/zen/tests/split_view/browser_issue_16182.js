/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_Pinned_Split_Tabs_Show_Unload_Button() {
  await basicSplitNTabs(async tabs => {
    const pinEvent = BrowserTestUtils.waitForEvent(tabs[0], "TabPinned");
    gBrowser.pinTab(tabs[0]);
    await pinEvent;

    const container = tabs[0].group.querySelector(".tab-group-container");
    EventUtils.synthesizeMouseAtCenter(container, { type: "mousemove" });
    await TestUtils.waitForCondition(
      () => container.matches(":hover"),
      "The split group should be hovered"
    );

    for (const tab of tabs) {
      ok(
        tab.pinned && !tab.hasAttribute("pending"),
        "Tab is pinned and loaded"
      );
      const resetButton = tab.querySelector(".tab-reset-button");
      const closeButton = tab.querySelector(".tab-close-button");
      const resetStyle = window.getComputedStyle(resetButton);
      Assert.notEqual(
        resetStyle.display,
        "none",
        "The unload button should be rendered for a pinned split tab"
      );
      Assert.equal(
        resetStyle.visibility,
        "visible",
        "The unload button should be visible while hovering the split group"
      );
      Assert.equal(
        window.getComputedStyle(closeButton).display,
        "none",
        "The close button should stay hidden for a pinned split tab"
      );
    }
  });
});
