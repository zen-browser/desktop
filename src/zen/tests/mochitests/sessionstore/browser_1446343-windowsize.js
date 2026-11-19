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

  const { outerWidth, outerHeight } = win;
  // Sizes are in CSS pixels, but positions are in desktop pixels (bug
  // 1247335), so use device pixels from the widget instead of
  // window.screenX/Y.
  const baseWindow = win.docShell.treeOwner.QueryInterface(Ci.nsIBaseWindow);
  const scale = baseWindow.devicePixelsPerDesktopPixel;
  function getPosition() {
    const posX = {},
      posY = {};
    baseWindow.getPosition(posX, posY);
    return { x: posX.value / scale, y: posY.value / scale };
  }

  // Once the window is maximized or minimized, its position is read back from
  // the persisted screenX/screenY attributes of the root element rather than
  // from the widget. Those are written a short time after the window is moved,
  // so move it once here and wait for them, to be sure they describe where this
  // window actually is.  See bug 2064941.
  {
    const pos = getPosition();
    baseWindow.setPositionDesktopPix(pos.x + 1, pos.y + 1);
    await TestUtils.waitForCondition(
      () => getPosition().x == pos.x + 1 && getPosition().y == pos.y + 1,
      "Window should have moved"
    );
    await TestUtils.waitForCondition(
      () =>
        win.document.documentElement.getAttribute("screenX") ==
        String(pos.x + 1),
      "Persisted screenX attribute should catch up with the window position"
    );
  }

  const { x: screenX, y: screenY } = getPosition();

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
