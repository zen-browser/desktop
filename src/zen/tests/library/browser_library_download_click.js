/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { DownloadsCommon } = ChromeUtils.importESModule(
  "moz-src:///browser/components/downloads/DownloadsCommon.sys.mjs"
);

const Library = customElements.get("zen-library");

function finishedDownload(name) {
  const tmp = Services.dirsvc.get("TmpD", Ci.nsIFile).path;
  return {
    source: { url: `https://example.com/${name}` },
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

function rowFor(section, name) {
  for (const row of section.querySelectorAll(".zen-library-row")) {
    if (row.querySelector(".zen-library-row-title").textContent === name) {
      return row;
    }
  }
  return null;
}

add_task(async function test_clicking_a_download_opens_the_file() {
  await SpecialPowers.pushPrefEnv({ set: [["zen.library.enabled", true]] });

  const opened = [];
  const revealed = [];
  const openDownload = DownloadsCommon.openDownload;
  const showDownloadedFile = DownloadsCommon.showDownloadedFile;
  DownloadsCommon.openDownload = download => opened.push(download);
  DownloadsCommon.showDownloadedFile = file => revealed.push(file);
  registerCleanupFunction(() => {
    DownloadsCommon.openDownload = openDownload;
    DownloadsCommon.showDownloadedFile = showDownloadedFile;
  });

  Library.toggle("downloads");
  let section;
  await TestUtils.waitForCondition(() => {
    section = document.querySelector("zen-library-downloads-section");
    return section?.querySelector(".zen-library-empty, .zen-library-row");
  }, "the downloads section has loaded");

  const download = finishedDownload("click-me.pdf");
  section.onDownloadAdded(download);
  await section.updateComplete;

  const row = rowFor(section, "click-me.pdf");
  Assert.ok(row, "the download has a row");

  row.click();
  await section.updateComplete;
  Assert.deepEqual(
    opened,
    [download],
    "clicking the row opens the file, the way the widget and Firefox do"
  );
  Assert.deepEqual(
    revealed,
    [],
    "and does not hand the folder to the file manager instead"
  );
  // The folder has a button of its own, next to the row.
  const show = row.querySelector(
    `.zen-library-row-actions [data-l10n-id="library-downloads-show-button"]`
  );
  Assert.ok(show, "the row offers to show the file in its folder");
  show.click();
  await section.updateComplete;
  Assert.equal(revealed.length, 1, "that button is what reaches the folder");
  Assert.equal(opened.length, 1, "and it does not open the file as well");

  Library.toggle();
  await TestUtils.waitForCondition(
    () => !Library.isLibraryOpen && Library.libraryProgress === 0,
    "the library settles closed"
  );
  await SpecialPowers.popPrefEnv();
});
