/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

add_task(function cleanup() {
  info("Forgetting closed tabs");
  forgetClosedTabs(window);
});

add_task(async function test_restore_pbm() {
  // Clear the list of closed windows.
  forgetClosedWindows();

  // Create a new window to attach our frame script to.
  let win = await promiseNewWindowLoaded({ private: true });

  // Create a new tab in the new window that will load the frame script.
  let tab = BrowserTestUtils.addTab(win.gBrowser, "about:mozilla");
  let browser = tab.linkedBrowser;
  await promiseBrowserLoaded(browser);

  // Check that we consider the tab as private.
  let state = JSON.parse(ss.getTabState(tab));
  ok(state.isPrivate, "tab considered private");

  // Ensure that closed tabs in a private windows can be restored.
  await SessionStoreTestUtils.closeTab(tab);
  is(ss.getClosedTabCountForWindow(win), 1, "there is a single tab to restore");

  // Ensure that closed private windows can never be restored.
  await BrowserTestUtils.closeWindow(win);
  is(ss.getClosedWindowCount(), 0, "no windows to restore");
});

/**
 * Tests the purgeDataForPrivateWindow SessionStore method.
 */
add_task(async function test_purge_pbm() {
  info("Clear the list of closed windows.");
  forgetClosedWindows();

  info("Create a new window to attach our frame script to.");
  let win = await promiseNewWindowLoaded({ private: true });

  info("Create a new tab in the new window that will load the frame script.");
  let tab = BrowserTestUtils.addTab(win.gBrowser, "about:mozilla");
  let browser = tab.linkedBrowser;
  await promiseBrowserLoaded(browser);

  info("Ensure that closed tabs in a private windows can be restored.");
  await SessionStoreTestUtils.closeTab(tab);
  is(ss.getClosedTabCountForWindow(win), 1, "there is a single tab to restore");

  info("Call purgeDataForPrivateWindow");
  ss.purgeDataForPrivateWindow(win);

  is(ss.getClosedTabCountForWindow(win), 0, "there is no tab to restore");

  // Cleanup
  await BrowserTestUtils.closeWindow(win);
});
