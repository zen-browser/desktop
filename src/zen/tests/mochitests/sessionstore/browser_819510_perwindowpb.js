/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

// Test opening default mochitest-normal-private-normal-private windows
// (saving the state with last window being private)

requestLongerTimeout(2);

add_task(async function test_1() {
  let win = await promiseNewWindowLoaded();
  await promiseTabLoad(win, "http://www.example.com/#1");

  win = await promiseNewWindowLoaded({ private: true });
  await promiseTabLoad(win, "http://www.example.com/#2");

  win = await promiseNewWindowLoaded();
  await promiseTabLoad(win, "http://www.example.com/#3");

  win = await promiseNewWindowLoaded({ private: true });
  await promiseTabLoad(win, "http://www.example.com/#4");

  let curState = JSON.parse(ss.getBrowserState());
  is(curState.windows.length, 5, "Browser has opened 5 windows");
  is(curState.windows[2].isPrivate, true, "Window is private");
  is(curState.windows[4].isPrivate, true, "Last window is private");
  is(curState.selectedWindow, 5, "Last window opened is the one selected");

  let state = JSON.parse(await promiseRecoveryFileContents());

  is(
    state.windows.length,
    2,
    "sessionstore state: 2 windows in data being written to disk"
  );
  is(
    state.selectedWindow,
    2,
    "Selected window is updated to match one of the saved windows"
  );
  ok(
    state.windows.every(win2 => !win2.isPrivate),
    "Saved windows are not private"
  );
  is(
    state._closedWindows.length,
    0,
    "sessionstore state: no closed windows in data being written to disk"
  );

  // Cleanup.
  await promiseAllButPrimaryWindowClosed();
  forgetClosedWindows();
});

// Test opening default mochitest window + 2 private windows
add_task(async function test_2() {
  let win = await promiseNewWindowLoaded({ private: true });
  await promiseTabLoad(win, "http://www.example.com/#1");

  win = await promiseNewWindowLoaded({ private: true });
  await promiseTabLoad(win, "http://www.example.com/#2");

  let curState = JSON.parse(ss.getBrowserState());
  is(curState.windows.length, 3, "Browser has opened 3 windows");
  is(curState.windows[1].isPrivate, true, "Window 1 is private");
  is(curState.windows[2].isPrivate, true, "Window 2 is private");
  is(curState.selectedWindow, 3, "Last window opened is the one selected");

  let state = JSON.parse(await promiseRecoveryFileContents());

  is(
    state.windows.length,
    0,
    "sessionstore state: no window in data being written to disk"
  );
  is(
    state.selectedWindow,
    0,
    "Selected window updated to 0 given there are no saved windows"
  );
  is(
    state._closedWindows.length,
    0,
    "sessionstore state: no closed windows in data being written to disk"
  );

  // Cleanup.
  await promiseAllButPrimaryWindowClosed();
  forgetClosedWindows();
});

// Test opening default-normal-private-normal windows and closing a normal window
add_task(async function test_3() {
  let normalWindow = await promiseNewWindowLoaded();
  await promiseTabLoad(normalWindow, "http://www.example.com/#1");

  let win = await promiseNewWindowLoaded({ private: true });
  await promiseTabLoad(win, "http://www.example.com/#2");

  win = await promiseNewWindowLoaded();
  await promiseTabLoad(win, "http://www.example.com/#3");

  let curState = JSON.parse(ss.getBrowserState());
  is(curState.windows.length, 4, "Browser has opened 4 windows");
  is(curState.windows[2].isPrivate, true, "Window 2 is private");
  is(curState.selectedWindow, 4, "Last window opened is the one selected");

  await BrowserTestUtils.closeWindow(normalWindow);

  // Pin and unpin a tab before checking the written state so that
  // the list of restoring windows gets cleared. Otherwise the
  // window we just closed would be marked as not closed.
  let tab = win.gBrowser.tabs[0];
  win.gBrowser.pinTab(tab);
  win.gBrowser.unpinTab(tab);

  let state = JSON.parse(await promiseRecoveryFileContents());

  is(
    state.windows.length,
    1,
    "sessionstore state: 1 window in data being written to disk"
  );
  is(
    state.selectedWindow,
    1,
    "Selected window is updated to match one of the saved windows"
  );
  ok(
    state.windows.every(win2 => !win2.isPrivate),
    "Saved windows are not private"
  );
  is(
    state._closedWindows.length,
    1,
    "sessionstore state: 1 closed window in data being written to disk"
  );
  ok(
    state._closedWindows.every(win2 => !win2.isPrivate),
    "Closed windows are not private"
  );

  // Cleanup.
  await promiseAllButPrimaryWindowClosed();
  forgetClosedWindows();
});

async function promiseTabLoad(win, url) {
  let tab = BrowserTestUtils.addTab(win.gBrowser, url);
  await promiseBrowserLoaded(tab.linkedBrowser);
  await TabStateFlusher.flush(tab.linkedBrowser);
}
