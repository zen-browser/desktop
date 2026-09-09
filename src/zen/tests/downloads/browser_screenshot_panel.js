/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_panel_refresh_and_disconnect() {
  const pref = "zen.downloads.screenshots.folder";
  const temporaryFolder = await IOUtils.createUniqueDirectory(
    PathUtils.tempDir,
    "zen-screenshot-panel",
  );
  const directory = await IOUtils.getDirectory(temporaryFolder);
  directory.normalize();
  const folder = directory.path;
  await SpecialPowers.pushPrefEnv({ set: [[pref, folder]] });
  registerCleanupFunction(async () => {
    DownloadsPanel.hidePanel();
    await IOUtils.remove(folder, { recursive: true });
  });
  DownloadsPanel.showPanel();
  await TestUtils.waitForCondition(
    () => document.getElementById("zen-screenshots"),
    "Screenshot section is attached",
  );
  const path = PathUtils.join(folder, "Screenshot.png");
  await IOUtils.writeUTF8(path, "test fixture");
  await IOUtils.setModificationTime(path, Date.now() - 5000);
  await TestUtils.waitForCondition(
    () => document.querySelector(".zen-screenshot-file"),
    "New screenshots appear while the popup is open",
  );
  const row = document.querySelector(".zen-screenshot-file");
  Assert.equal(row.textContent, "Screenshot.png", "Filename is plain text");
  Assert.ok(row.draggable, "Screenshot supports native drag");
  const drag = new DragEvent("dragstart", {
    bubbles: true,
    cancelable: true,
    dataTransfer: new DataTransfer(),
  });
  row.dispatchEvent(drag);
  // Events constructed with the system principal are trusted in Gecko.
  Assert.equal(
    drag.dataTransfer
      .mozGetDataAt("application/x-moz-file", 0)
      .QueryInterface(Ci.nsIFile).path,
    path,
    "Trusted drags carry the selected native file",
  );
  Assert.equal(
    drag.dataTransfer.effectAllowed,
    "copy",
    "Dragging never moves the original",
  );
  await IOUtils.remove(path);
  const stale = new DragEvent("dragstart", {
    bubbles: true,
    cancelable: true,
    dataTransfer: new DataTransfer(),
  });
  row.dispatchEvent(stale);
  Assert.ok(
    stale.defaultPrevented,
    "Dragging a deleted screenshot is cancelled",
  );
  Assert.equal(
    stale.dataTransfer.types.length,
    0,
    "Deleted files cannot be exported",
  );
  Services.prefs.setStringPref(pref, "");
  Assert.equal(
    document.querySelectorAll(".zen-screenshot-file").length,
    0,
    "Disconnect clears rows immediately",
  );
});

add_task(async function test_private_window_has_no_screenshot_section() {
  const privateWindow = await BrowserTestUtils.openNewBrowserWindow({
    private: true,
  });
  try {
    privateWindow.DownloadsPanel.showPanel();
    await TestUtils.waitForCondition(
      () => privateWindow.DownloadsPanel.panel.state === "open",
      "Private downloads popup is open",
    );
    Assert.ok(
      !privateWindow.document.getElementById("zen-screenshots"),
      "Private windows do not expose the screenshot folder",
    );
  } finally {
    await BrowserTestUtils.closeWindow(privateWindow);
  }
});
