const ORIG_STATE = ss.getBrowserState();

const multiWindowState = {
  windows: [
    {
      tabs: [
        {
          entries: [
            {
              url: "https://example.com#win-0-tab-0",
              triggeringPrincipal_base64,
            },
          ],
        },
      ],
      _closedTabs: [
        {
          state: {
            entries: [
              {
                url: "https://example.com#win-0-closed-0",
                triggeringPrincipal_base64,
              },
            ],
          },
        },
        {
          state: {
            entries: [
              {
                url: "https://example.com#win-0-closed-1",
                triggeringPrincipal_base64,
              },
            ],
          },
        },
      ],
      selected: 1,
    },
    {
      tabs: [
        {
          entries: [
            {
              url: "https://example.org#win-1-tab-0",
              triggeringPrincipal_base64,
            },
          ],
        },
        {
          entries: [
            {
              url: "https://example.org#win-1-tab-1",
              triggeringPrincipal_base64,
            },
          ],
        },
      ],
      _closedTabs: [
        {
          state: {
            entries: [
              {
                url: "https://example.org#win-1-closed-0",
                triggeringPrincipal_base64,
              },
            ],
          },
        },
      ],
      selected: 1,
    },
  ],
  _closedWindows: [
    {
      tabs: [
        {
          entries: [
            {
              url: "https://example.org#closedWin-0-tab-0",
              triggeringPrincipal_base64,
            },
          ],
        },
      ],
      _closedTabs: [
        {
          state: {
            entries: [
              {
                url: "https://example.org##closedWin-0-closed-0",
                triggeringPrincipal_base64,
              },
            ],
          },
        },
      ],
    },
  ],
};

add_setup(async function testSetup() {
  await SessionStoreTestUtils.promiseBrowserState(multiWindowState);
});

