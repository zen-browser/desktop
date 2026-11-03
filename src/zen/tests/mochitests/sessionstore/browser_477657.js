/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

add_task(async function test_sizemodeDefaults() {
  /** Test for Bug 477657 */
  let newWin = openDialog(location, "_blank", "chrome,all,dialog=no");
  await promiseWindowLoaded(newWin);
  let newState = {
    windows: [
      {
        tabs: [{ entries: [] }],
        _closedTabs: [
          {
            state: { entries: [{ url: "about:" }] },
            title: "About:",
          },
        ],
        sizemode: "maximized",
      },
    ],
  };

  let uniqueKey = "bug 477657";
  let uniqueValue = "unik" + Date.now();

  ss.setCustomWindowValue(newWin, uniqueKey, uniqueValue);
  is(
    ss.getCustomWindowValue(newWin, uniqueKey),
    uniqueValue,
    "window value was set before the window was overwritten"
  );

  await setWindowState(newWin, newState, true);
  // use newWin.setTimeout(..., 0) to mirror sss_restoreWindowFeatures
  await new Promise(resolve => newWin.setTimeout(resolve, 0));

  is(
    ss.getCustomWindowValue(newWin, uniqueKey),
    "",
    "window value was implicitly cleared"
  );

  is(newWin.windowState, newWin.STATE_MAXIMIZED, "the window was maximized");

  is(
    ss.getClosedTabDataForWindow(newWin).length,
    1,
    "the closed tab was added before the window was overwritten"
  );
  delete newState.windows[0]._closedTabs;
  delete newState.windows[0].sizemode;

  await setWindowState(newWin, newState, true);
  await new Promise(resolve => newWin.setTimeout(resolve, 0));

  is(
    ss.getClosedTabDataForWindow(newWin).length,
    0,
    "closed tabs were implicitly cleared"
  );

  is(
    newWin.windowState,
    newWin.STATE_MAXIMIZED,
    "the window remains maximized"
  );
  newState.windows[0].sizemode = "normal";

  await setWindowState(newWin, newState, true);
  await new Promise(resolve => newWin.setTimeout(resolve, 0));

  isnot(
    newWin.windowState,
    newWin.STATE_MAXIMIZED,
    "the window was explicitly unmaximized"
  );

  await BrowserTestUtils.closeWindow(newWin);
});
