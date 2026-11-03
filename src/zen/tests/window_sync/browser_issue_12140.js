/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const PAGE_12140 = "https://example.com/12140";

async function openWindowWithAPage() {
  const win = await BrowserTestUtils.openNewBrowserWindow();
  BrowserTestUtils.startLoadingURIString(
    win.gBrowser.selectedBrowser,
    PAGE_12140
  );
  await BrowserTestUtils.browserLoaded(win.gBrowser.selectedBrowser);
  return win;
}

add_task(async function test_closingAWindowUnqueuesTheEarlierOne() {
  const first = await openWindowWithAPage();
  const second = await openWindowWithAPage();

  await BrowserTestUtils.closeWindow(first);
  const afterFirst = SessionStore.getClosedWindowData();
  Assert.ok(afterFirst.length, "The first window was stored as closed");
  Assert.ok(
    afterFirst[0]._shouldRestore,
    "The window just closed is queued for restore, as upstream intends"
  );
  const firstClosedId = afterFirst[0].closedId;

  await BrowserTestUtils.closeWindow(second);

  const afterSecond = SessionStore.getClosedWindowData();
  const firstAgain = afterSecond.find(
    winData => winData.closedId === firstClosedId
  );
  Assert.ok(!!firstAgain, "The first window is still in the closed list");
  Assert.ok(
    !firstAgain._shouldRestore,
    "Closing another window drops the earlier one's queued restore"
  );
});
