/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { Downloads } = ChromeUtils.importESModule(
  "resource://gre/modules/Downloads.sys.mjs"
);

function fakeDownload(name) {
  const tmp = Services.dirsvc.get("TmpD", Ci.nsIFile).path;
  return {
    source: { url: `https://example.com/${name}`, isPrivate: false },
    target: { path: PathUtils.join(tmp, name), exists: true },
    stopped: true,
    succeeded: true,
    canceled: false,
    deleted: false,
    hasPartialData: false,
    hasProgress: true,
    progress: 100,
    currentBytes: 1024,
    totalBytes: 1024,
    speed: 0,
    error: null,
    endTime: Date.now(),
    launchWhenSucceeded: false,
    refresh: async () => {},
  };
}

function badgeShowing(win) {
  return win.document
    .getElementById("zen-sidebar-foot-buttons")
    .hasAttribute("zen-library-badge");
}

add_task(async function test_clearing_downloads_clears_every_window_badge() {
  await SpecialPowers.pushPrefEnv({ set: [["zen.library.enabled", true]] });

  // Zen's windows share their tabs, so a second window leaves one behind.
  const originalTabs = new Set(gBrowser.tabs);
  const other = await BrowserTestUtils.openNewBrowserWindow();
  registerCleanupFunction(async () => {
    for (const tab of [...gBrowser.tabs]) {
      if (!originalTabs.has(tab)) {
        gBrowser.removeTab(tab, { animate: false, skipSessionStore: true });
      }
    }
  });
  // Both windows watch the same list, and neither has opened its stack, so
  // what arrives is new to both of them.
  const list = await Downloads.getList(Downloads.PUBLIC);
  const download = fakeDownload("badge-me.pdf");
  await list.add(download);

  for (const win of [window, other]) {
    await TestUtils.waitForCondition(
      () => badgeShowing(win),
      "the window shows the badge for a download it has not looked at"
    );
  }

  // What "Clear Download Preview" does: the download leaves the list every
  // window is watching.
  await list.remove(download);

  for (const win of [window, other]) {
    Assert.ok(
      !badgeShowing(win),
      "a download that is gone leaves no badge behind, in any window"
    );
    Assert.equal(
      win.document
        .getElementById("library-button-badge")
        .style.getPropertyValue("--download-image"),
      "",
      "and the picture of it is dropped with it"
    );
  }

  await BrowserTestUtils.closeWindow(other);
  await SpecialPowers.popPrefEnv();
});
