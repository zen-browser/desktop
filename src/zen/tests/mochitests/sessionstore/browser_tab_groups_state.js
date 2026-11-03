"use strict";

const ORIG_STATE = SessionStore.getBrowserState();

registerCleanupFunction(async () => {
  await SessionStoreTestUtils.promiseBrowserState(ORIG_STATE);
});

/**
 * @param {WindowStateData} windowState
 * @returns {TabStateData|undefined}
 */
function findTabStateByUrl(windowState, url) {
  return windowState.tabs.find(tabState => tabState.userTypedValue == url);
}

add_task(async function test_TabGroupsInState() {
  let win = await promiseNewWindowLoaded();
  let aboutRobotsTab = BrowserTestUtils.addTab(win.gBrowser, "about:robots");
  let aboutMozillaTab = BrowserTestUtils.addTab(win.gBrowser, "about:mozilla");
  BrowserTestUtils.addTab(win.gBrowser, "about:about");

  let group = win.gBrowser.addTabGroup([aboutRobotsTab, aboutMozillaTab], {
    label: "non-meta about pages",
  });

  let state = ss.getWindowState(win);

  Assert.equal(state.windows.length, 1, "should have state from 1 window");
  let windowState = state.windows[0];

  Assert.ok(windowState.groups, "window state should have a `groups` property");
  Assert.equal(windowState.groups.length, 1, "there should be one tab group");
  let groupState = windowState.groups[0];

  Assert.equal(
    groupState.id,
    group.id,
    "tab group ID should be recorded in state"
  );
  Assert.equal(
    groupState.name,
    group.label,
    "tab group name should be recorded in state"
  );
  Assert.equal(
    groupState.color,
    group.color,
    "tab group color should be recorded in state"
  );
  Assert.equal(
    groupState.collapsed,
    group.collapsed,
    "tab group collapsed state should be recorded in state"
  );

  Assert.equal(
    windowState.tabs.length,
    4,
    "there should be 3 tabs in session state + 1 initial tab"
  );

  const aboutRobotsTabState = findTabStateByUrl(windowState, "about:robots");
  Assert.ok(aboutRobotsTabState, "about:robots tab should be in session state");
  Assert.equal(
    aboutRobotsTabState.groupId,
    group.id,
    "about:robots tab should be part of the tab group"
  );

  const aboutMozillaTabState = findTabStateByUrl(windowState, "about:mozilla");
  Assert.ok(
    aboutMozillaTabState,
    "about:mozilla tab should be in session state"
  );
  Assert.equal(
    aboutMozillaTabState.groupId,
    group.id,
    "about:mozilla tab should be part of the tab group"
  );

  const aboutAboutTabState = findTabStateByUrl(windowState, "about:about");
  Assert.ok(aboutAboutTabState, "about:about tab should be in session state");
  Assert.ok(
    !aboutAboutTabState.groupId,
    "about:about tab should NOT be part of the tab group"
  );

  // collapse the tab group and make sure the tab group data updates
  group.collapsed = true;

  state = ss.getWindowState(win);
  groupState = state.windows[0].groups[0];
  Assert.equal(
    groupState.collapsed,
    group.collapsed,
    "updated tab group collapsed state should be recorded in state"
  );
  await BrowserTestUtils.closeWindow(win);
  forgetClosedWindows();
});
