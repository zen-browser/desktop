/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_little_window_new_tabs_open_elsewhere() {
  const win = await openLittleWindow({ url: TEST_URL });
  const littleTabs = win.gBrowser.tabs.length;

  const opened = BrowserTestUtils.waitForNewTab(gBrowser, OTHER_URL);
  win.openTrustedLinkIn(OTHER_URL, "tab");
  BrowserTestUtils.removeTab(await opened);
  is(
    win.gBrowser.tabs.length,
    littleTabs,
    "Like a popup, a little window sends new tabs to a regular window"
  );

  await BrowserTestUtils.closeWindow(win);
});

add_task(async function test_little_window_glance_opens_elsewhere() {
  const win = await openLittleWindow({ url: TEST_URL });
  const littleTabs = win.gBrowser.tabs.length;

  const opened = BrowserTestUtils.waitForNewTab(gBrowser, OTHER_URL);
  await win.gZenGlanceManager.openGlance({
    url: OTHER_URL,
    clientX: 0,
    clientY: 0,
    width: 0,
    height: 0,
    triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
  });
  const tab = await opened;
  ok(
    !tab.hasAttribute("zen-glance-tab"),
    "A glance asked for in a little window is a plain tab in a regular one"
  );
  is(win.gBrowser.tabs.length, littleTabs, "And nothing in the little window");

  BrowserTestUtils.removeTab(tab);
  await BrowserTestUtils.closeWindow(win);
});
