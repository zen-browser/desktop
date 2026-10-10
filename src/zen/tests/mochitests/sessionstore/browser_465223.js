/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

add_task(async function test_clearWindowValues() {
  /** Test for Bug 465223 */

  let uniqueKey1 = "bug 465223.1";
  let uniqueKey2 = "bug 465223.2";
  let uniqueValue1 = "unik" + Date.now();
  let uniqueValue2 = "pi != " + Math.random();

  // open a window and set a value on it
  let newWin = openDialog(location, "_blank", "chrome,all,dialog=no");
  await promiseWindowLoaded(newWin);
  ss.setCustomWindowValue(newWin, uniqueKey1, uniqueValue1);

  let newState = { windows: [{ tabs: [{ entries: [] }], extData: {} }] };
  newState.windows[0].extData[uniqueKey2] = uniqueValue2;
  await setWindowState(newWin, newState);

  is(newWin.gBrowser.tabs.length, 2, "original tab wasn't overwritten");
  is(
    ss.getCustomWindowValue(newWin, uniqueKey1),
    uniqueValue1,
    "window value wasn't overwritten when the tabs weren't"
  );
  is(
    ss.getCustomWindowValue(newWin, uniqueKey2),
    uniqueValue2,
    "new window value was correctly added"
  );

  newState.windows[0].extData[uniqueKey2] = uniqueValue1;
  await setWindowState(newWin, newState, true);

  is(newWin.gBrowser.tabs.length, 1, "original tabs were overwritten");
  is(
    ss.getCustomWindowValue(newWin, uniqueKey1),
    "",
    "window value was cleared"
  );
  is(
    ss.getCustomWindowValue(newWin, uniqueKey2),
    uniqueValue1,
    "window value was correctly overwritten"
  );

  // clean up
  await BrowserTestUtils.closeWindow(newWin);
});
