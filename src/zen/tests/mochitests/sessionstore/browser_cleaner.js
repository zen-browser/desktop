/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

/*
 * This test ensures that Session Restore eventually forgets about
 * tabs and windows that have been closed a long time ago.
 */

"use strict";

const LONG_TIME_AGO = 1;

const URL_TAB1 =
  "http://example.com/browser_cleaner.js?newtab1=" + Math.random();
const URL_TAB2 =
  "http://example.com/browser_cleaner.js?newtab2=" + Math.random();
const URL_NEWGROUP =
  "http://example.com/browser_cleaner.js?newgroup=" + Math.random();
const URL_NEWWIN =
  "http://example.com/browser_cleaner.js?newwin=" + Math.random();

function isRecent(stamp) {
  is(typeof stamp, "number", "This is a timestamp");
  return Date.now() - stamp <= 60000;
}

function promiseCleanup() {
  info("Cleaning up browser");

  return promiseBrowserState(getClosedState());
}

function getClosedState() {
  return Cu.cloneInto(CLOSED_STATE, {});
}

var CLOSED_STATE;

add_setup(async function () {
  forgetClosedWindows();
  forgetClosedTabs(window);
  forgetClosedTabGroups(window);
});

add_task(async function test_open_and_close() {
  let newTab1 = BrowserTestUtils.addTab(gBrowser, URL_TAB1);
  await promiseBrowserLoaded(newTab1.linkedBrowser);

  let newTab2 = BrowserTestUtils.addTab(gBrowser, URL_TAB2);
  await promiseBrowserLoaded(newTab2.linkedBrowser);

  let newGroupTab = BrowserTestUtils.addTab(gBrowser, URL_NEWGROUP);
  await promiseBrowserLoaded(newGroupTab.linkedBrowser);
  let newGroup = gBrowser.addTabGroup([newGroupTab]);

  let newWin = await promiseNewWindowLoaded();
  let tab = BrowserTestUtils.addTab(newWin.gBrowser, URL_NEWWIN);

  await promiseBrowserLoaded(tab.linkedBrowser);

  await TabStateFlusher.flushWindow(window);
  await TabStateFlusher.flushWindow(newWin);

  info("1. Making sure that before closing, we don't have closedAt");
  // For the moment, no "closedAt"
  let state = JSON.parse(ss.getBrowserState());
  is(
    state.windows[0].closedAt || false,
    false,
    "1. Main window doesn't have closedAt"
  );
  is(
    state.windows[1].closedAt || false,
    false,
    "1. Second window doesn't have closedAt"
  );
  is(
    state.windows[0].tabs[0].closedAt || false,
    false,
    "1. First tab doesn't have closedAt"
  );
  is(
    state.windows[0].tabs[1].closedAt || false,
    false,
    "1. Second tab doesn't have closedAt"
  );
  is(
    state.windows[0].tabs[2].closedAt || false,
    false,
    "1. Grouped tab doesn't have closedAt"
  );
  is(
    state.windows[0].groups[0].closedAt || false,
    false,
    "1. Group doesn't have closedAt"
  );

  info("2. Making sure that after closing, we have closedAt");

  // Now close stuff, this should add closeAt
  await BrowserTestUtils.closeWindow(newWin);
  await promiseRemoveTabAndSessionState(newTab1);
  await promiseRemoveTabAndSessionState(newTab2);

  let removePromise = BrowserTestUtils.waitForEvent(
    newGroup,
    "TabGroupRemoved"
  );
  gBrowser.removeTabGroup(newGroup);
  await removePromise;

  state = CLOSED_STATE = JSON.parse(ss.getBrowserState());

  is(
    state.windows[0].closedAt || false,
    false,
    "2. Main window doesn't have closedAt"
  );
  ok(
    isRecent(state._closedWindows[0].closedAt),
    "2. Second window was closed recently"
  );
  ok(
    isRecent(state.windows[0]._closedTabs[0].closedAt),
    "2. First tab was closed recently"
  );
  ok(
    isRecent(state.windows[0]._closedTabs[1].closedAt),
    "2. Second tab was closed recently"
  );
  ok(
    isRecent(state.windows[0].closedGroups[0].closedAt),
    "2. Group was closed recently"
  );
});

