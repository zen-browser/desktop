/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_closedTabGroupsFromSourceWindowOnly() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["browser.sessionstore.closedTabsFromAllWindows", false],
      ["browser.sessionstore.closedTabsFromClosedWindows", false],
    ],
  });

  let win = await promiseNewWindowLoaded();
  BrowserTestUtils.addTab(win.gBrowser, "about:robots");
  let tabGroup = win.gBrowser.addTabGroup([
    BrowserTestUtils.addTab(win.gBrowser, "about:robots"),
    BrowserTestUtils.addTab(win.gBrowser, "about:robots"),
  ]);
  await TabStateFlusher.flushWindow(win);

  let removePromise = BrowserTestUtils.waitForEvent(
    tabGroup,
    "TabGroupRemoved"
  );
  win.gBrowser.removeTabGroup(tabGroup);
  await removePromise;
  await TabStateFlusher.flushWindow(win);

  let closedTabGroups = SessionStore.getClosedTabGroups({ sourceWindow: win });
  Assert.equal(
    closedTabGroups.length,
    1,
    "Should return the closed tab group of the source window"
  );
  Assert.equal(
    closedTabGroups[0]?.id,
    tabGroup.id,
    "Should return the group that was closed"
  );

  let fragment = RecentlyClosedTabsAndWindowsMenuUtils.getTabsFragment(
    win,
    "menuitem"
  );
  Assert.equal(
    [...fragment.children].filter(el => el.localName == "menu").length,
    1,
    "Recently closed tabs menu should list the group's tabs in a submenu"
  );

  await BrowserTestUtils.closeWindow(win);
  forgetClosedWindows();
  await SpecialPowers.popPrefEnv();
});
