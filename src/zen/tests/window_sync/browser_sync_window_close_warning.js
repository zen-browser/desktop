/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_synced_window_close_does_not_warn_about_tabs() {
  await withNewTabAndWindow(async (_newTab, win) => {
    Assert.ok(
      win.gZenWindowSync.willTabsPersistAfterWindowClose(win),
      "Every tab in the new window should have a synchronized copy"
    );

    const originalWarnAboutClosingTabs = win.gBrowser.warnAboutClosingTabs;
    let warningCalls = 0;
    win.gBrowser.warnAboutClosingTabs = () => {
      warningCalls++;
      return false;
    };

    try {
      const windowSync = win.gZenWindowSync;
      win.gZenWindowSync = null;
      try {
        Assert.ok(
          !win.warnAboutClosingWindow(),
          "Closing a window outside Window Sync should still respect the warning"
        );
        Assert.equal(
          warningCalls,
          1,
          "The close-tabs warning should still be requested for an unsynced window"
        );
      } finally {
        win.gZenWindowSync = windowSync;
      }

      Assert.ok(
        win.WindowIsClosing({ ctrlKey: true }),
        "The real shortcut close pipeline should allow a synchronized window to close"
      );
      Assert.equal(
        warningCalls,
        1,
        "The misleading close-tabs warning should not be requested by the synchronized close"
      );
    } finally {
      win.gBrowser.warnAboutClosingTabs = originalWarnAboutClosingTabs;
    }
  });
});