add_task(async function test_restore() {
  info("3. Making sure that after restoring, we don't have closedAt");
  await promiseBrowserState(CLOSED_STATE);

  let newWin = ss.undoCloseWindow(0);
  await promiseDelayedStartupFinished(newWin);

  let newTab2 = ss.undoCloseTab(window, 0, window);
  await promiseTabRestored(newTab2);

  let newTab1 = ss.undoCloseTab(window, 0, window);
  await promiseTabRestored(newTab1);

  let state = JSON.parse(ss.getBrowserState());
  is(
    state.windows[0].closedAt || false,
    false,
    "3. Main window doesn't have closedAt"
  );
  is(
    state.windows[1].closedAt || false,
    false,
    "3. Second window doesn't have closedAt"
  );
  is(
    state.windows[0].tabs[0].closedAt || false,
    false,
    "3. First tab doesn't have closedAt"
  );
  is(
    state.windows[0].tabs[1].closedAt || false,
    false,
    "3. Second tab doesn't have closedAt"
  );

  await BrowserTestUtils.closeWindow(newWin);
  gBrowser.removeTab(newTab1);
  gBrowser.removeTab(newTab2);
});

add_task(async function test_old_data() {
  info(
    "4. Removing closedAt from the sessionstore, making sure that it is added upon idle-daily"
  );

  let state = getClosedState();
  delete state._closedWindows[0].closedAt;
  delete state.windows[0]._closedTabs[0].closedAt;
  delete state.windows[0]._closedTabs[1].closedAt;
  delete state.windows[0].closedGroups[0].closedAt;
  await promiseBrowserState(state);

  info("Sending idle-daily");
  Services.obs.notifyObservers(null, "idle-daily");
  info("Sent idle-daily");

  state = JSON.parse(ss.getBrowserState());
  is(
    state.windows[0].closedAt || false,
    false,
    "4. Main window doesn't have closedAt"
  );
  ok(
    isRecent(state._closedWindows[0].closedAt),
    "4. Second window was closed recently"
  );
  ok(
    isRecent(state.windows[0]._closedTabs[0].closedAt),
    "4. First tab was closed recently"
  );
  ok(
    isRecent(state.windows[0]._closedTabs[1].closedAt),
    "4. Second tab was closed recently"
  );
  ok(
    isRecent(state.windows[0].closedGroups[0].closedAt),
    "4. Group was closed recently"
  );
  await promiseCleanup();
});

add_task(async function test_cleanup() {
  info(
    "5. Altering closedAt to an old date, making sure that stuff gets collected, eventually"
  );
  await promiseCleanup();

  let state = getClosedState();
  state._closedWindows[0].closedAt = LONG_TIME_AGO;
  state.windows[0]._closedTabs[0].closedAt = LONG_TIME_AGO;
  state.windows[0].closedGroups[0].closedAt = LONG_TIME_AGO;
  state.windows[0]._closedTabs[1].closedAt = Date.now();
  let url = state.windows[0]._closedTabs[1].state.entries[0].url;

  await promiseBrowserState(state);

  info("Sending idle-daily");
  Services.obs.notifyObservers(null, "idle-daily");
  info("Sent idle-daily");

  state = JSON.parse(ss.getBrowserState());
  is(state._closedWindows[0], undefined, "5. Second window was forgotten");
  is(state.windows[0].closedGroups[0], undefined, "5. Tab group was forgotten");

  is(state.windows[0]._closedTabs.length, 1, "5. Only one closed tab left");
  is(
    state.windows[0]._closedTabs[0].state.entries[0].url,
    url,
    "5. The second tab is still here"
  );

  await promiseCleanup();

  // Cleanup closed tab group
  forgetClosedTabGroups(window);
});
