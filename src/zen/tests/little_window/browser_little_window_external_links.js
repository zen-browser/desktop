/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { gZenSpaceRoutingManager } = ChromeUtils.importESModule(
  "resource:///modules/zen/spacerouting/ZenSpaceRoutingManager.sys.mjs"
);

const LITTLE_WINDOW_ROUTE = "little-window";
const MOST_RECENT_SPACE_ROUTE = "most-recent-space";

function openExternalLink(url) {
  return gZenSpaceRoutingManager.openExternalUriInLittleWindow(
    Services.io.newURI(url),
    window,
    Services.scriptSecurityManager.createNullPrincipal({})
  );
}

add_task(async function test_external_links_default_to_a_little_window() {
  is(
    gZenSpaceRoutingManager.getDefaultExternalRoute(),
    LITTLE_WINDOW_ROUTE,
    "Links from other applications go to a little window unless set otherwise"
  );

  const opened = BrowserTestUtils.domWindowOpenedAndLoaded();
  ok(openExternalLink(TEST_URL), "A little window took the link");
  const win = await opened;
  ok(ZenLittleWindow.isLittleWindow(win), "And it is a little window");
  await BrowserTestUtils.browserLoaded(
    win.gBrowser.selectedBrowser,
    false,
    TEST_URL
  );
  ok(!win.gZenLittleWindow.isUrlbarOnly, "Showing the page");
  await BrowserTestUtils.closeWindow(win);
});

add_task(async function test_external_links_follow_the_setting() {
  gZenSpaceRoutingManager.setDefaultExternalRoute(MOST_RECENT_SPACE_ROUTE);
  registerCleanupFunction(() =>
    gZenSpaceRoutingManager.setDefaultExternalRoute(LITTLE_WINDOW_ROUTE)
  );
  ok(
    !openExternalLink(TEST_URL),
    "A link is left to a regular window when a space is what was picked"
  );

  gZenSpaceRoutingManager.setDefaultExternalRoute(LITTLE_WINDOW_ROUTE);
  await SpecialPowers.pushPrefEnv({
    set: [["zen.little-window.enabled", false]],
  });
  is(
    gZenSpaceRoutingManager.getDefaultExternalRoute(),
    MOST_RECENT_SPACE_ROUTE,
    "And so it is with little windows disabled"
  );
  ok(!openExternalLink(TEST_URL), "No little window opens then");
  await SpecialPowers.popPrefEnv();
});

add_task(async function test_external_links_without_a_window() {
  ok(
    gZenSpaceRoutingManager.takesExternalUrisWithoutWindow,
    "Links that arrive with no window open are handed over"
  );
  const entry = {
    uri: Services.io.newURI(TEST_URL),
    principal: Services.scriptSecurityManager.createNullPrincipal({}),
  };

  const opened = BrowserTestUtils.domWindowOpenedAndLoaded();
  await gZenSpaceRoutingManager.openExternalUrisAfterStartup([entry]);
  const win = await opened;
  ok(ZenLittleWindow.isLittleWindow(win), "The link got a little window");
  await BrowserTestUtils.closeWindow(win);

  gZenSpaceRoutingManager.setDefaultExternalRoute(MOST_RECENT_SPACE_ROUTE);
  registerCleanupFunction(() =>
    gZenSpaceRoutingManager.setDefaultExternalRoute(LITTLE_WINDOW_ROUTE)
  );
  const tabOpened = BrowserTestUtils.waitForNewTab(gBrowser, TEST_URL);
  await gZenSpaceRoutingManager.openExternalUrisAfterStartup([entry]);
  BrowserTestUtils.removeTab(await tabOpened);
  ok(true, "And a tab in the regular window when a space is what was picked");
  gZenSpaceRoutingManager.setDefaultExternalRoute(LITTLE_WINDOW_ROUTE);
});

add_task(async function test_external_link_for_a_window_still_starting() {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.window-sync.enabled", false]],
  });
  const starting = OpenBrowserWindow();
  const opened = TestUtils.topicObserved(
    "browser-delayed-startup-finished",
    subject => ZenLittleWindow.isLittleWindow(subject)
  );
  ok(
    gZenSpaceRoutingManager.handleExternalUri(
      Services.io.newURI(TEST_URL),
      starting,
      Services.scriptSecurityManager.createNullPrincipal({})
    ),
    "The link is taken rather than opened in the window that is starting"
  );
  const [win] = await opened;
  ok(true, "And gets a little window");
  await BrowserTestUtils.closeWindow(win);
  await starting.gZenStartup.promiseInitialized;
  await BrowserTestUtils.closeWindow(starting);
  await SpecialPowers.popPrefEnv();
});

add_task(async function test_external_link_from_the_command_line() {
  const handler = Cc["@mozilla.org/browser/final-clh;1"].getService(
    Ci.nsICommandLineHandler
  );
  const opened = TestUtils.topicObserved(
    "browser-delayed-startup-finished",
    subject => ZenLittleWindow.isLittleWindow(subject)
  );
  handler.handle(
    Cu.createCommandLine(
      ["-url", TEST_URL],
      null,
      Ci.nsICommandLine.STATE_REMOTE_EXPLICIT
    )
  );
  const [win] = await opened;
  await BrowserTestUtils.browserLoaded(
    win.gBrowser.selectedBrowser,
    false,
    TEST_URL
  );
  ok(true, "A link handed to the running application opens a little window");
  await BrowserTestUtils.closeWindow(win);
});
