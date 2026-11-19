/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const { sinon } = ChromeUtils.importESModule(
  "resource://testing-common/Sinon.sys.mjs"
);

function holdNextZeroTimeout(win) {
  const realSetTimeout = win.setTimeout.bind(win);
  let callback;
  let callbackArgs;
  let holding = true;

  const stub = sinon.stub(win, "setTimeout").callsFake((fn, delay, ...args) => {
    if (!callback && delay === 0) {
      callback = fn;
      callbackArgs = args;
      return 1;
    }
    return realSetTimeout(fn, delay, ...args);
  });

  return {
    stopHolding() {
      if (!holding) {
        return;
      }
      holding = false;
      stub.restore();
      Assert.ok(callback, "captured the window feature restore timer");
    },

    run() {
      callback(...callbackArgs);
    },
  };
}

async function setSizeMode(win, method) {
  const changed = BrowserTestUtils.waitForEvent(win, "sizemodechange");
  win[method]();
  await changed;
}

function getWindowState(win, sizemode = "normal") {
  return {
    windows: [
      {
        tabs: [{ entries: [] }],
        width: Math.max(200, win.outerWidth - 20),
        height: Math.max(200, win.outerHeight - 20),
        screenX: win.screenX,
        screenY: win.screenY,
        sizemode,
      },
    ],
  };
}

add_task(async function test_minimize_while_restore_is_pending_wins() {
  const win = await BrowserTestUtils.openNewBrowserWindow();
  let heldTimer;

  registerCleanupFunction(async () => {
    if (!win.closed) {
      heldTimer?.stopHolding();
      await BrowserTestUtils.closeWindow(win);
    }
  });

  if (win.windowState != win.STATE_NORMAL) {
    await setSizeMode(win, "restore");
  }

  heldTimer = holdNextZeroTimeout(win);
  const restoring = promiseWindowRestoring(win);
  const restored = promiseWindowRestored(win);
  ss.setWindowState(win, JSON.stringify(getWindowState(win)), true);
  await restoring;
  heldTimer.stopHolding();

  if (win.windowState != win.STATE_MINIMIZED) {
    await setSizeMode(win, "minimize");
  }

  heldTimer.run();
  await restored;

  Assert.equal(
    win.windowState,
    win.STATE_MINIMIZED,
    "the newer minimized state is preserved"
  );

  if (win.windowState == win.STATE_MINIMIZED) {
    await setSizeMode(win, "restore");
  }
  await BrowserTestUtils.closeWindow(win);
});

add_task(async function test_initial_minimized_state_is_still_restored() {
  const win = await BrowserTestUtils.openNewBrowserWindow();
  let heldTimer;

  registerCleanupFunction(async () => {
    if (!win.closed) {
      heldTimer?.stopHolding();
      await BrowserTestUtils.closeWindow(win);
    }
  });

  if (win.windowState != win.STATE_MINIMIZED) {
    await setSizeMode(win, "minimize");
  }

  heldTimer = holdNextZeroTimeout(win);
  const restoring = promiseWindowRestoring(win);
  const restored = promiseWindowRestored(win);
  ss.setWindowState(win, JSON.stringify(getWindowState(win)), true);
  await restoring;
  heldTimer.stopHolding();

  const sizeModeChanged = BrowserTestUtils.waitForEvent(win, "sizemodechange");
  heldTimer.run();
  await Promise.all([restored, sizeModeChanged]);

  Assert.equal(
    win.windowState,
    win.STATE_NORMAL,
    "still applies saved state when the window was already minimized"
  );

  await BrowserTestUtils.closeWindow(win);
});
