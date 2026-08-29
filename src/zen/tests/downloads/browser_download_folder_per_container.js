/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const DOWNLOAD_FOLDERS_PREF = "zen.downloads.container-folders";

add_task(async function testDownloadFolderIsAppliedToContainerTab() {
  const folder = PathUtils.join(PathUtils.tempDir, "school-downloads");
  await SpecialPowers.pushPrefEnv({
    set: [[DOWNLOAD_FOLDERS_PREF, JSON.stringify({ 1: folder })]],
  });

  const tab = BrowserTestUtils.addTab(gBrowser, "about:blank", {
    skipAnimation: true,
    userContextId: 1,
  });
  registerCleanupFunction(() => BrowserTestUtils.removeTab(tab));

  await TestUtils.waitForCondition(
    () =>
      tab.linkedBrowser.browsingContext.top.downloadFolderOverride == folder,
    "The container download folder should be applied to the tab",
  );
  Assert.equal(
    tab.linkedBrowser.browsingContext.top.downloadFolderOverride,
    folder,
    "The container tab should use its configured download folder",
  );
});
