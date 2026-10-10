"use strict";

const ORIG_STATE = SessionStore.getBrowserState();

registerCleanupFunction(async () => {
  await SessionStoreTestUtils.promiseBrowserState(ORIG_STATE);
});

add_task(
  async function test_browser_1953801_tabGroupImmediatelyStoredInSavedGroupsOnCloseOtherTabs() {
    let savedGroupState;
    let win = await promiseNewWindowLoaded();

    savedGroupState = SessionStore.getSavedTabGroups(win);
    Assert.equal(
      savedGroupState.length,
      0,
      "Should start with no saved groups"
    );

    const tabs = [
      BrowserTestUtils.addTab(win.gBrowser, "about:robots"),
      BrowserTestUtils.addTab(win.gBrowser, "about:robots"),
      BrowserTestUtils.addTab(win.gBrowser, "https://www.example.com"),
    ];
    await Promise.all(tabs.map(t => promiseBrowserLoaded(t.linkedBrowser)));

    const tabGroup = win.gBrowser.addTabGroup([tabs[1], tabs[2]], {
      label: "group-to-save",
    });

    await TestUtils.waitForCondition(
      () => SessionStore.getWindowState(win).windows[0].groups.length == 1,
      "Waiting for group to appear in session store"
    );

    let removePromise = BrowserTestUtils.waitForEvent(
      tabGroup,
      "TabGroupRemoved"
    );
    win.gBrowser.removeAllTabsBut(win.gBrowser.tabs[0]);
    await removePromise;

    savedGroupState = SessionStore.getSavedTabGroups(win);
    Assert.equal(
      savedGroupState.length,
      1,
      "Tab group is stored in saved groups"
    );

    await BrowserTestUtils.closeWindow(win);
    forgetClosedWindows();
    SessionStore.forgetSavedTabGroup(tabGroup.id);
  }
);