add_task(async function test_ClosedTabMethods() {
  let sessionStoreUpdated;
  const browserWindows = BrowserWindowTracker.orderedWindows;
  Assert.equal(
    browserWindows.length,
    multiWindowState.windows.length,
    `We expect ${multiWindowState.windows} open browser windows`
  );
  info(
    `After setup, current tab URI: ${browserWindows[0].gBrowser.currentURI.spec}`
  );
  Assert.equal(
    browserWindows[0].gBrowser.currentURI.spec,
    "https://example.com/#win-0-tab-0",
    "The first tab of the first window we restored is current"
  );

  for (let idx = 0; idx < browserWindows.length; idx++) {
    const win = browserWindows[idx];
    const winData = multiWindowState.windows[idx];
    info(`window ${idx}: ${win.gBrowser.selectedBrowser.currentURI.spec}`);
    Assert.equal(
      winData._closedTabs.length,
      SessionStore.getClosedTabDataForWindow(win).length,
      `getClosedTabDataForWindow() for open window ${idx} returned the expected number of objects`
    );
  }

  let closedCount;
  closedCount = SessionStore.getClosedTabCountForWindow(browserWindows[0]);
  Assert.equal(2, closedCount, "2 closed tab for this window");

  closedCount = SessionStore.getClosedTabCountForWindow(browserWindows[1]);
  Assert.equal(1, closedCount, "1 closed tab for this window");

  closedCount = SessionStore.getClosedTabCount();
  // 3 closed tabs from open windows, 1 closed tab from the closed window
  Assert.equal(4, closedCount, "4 closed tab for all windows");

  let allWindowsClosedTabs = SessionStore.getClosedTabData();
  Assert.equal(
    SessionStore.getClosedTabCount({ closedTabsFromClosedWindows: false }),
    allWindowsClosedTabs.length,
    "getClosedTabData returned the correct number of entries"
  );
  for (let tabData of allWindowsClosedTabs) {
    Assert.ok(tabData.sourceWindowId, "each tab has a sourceWindowId property");
  }

  closedCount = SessionStore.getClosedTabCountFromClosedWindows();
  Assert.equal(1, closedCount, "1 closed tabs from closed windows");

  // ***********************************
  info("check with the all-windows pref off");
  await SpecialPowers.pushPrefEnv({
    set: [["browser.sessionstore.closedTabsFromAllWindows", false]],
  });

  info("With this pref off, the closed tab count is that of the top window");
  closedCount = SessionStore.getClosedTabCount({
    closedTabsFromClosedWindows: false,
  }); // Equivalent to SS.getClosedTabCountForWindow(browserWindows[0]),
  Assert.equal(closedCount, 2, `2 closed tabs from the top (first) window`);
  Assert.equal(
    SessionStore.getClosedTabCount(), // includes closed tabs from closed windows, but only the top open window
    3,
    `3 closed tabs when counting the top window and the closed window`
  );

  allWindowsClosedTabs = SessionStore.getClosedTabData(); // Equivalent to SS.getClosedTabDataForWindow(browserWindows[0]),
  Assert.equal(
    allWindowsClosedTabs.length,
    2,
    "getClosedTabData returned the number of entries for the top window"
  );
  SpecialPowers.popPrefEnv();
  await TestUtils.waitForTick();
  //
  // ***********************************

  closedCount = SessionStore.getClosedTabCount();
  Assert.equal(
    4,
    closedCount,
    "Sanity-check, with the pref on, we're back to 4 closed tabs"
  );

  // ***********************************
  info("check with the closed-tabs-from-closed-windows pref off");
  await SpecialPowers.pushPrefEnv({
    set: [["browser.sessionstore.closedTabsFromClosedWindows", false]],
  });

  info(
    "With this pref off, the closed tab count is that of only the only windows"
  );
  closedCount = SessionStore.getClosedTabCount(); // Equivalent to SS.getClosedTabCountForWindow(browserWindows[0]),
  Assert.equal(3, closedCount, `3 closed tabs from the open windows`);

  allWindowsClosedTabs = SessionStore.getClosedTabData();
  Assert.equal(
    allWindowsClosedTabs.length,
    3,
    "getClosedTabData returned the number of entries for the top window"
  );
  SpecialPowers.popPrefEnv();
  await TestUtils.waitForTick();
  //
  // ***********************************

  info("forget the closed tab from the closed window");
  sessionStoreUpdated = TestUtils.topicObserved(
    "sessionstore-closed-objects-changed"
  );
  SessionStore.forgetClosedTab(
    { sourceClosedId: SessionStore.getClosedWindowData()[0].closedId },
    0
  );
  await sessionStoreUpdated;

  closedCount = SessionStore.getClosedTabCountFromClosedWindows();
  Assert.equal(
    0,
    closedCount,
    "0 closed tabs from closed windows after forgetting them"
  );
  closedCount = SessionStore.getClosedTabCount();
  Assert.equal(
    3,
    closedCount,
    "3 closed tabs now that the closed tab from the closed window is forgotten"
  );

  info("restore one of the closed tabs from an open window");
  sessionStoreUpdated = TestUtils.topicObserved(
    "sessionstore-closed-objects-changed"
  );

  SessionStore.undoCloseTab(browserWindows[0], 0);
  await sessionStoreUpdated;

  Assert.equal(
    1,
    SessionStore.getClosedTabCountForWindow(browserWindows[0]),
    "Now theres one closed tab in the first window"
  );
  Assert.equal(
    1,
    SessionStore.getClosedTabCountForWindow(browserWindows[1]),
    "Theres still one closed tab in the 2nd window"
  );

  Assert.equal(
    2,
    SessionStore.getClosedTabCount(),
    "Theres a total for 2 closed tabs"
  );

  // Bug 1836198 - sometimes this reports 1 not 2.
  Assert.equal(
    2,
    SessionStore.getClosedTabData().length,
    "We get the right number of tab entries from getClosedTabData()"
  );

  info("forget the last closed tab in the first window");
  sessionStoreUpdated = TestUtils.topicObserved(
    "sessionstore-closed-objects-changed"
  );
  SessionStore.forgetClosedTab(browserWindows[0], 0);
  await sessionStoreUpdated;

  Assert.equal(
    0,
    SessionStore.getClosedTabCountForWindow(browserWindows[0]),
    "The first window has 0 closed tabs after forgetting the last tab"
  );
  Assert.equal(
    1,
    SessionStore.getClosedTabCountForWindow(browserWindows[1]),
    "Theres still one closed tab in the 2nd window"
  );

  Assert.equal(
    1,
    SessionStore.getClosedTabCount(),
    "Theres a total of one closed tabs"
  );
  Assert.equal(
    1,
    SessionStore.getClosedTabData().length,
    "We get the right number of tab entries from getClosedTabData()"
  );

  info(
    "Close the 2nd window. This makes its 1 closed tab a 'closed tab from closed window'"
  );
  await promiseAllButPrimaryWindowClosed();

  Assert.equal(
    0,
    SessionStore.getClosedTabCountForWindow(browserWindows[0]),
    "Closed tab count is unchanged after closing the other browser window"
  );

  Assert.equal(
    0,
    SessionStore.getClosedTabCount({ closedTabsFromClosedWindows: false }),
    "Theres now 0 closed tabs from open windows after closing the other browser window which had the last one"
  );

  Assert.equal(
    1,
    SessionStore.getClosedTabCount({ closedTabsFromClosedWindows: true }),
    "Theres now 1 closed tabs including closed windows after closing the other browser window which had the last one"
  );

  Assert.equal(
    0,
    SessionStore.getClosedTabData().length,
    "We get the right number of tab entries from getClosedTabData()"
  );

  Assert.equal(
    1,
    SessionStore.getClosedTabCountFromClosedWindows(),
    "There's 1 closed tabs from closed windows"
  );

  // Cleanup.
  await promiseBrowserState(ORIG_STATE);
});
