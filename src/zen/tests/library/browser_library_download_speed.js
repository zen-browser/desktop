/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

ChromeUtils.defineESModuleGetters(this, {
  Downloads: "resource://gre/modules/Downloads.sys.mjs",
});

const MB = 1024 * 1024;

function fakeDownload(name, props = {}) {
  const tmp = Services.dirsvc.get("TmpD", Ci.nsIFile).path;
  return Object.assign(
    {
      source: { url: `https://example.com/${name}` },
      target: { path: PathUtils.join(tmp, name), exists: true },
      stopped: false,
      succeeded: false,
      canceled: false,
      deleted: false,
      hasPartialData: false,
      hasProgress: true,
      progress: 0,
      currentBytes: 0,
      totalBytes: 0,
      speed: 0,
      error: null,
      endTime: Date.now(),
      launchWhenSucceeded: false,
      refresh: async () => {},
    },
    props
  );
}

function statusOf(section, name) {
  for (const row of section.querySelectorAll(".zen-library-row")) {
    if (row.querySelector(".zen-library-row-title").textContent === name) {
      return row.querySelector(".zen-library-download-status").textContent;
    }
  }
  return null;
}

add_task(async function test_downloads_rows_show_speed() {
  await SpecialPowers.pushPrefEnv({ set: [["zen.library.enabled", true]] });

  const Library = customElements.get("zen-library");
  Library.toggle("downloads");
  let section;
  await TestUtils.waitForCondition(() => {
    section = document.querySelector("zen-library-downloads-section");
    // The list is empty until the downloads have loaded.
    return section?.querySelector(".zen-library-empty, .zen-library-row");
  }, "the downloads section has loaded");

  section.onDownloadAdded(
    fakeDownload("fast.iso", {
      currentBytes: 156 * MB,
      totalBytes: 1024 * MB,
      progress: 15,
      speed: 3 * MB,
    })
  );
  section.onDownloadAdded(
    fakeDownload("no-total.zip", {
      hasProgress: false,
      currentBytes: 12 * MB,
      speed: 2 * MB,
    })
  );
  section.onDownloadAdded(
    fakeDownload("paused.mkv", {
      stopped: true,
      canceled: true,
      hasPartialData: true,
      currentBytes: 40 * MB,
      totalBytes: 90 * MB,
      progress: 44,
      // Left over from before it was paused, which must not show.
      speed: 1 * MB,
    })
  );
  section.onDownloadAdded(
    fakeDownload("starting.bin", {
      currentBytes: 1 * MB,
      totalBytes: 90 * MB,
      progress: 1,
      speed: 0,
    })
  );
  section.onDownloadAdded(
    fakeDownload("slow.bin", {
      currentBytes: 3 * MB,
      totalBytes: 40 * MB,
      progress: 7,
      speed: 250 * 1024,
    })
  );
  await TestUtils.waitForCondition(
    () => statusOf(section, "starting.bin"),
    "the rows are drawn"
  );

  const fast = statusOf(section, "fast.iso");
  ok(fast.includes("156 MB"), `progress is shown: ${fast}`);
  ok(
    /\b3(?:\.0)? MB\/s\b/.test(fast),
    `the speed is shown next to it: ${fast}`
  );

  const noTotal = statusOf(section, "no-total.zip");
  ok(
    /\b2(?:\.0)? MB\/s\b/.test(noTotal),
    `speed shows without a total: ${noTotal}`
  );

  ok(
    !statusOf(section, "paused.mkv").includes("/s"),
    "a paused download shows no speed"
  );
  ok(
    !statusOf(section, "starting.bin").includes("/s"),
    "no speed is shown before there is one"
  );

  const slow = statusOf(section, "slow.bin");
  ok(
    /\b250 KB\/s\b/.test(slow),
    `under a megabyte a second it is told in KB/s: ${slow}`
  );

  Library.toggle();
  await TestUtils.waitForCondition(
    () => !Library.isLibraryOpen && Library.libraryProgress === 0,
    "library closes"
  );
});

async function addDownload(list, name, props) {
  const download = await Downloads.createDownload({
    source: `https://example.com/${name}`,
    target: PathUtils.join(Services.dirsvc.get("TmpD", Ci.nsIFile).path, name),
  });
  Object.assign(download, props);
  await list.add(download);
  return download;
}

function buttonListStatusOf(name) {
  for (const entry of document.querySelectorAll(
    "#zen-library-download-list .zen-library-download-list-download"
  )) {
    const title = entry.querySelector(".zen-library-download-list-title");
    if (title.textContent === name) {
      return entry.querySelector(".zen-library-download-list-subtitle")
        .textContent;
    }
  }
  return null;
}

add_task(async function test_button_list_shows_speed() {
  const downloads = {
    "fast.iso": {
      stopped: false,
      hasProgress: true,
      currentBytes: 156 * MB,
      totalBytes: 1024 * MB,
      progress: 15,
      speed: 3 * MB,
    },
    "slow.bin": {
      stopped: false,
      hasProgress: true,
      currentBytes: 3 * MB,
      totalBytes: 40 * MB,
      progress: 7,
      speed: 250 * 1024,
    },
    "paused.mkv": {
      stopped: true,
      canceled: true,
      hasPartialData: true,
      hasProgress: true,
      currentBytes: 40 * MB,
      totalBytes: 90 * MB,
      progress: 44,
      // Left over from before it was paused, which must not show.
      speed: 1 * MB,
    },
    "starting.bin": {
      stopped: false,
      hasProgress: true,
      currentBytes: 1 * MB,
      totalBytes: 90 * MB,
      progress: 1,
      speed: 0,
    },
  };
  const list = await Downloads.getList(Downloads.PUBLIC);
  const added = [];
  try {
    for (const [name, props] of Object.entries(downloads)) {
      added.push(await addDownload(list, name, props));
    }
    await TestUtils.waitForCondition(
      () => buttonListStatusOf("starting.bin") !== null,
      "the list over the library button is drawn"
    );

    const fast = buttonListStatusOf("fast.iso");
    ok(fast.includes("156 MB"), `progress is shown: ${fast}`);
    ok(
      /\b3(?:\.0)? MB\/s\b/.test(fast),
      `the speed is shown next to it: ${fast}`
    );

    const slow = buttonListStatusOf("slow.bin");
    ok(
      /\b250 KB\/s\b/.test(slow),
      `under a megabyte a second it is told in KB/s: ${slow}`
    );

    ok(
      !buttonListStatusOf("paused.mkv").includes("/s"),
      "a paused download shows no speed"
    );
    ok(
      !buttonListStatusOf("starting.bin").includes("/s"),
      "no speed is shown before there is one"
    );
  } finally {
    for (const download of added) {
      await list.remove(download);
    }
  }
});
