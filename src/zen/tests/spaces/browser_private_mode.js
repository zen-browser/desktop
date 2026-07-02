/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_Private_Mode() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["privacy.userContext.enabled", true],
      ["zen.testing.enabled", false],
    ],
  });

  let privateWindow = await BrowserTestUtils.openNewBrowserWindow({
    private: true,
  });
  await privateWindow.gZenWorkspaces.promiseInitialized;

  Assert.ok(
    privateWindow.gBrowser.selectedTab.hasAttribute("zen-empty-tab"),
    "Private window should start with a zen empty tab"
  );

  await BrowserTestUtils.closeWindow(privateWindow);
  await SpecialPowers.popPrefEnv();
});
