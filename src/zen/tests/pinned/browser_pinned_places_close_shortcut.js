/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_Pinned_Places_Close_Shortcut_Behavior() {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.pinned-tab-manager.close-shortcut-behavior", "switch"]],
  });

  const otherTab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "https://example.com/"
  );
  const placesTab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "chrome://browser/content/places/places.xhtml"
  );

  try {
    gBrowser.pinTab(placesTab);
    gBrowser.selectedTab = placesTab;

    await SpecialPowers.spawn(placesTab.linkedBrowser, [], () => {
      content.document
        .getElementById("OrganizerCommand:CloseWindow")
        .doCommand();
    });

    await TestUtils.waitForCondition(
      () => gBrowser.selectedTab !== placesTab,
      "Pinned Places tab close command switched away from the tab"
    );

    ok(!placesTab.closing, "The pinned Places tab should remain open");
    is(
      gBrowser.selectedTab,
      otherTab,
      "The close shortcut behavior should switch to the next tab"
    );
  } finally {
    if (!placesTab.closing) {
      await BrowserTestUtils.removeTab(placesTab);
    }
    if (!otherTab.closing) {
      await BrowserTestUtils.removeTab(otherTab);
    }
  }
});
