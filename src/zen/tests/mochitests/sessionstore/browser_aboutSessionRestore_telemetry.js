/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// Tests the session_restore.restore_page_outcome event recorded by
// about:sessionrestore and about:welcomeback.

function makeTab(url) {
  return { entries: [{ url, triggeringPrincipal_base64 }] };
}

const ONE_WINDOW_STATE = {
  windows: [{ tabs: [makeTab("about:mozilla"), makeTab("about:robots")] }],
};

const TWO_WINDOW_STATE = {
  windows: [
    { tabs: [makeTab("about:mozilla"), makeTab("about:robots")] },
    { tabs: [makeTab("about:about")] },
  ],
};

/**
 * Opens and selects a tab showing a restore page.
 *
 * @param {string} [url]
 *        "about:sessionrestore" (the default) or "about:welcomeback".
 * @param {object} [formdataIds]
 *        The formdata `id` values to restore into the page, if any.
 */
async function openRestorePage(url = "about:sessionrestore", formdataIds) {
  let tab = BrowserTestUtils.addTab(gBrowser, "about:blank");
  let browser = tab.linkedBrowser;
  await BrowserTestUtils.browserLoaded(browser, { wantLoad: "about:blank" });
  await BrowserTestUtils.switchTab(gBrowser, tab);

  let tabState = makeTab(url);
  if (formdataIds) {
    tabState.formdata = { url, id: formdataIds };
  }
  ss.setTabState(tab, JSON.stringify(tabState));
  let loaded = BrowserTestUtils.browserLoaded(browser, { wantLoad: url });

  await promiseTabRestored(tab);
  await loaded;
  return tab;
}

async function showTabList(tab) {
  let win = tab.linkedBrowser.contentWindow;
  let doc = win.document;
  if (doc.getElementById("tabsToggle")) {
    doc.getElementById("tabsToggle").click();
  } else {
    doc.getElementById("radioRestoreChoose").click();
  }
  await TestUtils.waitForCondition(
    () => win.gTreeInitialized,
    "Waiting for the tab list to be initialized"
  );
}

async function clickRestoreAndCloseNewWindow(tab) {
  let newWindowOpened = BrowserTestUtils.waitForNewWindow();
  tab.linkedBrowser.contentDocument.getElementById("errorTryAgain").click();
  let win = await newWindowOpened;
  if (tab.isConnected) {
    BrowserTestUtils.removeTab(tab);
  }
  await BrowserTestUtils.closeWindow(win);
  ss.forgetClosedWindow(0);
}

function assertSingleOutcome(expected, message) {
  let events = Glean.sessionRestore.restorePageOutcome.testGetValue();
  Assert.equal(events?.length, 1, "One outcome event was recorded");
  let expectedExtra = Object.fromEntries(
    Object.entries(expected).map(([key, value]) => [key, String(value)])
  );
  Assert.deepEqual(events[0].extra, expectedExtra, message);
}

add_setup(async function () {
  await SpecialPowers.pushPrefEnv({
    set: [["browser.startup.page", 0]],
  });
});

add_task(async function test_restore_all() {
  Services.fog.testResetFOG();
  let tab = await openRestorePage("about:sessionrestore", {
    sessionData: ONE_WINDOW_STATE,
    showReason: "many_crashes",
  });

  await clickRestoreAndCloseNewWindow(tab);

  assertSingleOutcome(
    {
      outcome: "restore_all",
      show_reason: "many_crashes",
      windows_offered: 1,
      windows_selected: 1,
      tabs_offered: 2,
      tabs_selected: 2,
      single_tabs_restored: 0,
    },
    "Restoring without opening the tab list restores everything"
  );
});

add_task(async function test_restore_subset() {
  Services.fog.testResetFOG();
  let tab = await openRestorePage("about:sessionrestore", {
    sessionData: TWO_WINDOW_STATE,
    showReason: "old_session",
  });
  await showTabList(tab);

  // Rows are: window 1, its two tabs, window 2, its tab.
  let win = tab.linkedBrowser.contentWindow;
  win.toggleRowChecked(2);
  win.toggleRowChecked(3);

  await clickRestoreAndCloseNewWindow(tab);

  assertSingleOutcome(
    {
      outcome: "restore_subset",
      show_reason: "old_session",
      windows_offered: 2,
      windows_selected: 1,
      tabs_offered: 3,
      tabs_selected: 1,
      single_tabs_restored: 0,
    },
    "Unchecked windows and tabs are not counted as selected"
  );
});

