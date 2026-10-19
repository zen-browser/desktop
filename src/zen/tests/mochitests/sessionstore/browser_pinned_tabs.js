/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const REMOTE_URL = "https://www.example.com/";
const ABOUT_ROBOTS_URL = "about:robots";
const NO_TITLE_URL = "data:text/plain,foo";

const BACKUP_STATE = SessionStore.getBrowserState();
registerCleanupFunction(() => promiseBrowserState(BACKUP_STATE));

add_setup(async function () {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["browser.sessionstore.restore_on_demand", true],
      ["browser.sessionstore.restore_tabs_lazily", true],
    ],
  });
});

/**
 * When implementing batch insertion of tabs as part of session restore,
 * we started reversing the insertion order of pinned tabs (bug 1607441).
 * This test checks we don't regress that again.
 */
add_task(async function test_pinned_tabs_order() {
  // we expect 3 pinned tabs plus the selected tab get content restored.
  let allTabsRestored = promiseSessionStoreLoads(4);
  await promiseBrowserState({
    windows: [
      {
        selected: 4, // SessionStore uses 1-based indexing.
        tabs: [
          {
            pinned: true,
            entries: [{ url: REMOTE_URL, triggeringPrincipal_base64 }],
          },
          {
            pinned: true,
            entries: [{ url: ABOUT_ROBOTS_URL, triggeringPrincipal_base64 }],
          },
          {
            pinned: true,
            entries: [{ url: NO_TITLE_URL, triggeringPrincipal_base64 }],
          },
          { entries: [{ url: REMOTE_URL, triggeringPrincipal_base64 }] },
          { entries: [{ url: "about:blank", triggeringPrincipal_base64 }] },
        ],
      },
    ],
  });
  await allTabsRestored;
  let [tab1, tab2, tab3, tab4, tab5] = gBrowser.tabs;
  ok(tab1.pinned, "First tab is pinned");
  ok(tab2.pinned, "Second tab is pinned");
  ok(tab3.pinned, "Third tab is pinned");
  ok(!tab4.pinned, "Fourth tab is not pinned");
  ok(!tab5.pinned, "Fifth tab is not pinned");

  ok(tab4.selected, "Fourth tab is selected");
  is(
    tab1.linkedBrowser.currentURI.spec,
    REMOTE_URL,
    "First tab has matching URL"
  );
  is(
    tab2.linkedBrowser.currentURI.spec,
    ABOUT_ROBOTS_URL,
    "Second tab has matching URL"
  );
  is(
    tab3.linkedBrowser.currentURI.spec,
    NO_TITLE_URL,
    "Third tab has matching URL"
  );
  // Clean up for the next task.
  await promiseBrowserState(BACKUP_STATE);
});

/**
 * When fixing the previous regression, pinned tabs started disappearing out
 * of sessions with selected pinned tabs. This test checks that case.
 */
add_task(async function test_selected_pinned_tab_dataloss() {
  // we expect 3 pinned tabs (one of which is selected) get content restored.
  let allTabsRestored = promiseSessionStoreLoads(3);
  await promiseBrowserState({
    windows: [
      {
        selected: 1, // SessionStore uses 1-based indexing.
        tabs: [
          {
            pinned: true,
            entries: [{ url: REMOTE_URL, triggeringPrincipal_base64 }],
          },
          {
            pinned: true,
            entries: [{ url: ABOUT_ROBOTS_URL, triggeringPrincipal_base64 }],
          },
          {
            pinned: true,
            entries: [{ url: NO_TITLE_URL, triggeringPrincipal_base64 }],
          },
          { entries: [{ url: REMOTE_URL, triggeringPrincipal_base64 }] },
          { entries: [{ url: "about:blank", triggeringPrincipal_base64 }] },
        ],
      },
    ],
  });
  await allTabsRestored;
  let [tab1, tab2, tab3, tab4, tab5] = gBrowser.tabs;
  ok(tab5, "Should have 5 tabs");
  ok(tab1.pinned, "First tab is pinned");
  ok(tab2.pinned, "Second tab is pinned");
  ok(tab3.pinned, "Third tab is pinned");
  ok(tab4 && !tab4.pinned, "Fourth tab is not pinned");
  ok(tab5 && !tab5.pinned, "Fifth tab is not pinned");

  ok(tab1 && tab1.selected, "First (pinned) tab is selected");
  is(
    tab1.linkedBrowser.currentURI.spec,
    REMOTE_URL,
    "First tab has matching URL"
  );
  is(
    tab2.linkedBrowser.currentURI.spec,
    ABOUT_ROBOTS_URL,
    "Second tab has matching URL"
  );
  is(
    tab3.linkedBrowser.currentURI.spec,
    NO_TITLE_URL,
    "Third tab has matching URL"
  );
  // Clean up for the next task.
  await promiseBrowserState(BACKUP_STATE);
});

/**
 * While we're here, it seems useful to have a test for mixed pinned and
 * unpinned tabs in session store state, as well as userContextId.
 */
