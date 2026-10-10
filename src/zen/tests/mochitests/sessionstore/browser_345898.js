/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function test() {
  /** Test for Bug 345898 */

  // all of the following calls with illegal arguments should throw NS_ERROR_ILLEGAL_VALUE
  Assert.throws(
    () => ss.getWindowState({}),
    /NS_ERROR_ILLEGAL_VALUE/,
    "Invalid window for getWindowState throws"
  );
  Assert.throws(
    () => ss.setWindowState({}, "", false),
    /NS_ERROR_ILLEGAL_VALUE/,
    "Invalid window for setWindowState throws"
  );
  Assert.throws(
    () => ss.getTabState({}),
    /NS_ERROR_ILLEGAL_VALUE/,
    "Invalid tab for getTabState throws"
  );
  Assert.throws(
    () => ss.setTabState({}, "{}"),
    /NS_ERROR_ILLEGAL_VALUE/,
    "Invalid tab state for setTabState throws"
  );
  Assert.throws(
    () => ss.setTabState({}, JSON.stringify({ entries: [] })),
    /NS_ERROR_ILLEGAL_VALUE/,
    "Invalid tab for setTabState throws"
  );
  Assert.throws(
    () => ss.duplicateTab({}, {}),
    /NS_ERROR_ILLEGAL_VALUE/,
    "Invalid tab for duplicateTab throws"
  );
  Assert.throws(
    () => ss.duplicateTab({}, gBrowser.selectedTab),
    /NS_ERROR_ILLEGAL_VALUE/,
    "Invalid window for duplicateTab throws"
  );
  Assert.throws(
    () => ss.getClosedTabDataForWindow({}),
    /NS_ERROR_ILLEGAL_VALUE/,
    "Invalid window for getClosedTabData throws"
  );
  Assert.throws(
    () => ss.undoCloseTab({}, 0),
    /NS_ERROR_ILLEGAL_VALUE/,
    "Invalid window for undoCloseTab throws"
  );
  Assert.throws(
    () => ss.undoCloseTab(window, -1),
    /NS_ERROR_ILLEGAL_VALUE/,
    "Invalid index for undoCloseTab throws"
  );
  Assert.throws(
    () => ss.getCustomWindowValue({}, ""),
    /NS_ERROR_ILLEGAL_VALUE/,
    "Invalid window for getCustomWindowValue throws"
  );
  Assert.throws(
    () => ss.setCustomWindowValue({}, "", ""),
    /NS_ERROR_ILLEGAL_VALUE/,
    "Invalid window for setCustomWindowValue throws"
  );
}
