/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// The unload button only shows in the expanded sidebar, and the test window
// can start with it collapsed. Toggling the pref applies the layout again.
add_setup(async function () {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.view.sidebar-expanded", false]],
  });
  await SpecialPowers.popPrefEnv();
  await TestUtils.waitForCondition(
    () => document.documentElement.hasAttribute("zen-sidebar-expanded"),
    "The sidebar should be expanded"
  );
});

add_task(async function test_Pinned_Split_Group_Shows_One_Unload_Button() {
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

    const lastTab = tabs.at(-1);
    for (const tab of tabs) {
      ok(
        tab.pinned && !tab.hasAttribute("pending"),
        "Tab is pinned and loaded"
      );
      const resetStyle = window.getComputedStyle(
        tab.querySelector(".tab-reset-button")
      );
      if (tab == lastTab) {
        Assert.equal(
          resetStyle.display,
          "block",
          "The last tab should render the unload button for the split"
        );
        Assert.equal(
          resetStyle.visibility,
          "visible",
          "The unload button should be visible while hovering the split group"
        );
      } else {
        Assert.equal(
          resetStyle.display,
          "none",
          "Only the last tab should render the unload button"
        );
      }
      Assert.equal(
        window.getComputedStyle(tab.querySelector(".tab-close-button")).display,
        "none",
        "The close button should stay hidden for a pinned split tab"
      );
    }

    EventUtils.synthesizeMouseAtCenter(
      lastTab.querySelector(".tab-reset-button"),
      {}
    );
    await TestUtils.waitForCondition(
      () => tabs.every(tab => tab.hasAttribute("pending")),
      "Clicking the unload button should unload every tab in the split"
    );

    EventUtils.synthesizeMouseAtCenter(gBrowser.tabpanels, {
      type: "mousemove",
    });
  });
});
