add_task(async function test() {
  // Test for bugfix 384278. Confirms that sizemodeBeforeMinimized is set properly when window state is saved.
  let win = await BrowserTestUtils.openNewBrowserWindow();

  async function changeSizeMode(mode) {
    let promise = BrowserTestUtils.waitForEvent(win, "sizemodechange");
    win[mode]();
    await promise;
  }

  function checkCurrentState(sizemodeBeforeMinimized) {
    let state = ss.getWindowState(win);
    let winState = state.windows[0];
    is(
      winState.sizemodeBeforeMinimized,
      sizemodeBeforeMinimized,
      "sizemodeBeforeMinimized should match"
    );
  }

  // Note: Uses ss.getWindowState(win); as a more time efficient alternative to forceSaveState(); (causing timeouts).
  // Simulates FF restart.

  if (win.windowState != win.STATE_NORMAL) {
    await changeSizeMode("restore");
  }
  ss.getWindowState(win);
  await changeSizeMode("minimize");
  checkCurrentState("normal");

  // Need to create new window or test will timeout on linux.
  await BrowserTestUtils.closeWindow(win);
  win = await BrowserTestUtils.openNewBrowserWindow();

  if (win.windowState != win.STATE_MAXIMIZED) {
    await changeSizeMode("maximize");
  }
  ss.getWindowState(win);
  await changeSizeMode("minimize");
  checkCurrentState("maximized");

  // Clean up.
  await BrowserTestUtils.closeWindow(win);
});
