"use strict";

const ORIG_STATE = SessionStore.getBrowserState();

registerCleanupFunction(async () => {
  await SessionStoreTestUtils.promiseBrowserState(ORIG_STATE);
});

add_task(async function test_RestoreMultipleGroups() {
  let win = await promiseNewWindowLoaded();
  BrowserTestUtils.addTab(win.gBrowser, "about:about");

  let aboutMozillaTab = BrowserTestUtils.addTab(win.gBrowser, "about:mozilla");
  let aboutBlankTab = BrowserTestUtils.addTab(win.gBrowser, "about:blank");
  let mozillaTabGroup = win.gBrowser.addTabGroup(
    [aboutMozillaTab, aboutBlankTab],
    { color: "red", label: "mozilla stuff" }
  );
  const mozillaTabGroupId = mozillaTabGroup.id;
  BrowserTestUtils.addTab(win.gBrowser, "about:robots");

  let aboutAboutTab = BrowserTestUtils.addTab(win.gBrowser, "about:about");
  let aboutMemoryTab = BrowserTestUtils.addTab(win.gBrowser, "about:memory");
  let systemTabGroup = win.gBrowser.addTabGroup(
    [aboutAboutTab, aboutMemoryTab],
    { color: "blue", label: "system stuff" }
  );
  systemTabGroup.collapsed = true;
  const systemTabGroupId = systemTabGroup.id;

  BrowserTestUtils.addTab(win.gBrowser, "about:license");

  await TabStateFlusher.flushWindow(win);
  await BrowserTestUtils.closeWindow(win);

  // Now restore the window
  win = SessionStore.undoCloseWindow(0);
  await BrowserTestUtils.waitForEvent(win, "SSWindowStateReady");
  await BrowserTestUtils.waitForEvent(
    win.gBrowser.tabContainer,
    "SSTabRestored"
  );

  Assert.equal(
    win.gBrowser.tabs.length,
    8,
    "there should be 7 tabs restored + 1 initial tab from the new window"
  );
  Assert.equal(
    win.gBrowser.tabGroups.length,
    2,
    "there should be 2 tab groups restored"
  );

  Assert.ok(
    !win.gBrowser.tabs[0].group,
    "initial tab from the new window should not be in a group"
  );
  Assert.ok(
    !win.gBrowser.tabs[1].group,
    "about:about tab should not be in a group"
  );
  Assert.equal(
    win.gBrowser.tabs[2].group.id,
    mozillaTabGroupId,
    "about:mozilla tab should be in the mozilla stuff group"
  );
  Assert.equal(
    win.gBrowser.tabs[3].group.id,
    mozillaTabGroupId,
    "about:blank tab should be in the mozilla stuff group"
  );
  Assert.ok(
    !win.gBrowser.tabs[4].group,
    "about:robots tab should not be in a group"
  );
  Assert.equal(
    win.gBrowser.tabs[5].group.id,
    systemTabGroupId,
    "about:about tab should be in the system stuff group"
  );
  Assert.equal(
    win.gBrowser.tabs[6].group.id,
    systemTabGroupId,
    "about:memory tab should be in the system stuff group"
  );
  Assert.ok(
    !win.gBrowser.tabs[7].group,
    "about:license tab should not be in a group"
  );

  [mozillaTabGroup, systemTabGroup] = win.gBrowser.tabGroups;
  Assert.equal(
    mozillaTabGroup.label,
    "mozilla stuff",
    "tab group name should be restored"
  );
  Assert.equal(
    mozillaTabGroup.id,
    mozillaTabGroupId,
    "tab group ID should be restored"
  );
  Assert.equal(
    mozillaTabGroup.color,
    "red",
    "tab group color should be restored"
  );
  Assert.ok(
    !mozillaTabGroup.collapsed,
    "tab group collapsed state should be restored"
  );

  Assert.equal(
    systemTabGroup.label,
    "system stuff",
    "tab group name should be restored"
  );
  Assert.equal(
    systemTabGroup.id,
    systemTabGroupId,
    "tab group ID should be restored"
  );
  Assert.equal(
    systemTabGroup.color,
    "blue",
    "tab group color should be restored"
  );
  Assert.ok(
    systemTabGroup.collapsed,
    "tab group collapsed state should be restored"
  );

  await BrowserTestUtils.closeWindow(win);
  forgetClosedWindows();
});
