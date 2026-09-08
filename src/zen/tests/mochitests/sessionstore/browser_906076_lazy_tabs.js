/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const TEST_STATE = {
  windows: [
    {
      tabs: [
        {
          entries: [{ url: "http://example.com", triggeringPrincipal_base64 }],
        },
        {
          entries: [{ url: "http://example.com", triggeringPrincipal_base64 }],
        },
        {
          entries: [{ url: "http://example.com", triggeringPrincipal_base64 }],
        },
        {
          entries: [{ url: "http://example.com", triggeringPrincipal_base64 }],
        },
        {
          entries: [{ url: "http://example.com", triggeringPrincipal_base64 }],
        },
        {
          entries: [{ url: "http://example.com", triggeringPrincipal_base64 }],
        },
        {
          entries: [{ url: "http://example.com", triggeringPrincipal_base64 }],
        },
        {
          entries: [{ url: "http://example.com", triggeringPrincipal_base64 }],
        },
        {
          entries: [{ url: "http://example.com", triggeringPrincipal_base64 }],
        },
        {
          entries: [{ url: "http://example.com", triggeringPrincipal_base64 }],
        },
      ],
    },
  ],
};

const TEST_STATE_2 = {
  windows: [
    {
      tabs: [
        { entries: [{ url: "about:robots", triggeringPrincipal_base64 }] },
        {
          entries: [],
          userTypedValue: "http://example.com",
          userTypedClear: 1,
        },
      ],
    },
  ],
};

function countNonLazyTabs(win) {
  win = win || window;
  let count = 0;
  for (let browser of win.gBrowser.browsers) {
    if (browser.isConnected) {
      count++;
    }
  }
  return count;
}

/**
 * Test that lazy browsers do not get prematurely inserted by
 * code accessing browser bound properties on the unbound browser.
 */

add_task(async function test() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["browser.sessionstore.restore_on_demand", true],
      ["browser.sessionstore.restore_tabs_lazily", true],
    ],
  });

  let backupState = SessionStore.getBrowserState();

  await promiseBrowserState(TEST_STATE);

  info(
    "Check that no lazy browsers get unnecessarily inserted after session restore"
  );
  is(countNonLazyTabs(), 1, "Window has only 1 non-lazy tab");

  await TestUtils.topicObserved("sessionstore-state-write-complete");

  // When sessionstore write occurs, tabs are checked for state changes.
  // Make sure none of them insert their browsers when this happens.
  info("Check that no lazy browsers get inserted after sessionstore write");
  is(countNonLazyTabs(), 1, "Window has only 1 non-lazy tab");

  info("Check that lazy browser gets inserted properly");
  ok(
    !gBrowser.browsers[1].isConnected,
    "The browser that we're attempting to insert is indeed lazy"
  );
  gBrowser._insertBrowser(gBrowser.tabs[1]);
  is(countNonLazyTabs(), 2, "Window now has 2 non-lazy tabs");

  // Check if any lazy tabs got inserted when window closes.
  let newWindow = await promiseNewWindowLoaded();

  SessionStore.setWindowState(newWindow, JSON.stringify(TEST_STATE));

  await new Promise(resolve => {
    newWindow.addEventListener(
      "unload",
      () => {
        info("Check that no lazy browsers get inserted when window closes");
        is(countNonLazyTabs(newWindow), 1, "Window has only 1 non-lazy tab");

        info(
          "Check that it is not possible to insert a lazy browser after the window closed"
        );
        ok(
          !newWindow.gBrowser.browsers[1].isConnected,
          "The browser that we're attempting to insert is indeed lazy"
        );
        newWindow.gBrowser._insertBrowser(newWindow.gBrowser.tabs[1]);
        is(
          countNonLazyTabs(newWindow),
          1,
          "Window still has only 1 non-lazy tab"
        );

        resolve();
      },
      { once: true }
    );

    newWindow.close();
  });

  // Bug 1365933.
  info(
    "Check that session with tab having empty entries array gets restored properly"
  );
  await promiseBrowserState(TEST_STATE_2);

  is(gBrowser.tabs.length, 2, "Window has 2 tabs");
  is(
    gBrowser.selectedBrowser.currentURI.spec,
    "about:robots",
    "Tab has the expected URL"
  );

  gBrowser.selectedTab = gBrowser.tabs[1];
  await BrowserTestUtils.browserLoaded(gBrowser.selectedBrowser);
  is(
    gBrowser.selectedBrowser.currentURI.spec,
    "http://example.com/",
    "Tab has the expected URL"
  );

  // Cleanup.
  await promiseBrowserState(backupState);
});
