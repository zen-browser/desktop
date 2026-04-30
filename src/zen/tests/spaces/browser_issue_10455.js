/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_Issue_10455() {
  debugger;
  await SpecialPowers.pushPrefEnv({
    set: [["browser.tabs.closeWindowWithLastTab", true]],
  });
  debugger;

  let newWindow = await BrowserTestUtils.openNewBrowserWindow();
  await newWindow.gZenWorkspaces.promiseInitialized;

  const unloadEvent = BrowserTestUtils.waitForEvent(newWindow, "unload");
  newWindow.BrowserCommands.closeTabOrWindow();
  await unloadEvent;

  ok(newWindow.closed, "Window should be closing");
  await SpecialPowers.popPrefEnv();
});

add_task(async function test_Issue_10455_Dont_Close() {
  debugger;
  await SpecialPowers.pushPrefEnv({
    set: [["browser.tabs.closeWindowWithLastTab", false]],
  });

  let newWindow = await BrowserTestUtils.openNewBrowserWindow();
  await newWindow.gZenWorkspaces.promiseInitialized;

  newWindow.BrowserCommands.closeTabOrWindow();
  Assert.strictEqual(
    newWindow.gBrowser.tabs.length,
    1,
    "Window should still have one tab"
  );
  ok(
    newWindow.gBrowser.selectedTab.hasAttribute("zen-empty-tab"),
    "Tab should be a zen empty tab"
  );
  ok(!newWindow.closing, "Window should be closing");

  await BrowserTestUtils.closeWindow(newWindow);
  await SpecialPowers.popPrefEnv();
});
