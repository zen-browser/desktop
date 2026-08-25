/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

add_task(async function test_urlbarFocus() {
  /** Test for Bug 495495 */

  let newWin = openDialog(
    location,
    "_blank",
    "chrome,all,dialog=no,toolbar=yes"
  );
  await promiseWindowLoaded(newWin);
  let state1 = ss.getWindowState(newWin);
  await BrowserTestUtils.closeWindow(newWin);

  newWin = openDialog(
    location,
    "_blank",
    "chrome,extrachrome,menubar,resizable,scrollbars,status,toolbar=no,location,personal,directories,dialog=no"
  );
  await promiseWindowLoaded(newWin);
  let state2 = ss.getWindowState(newWin);

  async function testState(state, expected) {
    let win = openDialog(location, "_blank", "chrome,all,dialog=no");
    await promiseWindowLoaded(win);

    is(
      win.gURLBar.readOnly,
      false,
      "URL bar should not be read-only before setting the state"
    );
    await setWindowState(win, state, true);
    is(
      win.gURLBar.readOnly,
      expected.readOnly,
      "URL bar read-only state should be restored correctly"
    );

    await BrowserTestUtils.closeWindow(win);
  }

  await BrowserTestUtils.closeWindow(newWin);
  await testState(state1, { readOnly: false });
  await testState(state2, { readOnly: true });
});
