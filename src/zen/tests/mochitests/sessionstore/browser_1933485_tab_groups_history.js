"use strict";

const ORIG_STATE = SessionStore.getBrowserState();

registerCleanupFunction(async () => {
  await SessionStoreTestUtils.promiseBrowserState(ORIG_STATE);
});

// This test ensures that closed tab groups are immediately stored in the
// closedGroups array, even if their history was not stored in the tab state at
// the time the tab group was closed.
add_task(
  async function test_browser_1933485_tabGroupImmediatelyStoredInClosedGroups() {
    let win = await promiseNewWindowLoaded();

    const urls = ["about:blank", "about:robots", "https://www.example.com/"];
    const tabs = urls.map(url => BrowserTestUtils.addTab(win.gBrowser, url));
    await Promise.all(
      tabs.map((t, i) =>
        BrowserTestUtils.browserLoaded(t.linkedBrowser, { wantLoad: urls[i] })
      )
    );

    const tabGroup = win.gBrowser.addTabGroup(tabs);

    let removePromise = BrowserTestUtils.waitForEvent(
      tabGroup,
      "TabGroupRemoved"
    );
    win.gBrowser.removeTabGroup(tabGroup);
    await removePromise;

    const closedGroupState = SessionStore.getClosedTabGroups(win);

    Assert.equal(
      closedGroupState.length,
      1,
      "Tab group is stored in closedGroups"
    );

    await BrowserTestUtils.closeWindow(win);
  }
);
