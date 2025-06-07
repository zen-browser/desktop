/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';

add_task(async function test_Private_Mode_Startup() {
  let privateWindow = await BrowserTestUtils.openNewBrowserWindow({
    private: true,
  });
  await privateWindow.gZenWorkspaces.promiseInitialized;
  await new Promise((resolve) => {
    setTimeout(() => {
      Assert.equal(
        privateWindow.gBrowser.tabs.length,
        1,
        'Private window should start with one tab'
      );
      resolve();
    }, 1000);
  });
  await BrowserTestUtils.closeWindow(privateWindow);
});
