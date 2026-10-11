/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { SessionSaver } = ChromeUtils.importESModule(
  "moz-src:///browser/components/sessionstore/SessionSaver.sys.mjs"
);
const { SessionFile } = ChromeUtils.importESModule(
  "moz-src:///browser/components/sessionstore/SessionFile.sys.mjs"
);

add_task(async function test_closed_synced_window_is_not_saved_as_open() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.window-sync.enabled", true],
      ["zen.window-sync.sync-only-pinned-tabs", false],
      ["browser.sessionstore.interval", 600000],
    ],
  });
  const previousTabs = new Set(gBrowser.tabs);
  const previousClosedIds = new Set(
    SessionStore.getClosedWindowData().map(win => win.closedId)
  );
  let win;
  try {
    await gZenWorkspaces.promiseInitialized;
    win = await BrowserTestUtils.openNewBrowserWindow();
    await win.gZenWorkspaces.promiseInitialized;
    const tab = BrowserTestUtils.addTab(win.gBrowser, "https://example.com/");
    await BrowserTestUtils.browserLoaded(tab.linkedBrowser);
    await BrowserTestUtils.closeWindow(win);
    win = null;

    // No tab activity in the surviving window: that would clear Firefox's
    // closed-in-series flag and hide the startup bug.
    await SessionSaver.run();
    const state = await IOUtils.readJSON(SessionFile.Paths.recovery, {
      decompress: true,
    });
    Assert.equal(state.windows.length, 1, "Only the open window is restored");
    const closed = SessionStore.getClosedWindowData().filter(
      item => !previousClosedIds.has(item.closedId)
    );
    Assert.equal(closed.length, 1, "The window remains available for undo");
    Assert.ok(
      state._closedWindows.some(item => item.closedId === closed[0].closedId),
      "The closed synced window is persisted as closed, not open"
    );
  } finally {
    if (win) {
      await BrowserTestUtils.closeWindow(win);
    }
    for (const item of SessionStore.getClosedWindowData()) {
      if (!previousClosedIds.has(item.closedId)) {
        SessionStore.forgetClosedWindowById(item.closedId);
      }
    }
    for (const tab of Array.from(gBrowser.tabs)) {
      if (!previousTabs.has(tab)) {
        BrowserTestUtils.removeTab(tab);
      }
    }
    await SpecialPowers.popPrefEnv();
  }
});
