/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_Private_Mode() {
  await SpecialPowers.pushPrefEnv({
    set: [["privacy.userContext.enabled", true]],
  });

  let privateWindow = await BrowserTestUtils.openNewBrowserWindow({
    private: true,
  });
  await privateWindow.gZenWorkspaces.promiseInitialized;
  ok(
    privateWindow.document.documentElement.hasAttribute("zen-workspace-id"),
    "Private window should have a zen-workspace-id attribute"
  );

  await BrowserTestUtils.closeWindow(privateWindow);
  await SpecialPowers.popPrefEnv();
});
