/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { ZenSessionStore } = ChromeUtils.importESModule(
  "resource:///modules/zen/ZenSessionManager.sys.mjs"
);

const SYNC_ID = "zen-test-tab-14004";
const PAGE = "https://example.com/14004";

function windowWith(extras, url) {
  return {
    tabs: [
      {
        zenSyncId: SYNC_ID,
        index: 1,
        entries: [{ url, title: "A page" }],
        ...extras,
      },
    ],
  };
}

function collected() {
  return ZenSessionStore.getSidebarData().tabs.find(
    tab => tab.zenSyncId === SYNC_ID
  );
}

add_task(async function test_blankCopyNeverWins() {
  ZenSessionStore.saveState(
    {
      windows: [
        windowWith({ _zenIsActiveTab: true }, "about:blank"),
        windowWith({}, PAGE),
      ],
    },
    true
  );
  Assert.equal(
    collected()?.entries[0].url,
    PAGE,
    "The copy holding the page is kept over a blank one that claims to be active"
  );

  ZenSessionStore.saveState(
    {
      windows: [
        windowWith({}, PAGE),
        windowWith({ _zenIsActiveTab: true }, "about:blank"),
      ],
    },
    true
  );
  Assert.equal(
    collected()?.entries[0].url,
    PAGE,
    "The blank copy doesn't take over when it comes last either"
  );
});

add_task(async function test_activeCopyStillWins() {
  const other = "https://example.com/14004-stale";
  ZenSessionStore.saveState(
    {
      windows: [
        windowWith({}, other),
        windowWith({ _zenIsActiveTab: true }, PAGE),
      ],
    },
    true
  );
  Assert.equal(
    collected()?.entries[0].url,
    PAGE,
    "The copy the user is looking at is the one that counts"
  );
});
