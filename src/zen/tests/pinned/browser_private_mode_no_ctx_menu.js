/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_Private_Mode_No_Essentials() {
  let privateWindow = await BrowserTestUtils.openNewBrowserWindow({
    private: true,
  });
  await privateWindow.gZenWorkspaces.promiseInitialized;
  await BrowserTestUtils.openNewForegroundTab(privateWindow.gBrowser, "https://example.com/", true);

  await new Promise((resolve) => {
    privateWindow.gBrowser.selectedTab.addEventListener("popupshown", function () {
      ok(
        privateWindow.document.getElementById("context_zen-add-essentials").hidden,
        "Context menu should not show Zen Essentials option in private mode"
      );

      ok(
        privateWindow.document.getElementById("context_pinTab").hidden,
        "Context menu should not show Pin Tab option in private mode"
      );

      resolve();
    });

    EventUtils.synthesizeMouseAtCenter(privateWindow.gBrowser.selectedTab, {
      type: "contextmenu",
    });
  });

  await BrowserTestUtils.closeWindow(privateWindow);
});
