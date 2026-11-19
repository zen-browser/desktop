/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { ExtensionParent } = ChromeUtils.importESModule(
  "resource://gre/modules/ExtensionParent.sys.mjs"
);

add_task(
  async function test_inactive_workspace_tab_ids_removed_on_window_close() {
    await SpecialPowers.pushPrefEnv({
      set: [["zen.window-sync.enabled", false]],
    });
    let win;
    let workspace;

    try {
      await ExtensionParent.apiManager.lazyInit();
      win = await BrowserTestUtils.openNewBrowserWindow();
      await win.gZenWorkspaces.promiseInitialized;
      const tracker = ExtensionParent.apiManager.global.tabTracker;
      const tab = BrowserTestUtils.addTab(
        win.gBrowser,
        "https://example.com/",
        {
          skipAnimation: true,
        }
      );
      const id = tracker.getId(tab);
      workspace =
        await win.gZenWorkspaces.createAndSaveWorkspace("Tracker test");
      Assert.ok(
        !win.gBrowser.tabs.includes(tab),
        "The tab's workspace is inactive"
      );
      Assert.ok(
        win.gZenWorkspaces.allStoredTabs.includes(tab),
        "The inactive tab is still stored in the window"
      );

      await BrowserTestUtils.closeWindow(win);
      Assert.equal(
        tracker.getTab(id, null),
        null,
        "The closed tab ID is removed"
      );
    } finally {
      if (win && !win.closed) {
        await BrowserTestUtils.closeWindow(win);
      }
      if (
        workspace &&
        gZenWorkspaces
          .getWorkspaces()
          .some(space => space.uuid === workspace.uuid)
      ) {
        await gZenWorkspaces.removeWorkspace(workspace.uuid);
      }
      await SpecialPowers.popPrefEnv();
    }
  }
);
