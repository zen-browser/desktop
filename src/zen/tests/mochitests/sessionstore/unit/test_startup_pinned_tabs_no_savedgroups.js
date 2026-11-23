/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/*
 * Bug 2083187: session files written by Firefox 132 and earlier have no
 * savedGroups property. SessionStartup's idle callback that records the
 * pinned-tab count must not throw on such a file, so that
 * browser.engagement.max_concurrent_tab_pinned_count is still recorded.
 */

"use strict";

do_get_profile();

const { SessionFile } = ChromeUtils.importESModule(
  "moz-src:///browser/components/sessionstore/SessionFile.sys.mjs"
);

// One window with a single pinned tab, and no savedGroups property.
const LEGACY_SESSION = JSON.stringify({
  version: ["sessionrestore", 1],
  windows: [
    {
      tabs: [{ entries: [{ url: "about:blank" }], pinned: true }],
      selected: 1,
    },
  ],
});

add_task(async function test_pinned_tab_count_without_savedGroups() {
  Services.fog.testResetFOG();

  await IOUtils.writeUTF8(SessionFile.Paths.clean, LEGACY_SESSION, {
    compress: true,
  });

  await new Promise(resolve => afterSessionStartupInitialization(resolve));

  // SessionStartup records the count from an idle dispatch; queue one behind
  // it so the assertion runs after that callback.
  await new Promise(resolve => Services.tm.idleDispatchToMainThread(resolve));

  Assert.equal(
    Glean.browserEngagement.maxConcurrentTabPinnedCount.testGetValue(),
    1,
    "one pinned tab was counted from a session file without savedGroups"
  );
});
