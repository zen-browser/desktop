"use strict";

const ORIG_STATE = SessionStore.getBrowserState();

registerCleanupFunction(async () => {
  await SessionStoreTestUtils.promiseBrowserState(ORIG_STATE);
});

add_task(async function test_ZeroTabGroups() {
  let win = await promiseNewWindowLoaded();
  const state = ss.getWindowState(win);

  Assert.equal(state.windows.length, 1, "should have state from 1 window");
  const windowState = state.windows[0];

  Assert.ok(windowState.groups, "window state should have a `groups` property");
  Assert.equal(
    windowState.groups.length,
    0,
    "`groups` property should be 0 since there are no tab groups"
  );

  const countOfGroupedTabs = windowState.tabs.filter(tab => tab.groupId).length;
  Assert.equal(
    countOfGroupedTabs,
    0,
    "none of the tabs should refer to a tab group"
  );
  await BrowserTestUtils.closeWindow(win);
  forgetClosedWindows();
});
