/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

add_task(async function test_deleteClosedWindow() {
  /** Test for Bug 491577 */

  const REMEMBER = Date.now(),
    FORGET = Math.random();
  let test_state = {
    windows: [
      {
        tabs: [
          {
            entries: [
              { url: "http://example.com/", triggeringPrincipal_base64 },
            ],
          },
        ],
        selected: 1,
      },
    ],
    _closedWindows: [
      // _closedWindows[0]
      {
        tabs: [
          {
            entries: [
              {
                url: "http://example.com/",
                triggeringPrincipal_base64,
                title: "title",
              },
            ],
          },
          {
            entries: [
              {
                url: "http://mozilla.org/",
                triggeringPrincipal_base64,
                title: "title",
              },
            ],
          },
        ],
        selected: 2,
        title: FORGET,
        _closedTabs: [],
      },
      // _closedWindows[1]
      {
        tabs: [
          {
            entries: [
              {
                url: "http://mozilla.org/",
                triggeringPrincipal_base64,
                title: "title",
              },
            ],
          },
          {
            entries: [
              {
                url: "http://example.com/",
                triggeringPrincipal_base64,
                title: "title",
              },
            ],
          },
          {
            entries: [
              {
                url: "http://mozilla.org/",
                triggeringPrincipal_base64,
                title: "title",
              },
            ],
          },
        ],
        selected: 3,
        title: REMEMBER,
        _closedTabs: [],
      },
      // _closedWindows[2]
      {
        tabs: [
          {
            entries: [
              {
                url: "http://example.com/",
                triggeringPrincipal_base64,
                title: "title",
              },
            ],
          },
        ],
        selected: 1,
        title: FORGET,
        _closedTabs: [
          {
            state: {
              entries: [
                {
                  url: "http://mozilla.org/",
                  triggeringPrincipal_base64,
                  title: "title",
                },
                {
                  url: "http://mozilla.org/again",
                  triggeringPrincipal_base64,
                  title: "title",
                },
              ],
            },
            pos: 1,
            title: "title",
          },
          {
            state: {
              entries: [
                {
                  url: "http://example.com",
                  triggeringPrincipal_base64,
                  title: "title",
                },
              ],
            },
            title: "title",
          },
        ],
      },
    ],
  };
  let remember_count = 1;

  function countByTitle(aClosedWindowList, aTitle) {
    return aClosedWindowList.filter(aData => aData.title == aTitle).length;
  }

  function testForError(aFunction) {
    try {
      aFunction();
      return false;
    } catch (ex) {
      return ex.name == "NS_ERROR_ILLEGAL_VALUE";
    }
  }

  // open a window and add the above closed window list
  let newWin = openDialog(location, "_blank", "chrome,all,dialog=no");
  await promiseWindowLoaded(newWin);
  Services.prefs.setIntPref(
    "browser.sessionstore.max_windows_undo",
    test_state._closedWindows.length
  );
  await setWindowState(newWin, test_state, true);

  let closedWindows = ss.getClosedWindowData();
  is(
    closedWindows.length,
    test_state._closedWindows.length,
    "Closed window list has the expected length"
  );
  is(
    countByTitle(closedWindows, FORGET),
    test_state._closedWindows.length - remember_count,
    "The correct amount of windows are to be forgotten"
  );
  is(
    countByTitle(closedWindows, REMEMBER),
    remember_count,
    "Everything is set up."
  );

  // all of the following calls with illegal arguments should throw NS_ERROR_ILLEGAL_VALUE
  ok(
    testForError(() => ss.forgetClosedWindow(-1)),
    "Invalid window for forgetClosedWindow throws"
  );
  ok(
    testForError(() =>
      ss.forgetClosedWindow(test_state._closedWindows.length + 1)
    ),
    "Invalid window for forgetClosedWindow throws"
  );

  // Remove third window, then first window
  ss.forgetClosedWindow(2);
  ss.forgetClosedWindow(null);

  closedWindows = ss.getClosedWindowData();
  is(
    closedWindows.length,
    remember_count,
    "The correct amount of windows were removed"
  );
  is(
    countByTitle(closedWindows, FORGET),
    0,
    "All windows specifically forgotten were indeed removed"
  );
  is(
    countByTitle(closedWindows, REMEMBER),
    remember_count,
    "... and windows not specifically forgetten weren't."
  );

  // clean up
  Services.prefs.clearUserPref("browser.sessionstore.max_windows_undo");
  await BrowserTestUtils.closeWindow(newWin);
});