add_task(async function test_restore_with_hidden_tab_list() {
  Services.fog.testResetFOG();
  let tab = await openRestorePage("about:sessionrestore", {
    sessionData: ONE_WINDOW_STATE,
    showReason: "old_session",
  });
  await showTabList(tab);
  let win = tab.linkedBrowser.contentWindow;
  win.toggleRowChecked(1);
  win.document.getElementById("tabsToggle").click();

  await clickRestoreAndCloseNewWindow(tab);

  assertSingleOutcome(
    {
      outcome: "restore_all",
      show_reason: "old_session",
      windows_offered: 1,
      windows_selected: 1,
      tabs_offered: 2,
      tabs_selected: 2,
      single_tabs_restored: 0,
    },
    "Everything is restored, and counted, when the tab list is hidden"
  );
});

add_task(async function test_start_new_session() {
  Services.fog.testResetFOG();
  let tab = await openRestorePage("about:sessionrestore", {
    sessionData: TWO_WINDOW_STATE,
    showReason: "safe_mode",
  });
  let browser = tab.linkedBrowser;

  let loaded = BrowserTestUtils.browserLoaded(browser, {
    wantLoad: "about:blank",
  });
  browser.contentDocument.getElementById("errorCancel").click();
  await loaded;
  BrowserTestUtils.removeTab(tab);

  assertSingleOutcome(
    {
      outcome: "start_new_session",
      show_reason: "safe_mode",
      windows_offered: 2,
      windows_selected: 2,
      tabs_offered: 3,
      tabs_selected: 3,
      single_tabs_restored: 0,
    },
    "Starting a new session is recorded, and not followed by abandoned"
  );
});

add_task(async function test_no_data() {
  Services.fog.testResetFOG();
  let tab = await openRestorePage("about:sessionrestore");
  ok(
    tab.linkedBrowser.contentDocument.getElementById("errorTryAgain").disabled,
    "The restore button is disabled without session data"
  );
  BrowserTestUtils.removeTab(tab);

  assertSingleOutcome(
    { outcome: "no_data", single_tabs_restored: 0 },
    "A page without session data records no_data, with no counts or reason"
  );
});

add_task(async function test_abandoned_after_single_tab_restores() {
  Services.fog.testResetFOG();
  let tab = await openRestorePage("about:sessionrestore", {
    sessionData: ONE_WINDOW_STATE,
    showReason: "old_session",
  });
  await showTabList(tab);

  let tabsBefore = new Set(gBrowser.tabs);
  let win = tab.linkedBrowser.contentWindow;
  win.restoreSingleTab(1, false);
  win.restoreSingleTab(2, false);
  for (let newTab of gBrowser.tabs.filter(t => !tabsBefore.has(t))) {
    BrowserTestUtils.removeTab(newTab);
  }
  Assert.equal(
    Glean.sessionRestore.restorePageOutcome.testGetValue(),
    null,
    "Restoring single tabs doesn't record an outcome"
  );

  BrowserTestUtils.removeTab(tab);

  assertSingleOutcome(
    {
      outcome: "abandoned",
      show_reason: "old_session",
      windows_offered: 1,
      windows_selected: 1,
      tabs_offered: 2,
      tabs_selected: 2,
      single_tabs_restored: 2,
    },
    "Closing the page records abandoned, with the single tab restores"
  );
});

add_task(async function test_welcomeback_restore_subset() {
  Services.fog.testResetFOG();
  let tab = await openRestorePage("about:welcomeback", {
    sessionData: ONE_WINDOW_STATE,
    showReason: "profile_refresh",
  });
  await showTabList(tab);
  tab.linkedBrowser.contentWindow.toggleRowChecked(1);

  await clickRestoreAndCloseNewWindow(tab);

  assertSingleOutcome(
    {
      outcome: "restore_subset",
      show_reason: "profile_refresh",
      windows_offered: 1,
      windows_selected: 1,
      tabs_offered: 2,
      tabs_selected: 1,
      single_tabs_restored: 0,
    },
    "about:welcomeback records its outcome with the profile_refresh reason"
  );
});

add_task(async function test_welcomeback_restore_nothing_selected() {
  Services.fog.testResetFOG();
  let tab = await openRestorePage("about:welcomeback", {
    sessionData: ONE_WINDOW_STATE,
    showReason: "profile_refresh",
  });
  let browser = tab.linkedBrowser;
  await showTabList(tab);
  browser.contentWindow.toggleRowChecked(0);

  let loaded = BrowserTestUtils.browserLoaded(browser, {
    wantLoad: "about:blank",
  });
  browser.contentDocument.getElementById("errorTryAgain").click();
  await loaded;
  BrowserTestUtils.removeTab(tab);

  assertSingleOutcome(
    {
      outcome: "start_new_session",
      show_reason: "profile_refresh",
      windows_offered: 1,
      windows_selected: 0,
      tabs_offered: 2,
      tabs_selected: 0,
      single_tabs_restored: 0,
    },
    "Restoring with nothing selected starts a new session"
  );
});
