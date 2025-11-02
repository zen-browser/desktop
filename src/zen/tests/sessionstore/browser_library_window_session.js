// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

"use strict";

add_task(async function test_library_window_session() {
  // Open a new window with some tabs
  let win = await BrowserTestUtils.openNewBrowserWindow();
  let tab1 = await BrowserTestUtils.addTab(win.gBrowser, "about:mozilla");
  let tab2 = await BrowserTestUtils.addTab(win.gBrowser, "about:config");
  
  // Open the library window
  let libraryWin = await BrowserTestUtils.promiseLibraryWindow();
  
  // Close the main browser window
  await BrowserTestUtils.closeWindow(win);
  
  // Wait a bit to ensure session is saved
  await TestUtils.waitForTick();
  
  // Close library window
  await BrowserTestUtils.closeWindow(libraryWin);
  
  // Get the state file directly to verify it has content
  let state = SessionFile.read();
  ok(state, "Session file should exist");
  ok(state.windows?.length > 0, "Session should have windows");
  ok(state.windows[0].tabs?.length >= 2, "Session should have our test tabs");
});