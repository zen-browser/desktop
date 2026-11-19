/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// Test that window positions are properly restored when DPI is such that CSS
// pixel math would lead to roundoff error (but device pixel math does not).
// We use 1.25 device pixels per CSS pixel: a desktop-pixel position is a whole
// number of CSS pixels only if it is a multiple of 5.
const DEV_PIXELS_PER_PX = 1.25;
const CSS_PIXEL_PERIOD = 5;

function getPositionInDesktopPix(win) {
  const baseWindow = win.docShell.treeOwner.QueryInterface(Ci.nsIBaseWindow);
  const x = {},
    y = {};
  baseWindow.getPosition(x, y);
  const scale = baseWindow.devicePixelsPerDesktopPixel;
  return { x: x.value / scale, y: y.value / scale };
}

add_task(async function test_position_survives_round_trip() {
  // Force a fractional number of device pixels per CSS pixel.
  await SpecialPowers.pushPrefEnv({
    set: [["layout.css.devPixelsPerPx", String(DEV_PIXELS_PER_PX)]],
  });

  const win = await BrowserTestUtils.openNewBrowserWindow();
  try {
    // Positions are only saved from, and restored to, windows in the normal
    // size mode.
    if (win.windowState != win.STATE_NORMAL) {
      const sizeModeChanged = BrowserTestUtils.waitForEvent(
        win,
        "sizemodechange"
      );
      win.restore();
      await sizeModeChanged;
    }

    const pos = getPositionInDesktopPix(win);

    // Pick a target which is deliberately not a whole number of CSS pixels.
    let targetX = pos.x + 1;
    if (targetX % CSS_PIXEL_PERIOD == 0) {
      targetX += 1;
    }
    isnot(
      targetX % CSS_PIXEL_PERIOD,
      0,
      "Test target should not land on a whole CSS pixel"
    );

    const state = ss.getWindowState(win);
    is(
      state.windows[0].screenX,
      pos.x,
      "Saved screenX should be the window's exact desktop-pixel position"
    );

    state.windows[0].screenX = targetX;
    ss.setWindowState(win, JSON.stringify(state), false);

    await TestUtils.waitForCondition(
      () => getPositionInDesktopPix(win).x == targetX,
      `Window should be restored to exactly ${targetX} desktop px`
    );

    is(
      ss.getWindowState(win).windows[0].screenX,
      targetX,
      "Restored position should be saved back unchanged"
    );
  } finally {
    await BrowserTestUtils.closeWindow(win);
  }
});
