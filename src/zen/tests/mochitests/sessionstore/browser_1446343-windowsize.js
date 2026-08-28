add_task(async function test() {
  const win = await BrowserTestUtils.openNewBrowserWindow();

  async function changeSizeMode(mode) {
    let promise = BrowserTestUtils.waitForEvent(win, "sizemodechange");
    win[mode]();
    await promise;
  }
  if (win.windowState != win.STATE_NORMAL) {
    await changeSizeMode("restore");
  }

  const { outerWidth, outerHeight, screenX, screenY } = win;
  function checkCurrentState(sizemode) {
    let state = ss.getWindowState(win);
    let winState = state.windows[0];
    let msgSuffix = ` should match on ${sizemode} mode`;
    is(winState.width, outerWidth, "width" + msgSuffix);
    is(winState.height, outerHeight, "height" + msgSuffix);
    // The position attributes seem to be affected on macOS when the
    // window gets maximized, so skip checking them for now.
    if (AppConstants.platform != "macosx" || sizemode == "normal") {
      is(winState.screenX, screenX, "screenX" + msgSuffix);
      is(winState.screenY, screenY, "screenY" + msgSuffix);
    }
    is(winState.sizemode, sizemode, "sizemode should match");
  }

  checkCurrentState("normal");

  await changeSizeMode("maximize");
  checkCurrentState("maximized");

  await changeSizeMode("minimize");
  checkCurrentState("minimized");

  // Clean up.
  await BrowserTestUtils.closeWindow(win);
});
