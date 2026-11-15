/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { ZenSessionStore } = ChromeUtils.importESModule(
  "resource:///modules/zen/ZenSessionManager.sys.mjs"
);

add_task(async function test_little_window_open_in_space() {
  ZenSessionStore.saveState(JSON.parse(SessionStore.getBrowserState()), true);
  const win = await openLittleWindowWithPage();

  const { active } = ZenLittleWindow.getSpaces();
  ok(active, "There is a space to open the page in");
  await TestUtils.waitForCondition(
    () =>
      win.document
        .getElementById("zen-little-window-open-label")
        .textContent.includes(active.name),
    "The button names the space the page will open in"
  );

  const tabCount = gBrowser.tabs.length;
  const closed = BrowserTestUtils.windowClosed(win);
  const target = await win.gZenLittleWindow.openInSpace();
  await closed;

  is(target, window, "The page moved to the window with spaces");
  is(gBrowser.tabs.length, tabCount + 1, "The window gained a tab");
  is(
    gBrowser.selectedBrowser.currentURI.spec,
    TEST_URL,
    "The moved page is selected"
  );
  is(
    gBrowser.selectedTab.getAttribute("zen-workspace-id"),
    active.uuid,
    "The page is in the active space"
  );

  BrowserTestUtils.removeTab(gBrowser.selectedTab);
});

add_task(async function test_little_window_open_in_space_shortcut() {
  const win = await openLittleWindowWithPage();
  const tabCount = gBrowser.tabs.length;
  const closed = BrowserTestUtils.windowClosed(win);
  EventUtils.synthesizeKey("o", { accelKey: true }, win);
  await closed;
  is(gBrowser.tabs.length, tabCount + 1, "The shortcut moved the page");

  BrowserTestUtils.removeTab(gBrowser.selectedTab);
});
