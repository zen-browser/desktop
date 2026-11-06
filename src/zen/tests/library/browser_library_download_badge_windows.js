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

add_task(async function test_badge_tracks_an_older_pending_download() {
  await SpecialPowers.pushPrefEnv({ set: [["zen.library.enabled", true]] });
  const list = await Downloads.getList(Downloads.PUBLIC);
  const older = Object.assign(fakeDownload("older-active.pdf"), {
    stopped: false,
    succeeded: false,
    progress: 25,
  });
  const newer = Object.assign(fakeDownload("newer-completed.pdf"), {
    stopped: false,
    succeeded: false,
    progress: 50,
  });
  try {
    await list.add(older);
    await list.add(newer);
    await TestUtils.waitForCondition(() => badgeShowing(window));
    newer.stopped = true;
    newer.succeeded = true;
    newer.progress = 100;
    newer.onchange();

    const button = document.getElementById("zen-library-button");
    button.dispatchEvent(new MouseEvent("mouseenter"));
    button.dispatchEvent(new MouseEvent("mouseleave"));
    await TestUtils.waitForCondition(
      () =>
        !document
          .getElementById("zen-sidebar-foot-buttons")
          .hasAttribute("zen-library-stack-open"),
      "the preview closes and acknowledges the new downloads"
    );

    const badge = document.getElementById("library-button-badge");
    Assert.ok(badgeShowing(window), "the older download keeps the badge visible");
    Assert.ok(badge.hasAttribute("downloading"), "the badge shows progress");
    const arc = badge.querySelector(".zen-library-download-progress-arc");
    Assert.equal(parseFloat(arc.style.strokeDasharray), 25);

    older.progress = 65;
    older.onchange();
    Assert.equal(parseFloat(arc.style.strokeDasharray), 65);

    older.stopped = true;
    older.canceled = true;
    older.hasPartialData = true;
    older.onchange();
    Assert.ok(badgeShowing(window), "a paused download remains pending");

    older.hasPartialData = false;
    older.onchange();
    Assert.ok(!badgeShowing(window), "a canceled download is no longer pending");
  } finally {
    await list.remove(older);
    await list.remove(newer);
    await SpecialPowers.popPrefEnv();
  }
});