add_task(async function test_mixed_pinned_unpinned() {
  // we expect 3 pinned tabs plus the selected tab get content restored.
  let allTabsRestored = promiseSessionStoreLoads(4);
  await promiseBrowserState({
    windows: [
      {
        selected: 4, // SessionStore uses 1-based indexing.
        tabs: [
          {
            pinned: true,
            entries: [{ url: REMOTE_URL, triggeringPrincipal_base64 }],
          },
          { entries: [{ url: REMOTE_URL, triggeringPrincipal_base64 }] },
          {
            pinned: true,
            entries: [{ url: ABOUT_ROBOTS_URL, triggeringPrincipal_base64 }],
          },
          { entries: [{ url: "about:blank", triggeringPrincipal_base64 }] },
          {
            pinned: true,
            entries: [{ url: NO_TITLE_URL, triggeringPrincipal_base64 }],
          },
        ],
      },
    ],
  });
  await allTabsRestored;
  let [tab1, tab2, tab3, tab4, tab5] = gBrowser.tabs;
  ok(tab1.pinned, "First tab is pinned");
  ok(tab2.pinned, "Second tab is pinned");
  ok(tab3.pinned, "Third tab is pinned");
  ok(!tab4.pinned, "Fourth tab is not pinned");
  ok(!tab5.pinned, "Fifth tab is not pinned");

  // This is confusing to read - the 4th entry in the session data is
  // selected. But the 5th entry is pinned, so it moves to the start of the
  // tabstrip, so when we fetch `gBrowser.tabs`, the 4th entry in the list
  // is actually the 5th tab.
  ok(tab5.selected, "Fifth tab is selected");
  is(
    tab1.linkedBrowser.currentURI.spec,
    REMOTE_URL,
    "First tab has matching URL"
  );
  is(
    tab2.linkedBrowser.currentURI.spec,
    ABOUT_ROBOTS_URL,
    "Second tab has matching URL"
  );
  is(
    tab3.linkedBrowser.currentURI.spec,
    NO_TITLE_URL,
    "Third tab has matching URL"
  );
  // Clean up for the next task.
  await promiseBrowserState(BACKUP_STATE);
});

/**
 * After session restore, if we crash an unpinned tab, we noticed pinned tabs
 * created in the same process would lose all data (Bug 1624511). This test
 * checks that case.
 */
add_task(async function test_pinned_tab_dataloss() {
  // We do not run if there are no crash reporters to avoid
  // problems with the intentional crash.
  if (!AppConstants.MOZ_CRASHREPORTER) {
    return;
  }
  // If we end up increasing the process count limit in future,
  // we want to ensure that we don't stop testing this case
  // of pinned tab data loss.
  if (SpecialPowers.getIntPref("dom.ipc.processCount") > 8) {
    ok(
      false,
      "Process count is greater than 8, update the number of pinned tabs in test."
    );
  }

  // We expect 17 pinned tabs plus the selected tab get content restored.
  // Given that the default process count is currently 8, we need this
  // number of pinned tabs to reproduce the data loss. If this changes,
  // please add more pinned tabs.
  let allTabsRestored = promiseSessionStoreLoads(18);
  await promiseBrowserState({
    windows: [
      {
        selected: 18, // SessionStore uses 1-based indexing.
        tabs: [
          {
            pinned: true,
            entries: [{ url: REMOTE_URL, triggeringPrincipal_base64 }],
          },
          {
            pinned: true,
            entries: [{ url: REMOTE_URL, triggeringPrincipal_base64 }],
          },
          {
            pinned: true,
            entries: [{ url: REMOTE_URL, triggeringPrincipal_base64 }],
          },
          {
            pinned: true,
            entries: [{ url: REMOTE_URL, triggeringPrincipal_base64 }],
          },
          {
            pinned: true,
            entries: [{ url: REMOTE_URL, triggeringPrincipal_base64 }],
          },
          {
            pinned: true,
            entries: [{ url: REMOTE_URL, triggeringPrincipal_base64 }],
          },
          {
            pinned: true,
            entries: [{ url: REMOTE_URL, triggeringPrincipal_base64 }],
          },
          {
            pinned: true,
            entries: [{ url: REMOTE_URL, triggeringPrincipal_base64 }],
          },
          {
            pinned: true,
            entries: [{ url: REMOTE_URL, triggeringPrincipal_base64 }],
          },
          {
            pinned: true,
            entries: [{ url: REMOTE_URL, triggeringPrincipal_base64 }],
          },
          {
            pinned: true,
            entries: [{ url: REMOTE_URL, triggeringPrincipal_base64 }],
          },
          {
            pinned: true,
            entries: [{ url: REMOTE_URL, triggeringPrincipal_base64 }],
          },
          {
            pinned: true,
            entries: [{ url: REMOTE_URL, triggeringPrincipal_base64 }],
          },
          {
            pinned: true,
            entries: [{ url: REMOTE_URL, triggeringPrincipal_base64 }],
          },
          {
            pinned: true,
            entries: [{ url: REMOTE_URL, triggeringPrincipal_base64 }],
          },
          {
            pinned: true,
            entries: [{ url: REMOTE_URL, triggeringPrincipal_base64 }],
          },
          {
            pinned: true,
            entries: [{ url: REMOTE_URL, triggeringPrincipal_base64 }],
          },
          { entries: [{ url: REMOTE_URL, triggeringPrincipal_base64 }] },
        ],
      },
    ],
  });
  await allTabsRestored;

  let tabs = gBrowser.tabs;
  await BrowserTestUtils.crashFrame(tabs[17].linkedBrowser);

  await TestUtils.topicObserved("sessionstore-state-write-complete");

  for (let i = 0; i < tabs.length; i++) {
    let tab = tabs[i];
    is(
      tab.linkedBrowser.currentURI.spec,
      REMOTE_URL,
      `Tab ${i + 1} should have matching URL`
    );
  }

  // Clean up for the next task.
  await promiseBrowserState(BACKUP_STATE);
});
