/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/* eslint-disable mozilla/no-arbitrary-setTimeout */
"use strict";
requestLongerTimeout(4);

ChromeUtils.defineESModuleGetters(this, {
  SearchService: "moz-src:///toolkit/components/search/SearchService.sys.mjs",
  setTimeout: "resource://gre/modules/Timer.sys.mjs",
  sinon: "resource://testing-common/Sinon.sys.mjs",
});

const BOOKMARKS_ICON_URL = "chrome://browser/skin/bookmark.svg";

add_setup(async function () {
  await SpecialPowers.pushPrefEnv({
    set: [["browser.urlbar.scotchBonnet.enableOverride", true]],
  });

  forgetClosedWindows();
});

add_task(async function () {
  let win = await BrowserTestUtils.openNewBrowserWindow();

  await BrowserTestUtils.openNewForegroundTab(win.gBrowser, "about:mozilla");
  await BrowserTestUtils.openNewForegroundTab(win.gBrowser, "about:home");

  info("Set bookmarks search mode");
  await win.gURLBar.setSearchMode(
    { source: 1, isPreview: false },
    win.gBrowser.selectedBrowser
  );

  await BrowserTestUtils.closeWindow(win);

  ok(SessionStore.getClosedWindowCount(), "Should have a closed window");
  await forceSaveState();

  win = SessionStore.undoCloseWindow(0);

  await TestUtils.topicObserved(
    "sessionstore-single-window-restored",
    subject => subject == win
  );

  let persistSandbox = sinon.createSandbox();
  const originalUpdateSearchIcon =
    win.gURLBar.searchModeSwitcher.updateSearchIcon;
  let updateCalled = 0;

  persistSandbox
    .stub(win.gURLBar.searchModeSwitcher, "updateSearchIcon")
    .callsFake(async function () {
      await originalUpdateSearchIcon.call(this);
      updateCalled++;
    });

  let defaultEngine = await SearchService.getDefault();
  let defaultEngineIconURL = await defaultEngine.getIconURL();

  let defaultEngineIconCallsStack = [];

  persistSandbox.stub(defaultEngine, "getIconURL").callsFake(async function () {
    const iconURL = defaultEngineIconURL;
    defaultEngineIconURL = null;
    defaultEngineIconCallsStack.push(true);
    await new Promise(resolve => setTimeout(resolve, 200));
    defaultEngineIconCallsStack.pop();
    return Promise.resolve(iconURL);
  });

  registerCleanupFunction(async function () {
    persistSandbox.restore();
  });

  await TabStateFlusher.flush(win.gBrowser.selectedBrowser);

  is(win.gBrowser.tabs.length, 3, "The restored window should have 3 tabs");

  // Search mode switcher icon update will trigger once.
  await TestUtils.waitForCondition(() => updateCalled > 1);

  let searchModeSwitcherIconUrl = win.gURLBar
    .querySelector(".searchmode-switcher")
    .getAttribute("iconsrc");

  Assert.equal(
    searchModeSwitcherIconUrl,
    BOOKMARKS_ICON_URL,
    "Search mode switcher should display bookmarks icon."
  );

  persistSandbox.restore();

  // Wait for any ongoing calls to defaultEngine.getIconURL() to finish.
  await TestUtils.waitForCondition(() => !defaultEngineIconCallsStack.length);

  await BrowserTestUtils.closeWindow(win);

  // Clean up
  await promiseAllButPrimaryWindowClosed();
  forgetClosedWindows();
});
