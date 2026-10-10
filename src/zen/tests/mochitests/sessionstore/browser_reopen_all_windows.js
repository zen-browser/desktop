"use strict";

const PATH = "browser/browser/components/sessionstore/test/empty.html";
var URLS_WIN1 = [
  "https://example.com/" + PATH,
  "https://example.org/" + PATH,
  "http://test1.mochi.test:8888/" + PATH,
  "http://test1.example.com/" + PATH,
];
var EXPECTED_URLS_WIN1 = ["about:blank", ...URLS_WIN1];

var URLS_WIN2 = [
  "http://sub1.test1.mochi.test:8888/" + PATH,
  "http://sub2.xn--lt-uia.mochi.test:8888/" + PATH,
  "http://test2.mochi.test:8888/" + PATH,
  "http://sub1.test2.example.org/" + PATH,
  "http://sub2.test1.example.org/" + PATH,
  "http://test2.example.com/" + PATH,
];
var EXPECTED_URLS_WIN2 = ["about:blank", ...URLS_WIN2];

requestLongerTimeout(4);

function allTabsRestored(win, expectedUrls) {
  return new Promise(resolve => {
    let tabsRestored = 0;
    function handler(event) {
      let spec = event.target.linkedBrowser.currentURI.spec;
      if (expectedUrls.includes(spec)) {
        tabsRestored++;
      }
      info(`Got SSTabRestored for ${spec}, tabsRestored=${tabsRestored}`);
      if (tabsRestored === expectedUrls.length) {
        win.gBrowser.tabContainer.removeEventListener(
          "SSTabRestored",
          handler,
          true
        );
        resolve();
      }
    }
    win.gBrowser.tabContainer.addEventListener("SSTabRestored", handler, true);
  });
}

async function windowAndTabsRestored(win, expectedUrls) {
  await TestUtils.topicObserved(
    "browser-window-before-show",
    subject => subject === win
  );
  return allTabsRestored(win, expectedUrls);
}

add_task(async () => {
  await SpecialPowers.pushPrefEnv({
    set: [
      // Set the pref to true so we know exactly how many tabs should be restoring at
      // any given time. This guarantees that a finishing load won't start another.
      ["browser.sessionstore.restore_on_demand", false],
    ],
  });

  forgetClosedWindows();
  is(SessionStore.getClosedWindowCount(), 0, "starting with no closed windows");

  // Open window 1, with different tabs
  let win1 = await BrowserTestUtils.openNewBrowserWindow();
  for (let url of URLS_WIN1) {
    await BrowserTestUtils.openNewForegroundTab(win1.gBrowser, url);
  }

  // Open window 2, with different tabs
  let win2 = await BrowserTestUtils.openNewBrowserWindow();
  for (let url of URLS_WIN2) {
    await BrowserTestUtils.openNewForegroundTab(win2.gBrowser, url);
  }

  await TabStateFlusher.flushWindow(win1);
  await TabStateFlusher.flushWindow(win2);

  // Close both windows
  await BrowserTestUtils.closeWindow(win1);
  await BrowserTestUtils.closeWindow(win2);
  await forceSaveState();

  // Verify both windows were accounted for by session store
  is(
    ss.getClosedWindowCount(),
    2,
    "The closed windows was added to Recently Closed Windows"
  );

  // We previously used to manually navigate the Library menu to click the
  // "Reopen all Windows" button, but that reopens all windows at once without
  // returning a reference to each window. Since we need to attach listeners to
  // these windows *before* they start restoring tabs, we now manually call
  // undoCloseWindow() here, which has the same effect, but also gives us the
  // window references.
  info("Reopening windows");
  let restoredWindows = [];
  while (SessionStore.getClosedWindowCount() > 0) {
    restoredWindows.unshift(SessionWindowUI.undoCloseWindow());
  }
  is(restoredWindows.length, 2, "Reopened correct number of windows");

  let win1Restored = windowAndTabsRestored(
    restoredWindows[0],
    EXPECTED_URLS_WIN1
  );
  let win2Restored = windowAndTabsRestored(
    restoredWindows[1],
    EXPECTED_URLS_WIN2
  );

  info("About to wait for tabs to be restored");
  await Promise.all([win1Restored, win2Restored]);

  is(
    restoredWindows[0].gBrowser.tabs.length,
    EXPECTED_URLS_WIN1.length,
    "All tabs restored"
  );
  is(
    restoredWindows[1].gBrowser.tabs.length,
    EXPECTED_URLS_WIN2.length,
    "All tabs restored"
  );

  // Verify that tabs opened as expected
  Assert.deepEqual(
    restoredWindows[0].gBrowser.tabs.map(
      tab => tab.linkedBrowser.currentURI.spec
    ),
    EXPECTED_URLS_WIN1
  );
  Assert.deepEqual(
    restoredWindows[1].gBrowser.tabs.map(
      tab => tab.linkedBrowser.currentURI.spec
    ),
    EXPECTED_URLS_WIN2
  );

  info("About to close windows");
  await BrowserTestUtils.closeWindow(restoredWindows[0]);
  await BrowserTestUtils.closeWindow(restoredWindows[1]);
});
