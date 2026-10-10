/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const ORIG_STATE = SessionStore.getBrowserState();

registerCleanupFunction(async () => {
  await SessionStoreTestUtils.promiseBrowserState(ORIG_STATE);
});

add_task(async function test_closedTabGroupsInClosedWindows() {
  forgetClosedWindows();

  await SpecialPowers.pushPrefEnv({
    set: [["browser.sessionstore.closedTabsFromClosedWindows", true]],
  });

  let win = await promiseNewWindowLoaded();

  // Window needs at least one worth-saving tab opened in order to be saved
  BrowserTestUtils.addTab(win.gBrowser, "about:robots");

  let groupedTab1 = BrowserTestUtils.addTab(win.gBrowser, "about:robots");
  let groupedTab2 = BrowserTestUtils.addTab(win.gBrowser, "about:robots");

  let tabGroup = win.gBrowser.addTabGroup([groupedTab1, groupedTab2]);

  await TabStateFlusher.flushWindow(win);

  Assert.equal(
    SessionStore.getClosedTabGroups(win).length,
    0,
    "should start with no closed tab groups"
  );
  Assert.equal(
    SessionStore.getClosedTabDataForWindow(win).length,
    0,
    "should start with no closed tabs"
  );
  Assert.equal(
    SessionStore.getClosedWindowData().length,
    0,
    "should start with no closed windows"
  );

  let removePromise = BrowserTestUtils.waitForEvent(
    tabGroup,
    "TabGroupRemoved"
  );
  win.gBrowser.removeTabGroup(tabGroup);
  await removePromise;

  await TabStateFlusher.flushWindow(win);

  Assert.equal(
    SessionStore.getClosedTabGroups().length,
    1,
    "should have one closed tab group"
  );

  await BrowserTestUtils.closeWindow(win);

  Assert.equal(
    SessionStore.getClosedWindowData().length,
    1,
    "should have one closed window"
  );
  Assert.equal(
    SessionStore.getClosedTabGroups().length,
    1,
    "should still have one closed tab group, even when the window is closed"
  );
  Assert.equal(
    SessionStore.getClosedTabDataFromClosedWindows().length,
    2,
    "should report 2 closed tabs from the closed tab group in the closed window"
  );
  await SpecialPowers.popPrefEnv();

  await SpecialPowers.pushPrefEnv({
    set: [["browser.sessionstore.closedTabsFromClosedWindows", false]],
  });
  Assert.equal(
    SessionStore.getClosedTabGroups().length,
    0,
    "should report no closed tabs if closedTabsFromClosedWindows is false"
  );
  await SpecialPowers.popPrefEnv();

  forgetClosedWindows();
});
