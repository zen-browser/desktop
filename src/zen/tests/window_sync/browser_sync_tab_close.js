/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { TabStateFlusher } = ChromeUtils.importESModule(
  "resource:///modules/sessionstore/TabStateFlusher.sys.mjs"
);

// Closing a synced tab removes its mirror copies in all other windows. Those
// propagated closes must not be recorded by the session store, otherwise
// undo close tab (ctrl+shift+t) restores the mirror copy (often blank or
// stale) instead of the tab the user actually closed.
add_task(async function test_SyncCloseDoesNotRecordMirrorTabs() {
  await withNewSyncedWindow(async win => {
    let newTab;
    await runSyncAction(
      () => {
        newTab = gBrowser.addTrustedTab("https://example.com/", {
          inBackground: true,
        });
      },
      async () => {},
      "TabOpen"
    );
    const syncId = newTab.id;
    const otherTab = gZenWindowSync.getItemFromWindow(win, syncId);
    Assert.ok(otherTab, "The opened tab should be found in the synced window");

    await BrowserTestUtils.browserLoaded(newTab.linkedBrowser);
    await TabStateFlusher.flush(newTab.linkedBrowser);

    // Simulate the mirror tab ending up with restorable-looking state, like
    // a stale tab state cache can leave behind after docshell swaps.
    SessionStore.setTabState(
      otherTab,
      JSON.stringify({
        entries: [{ url: "https://example.com/", title: "Example" }],
        index: 1,
      })
    );

    const closedCountBefore = SessionStore.getClosedTabCountForWindow(window);
    const otherClosedCountBefore = SessionStore.getClosedTabCountForWindow(win);

    await runSyncAction(
      () => {
        gBrowser.removeTab(newTab);
      },
      async () => {},
      "TabClose"
    );
    await TestUtils.waitForCondition(
      () => !gZenWindowSync.getItemFromWindow(win, syncId),
      "Waiting for the synced tab to be closed in the other window"
    );

    Assert.equal(
      SessionStore.getClosedTabCountForWindow(window),
      closedCountBefore + 1,
      "Closing the tab should record one closed tab in its own window"
    );
    Assert.equal(
      SessionStore.getClosedTabCountForWindow(win),
      otherClosedCountBefore,
      "The sync-propagated close should not be recorded in the other window"
    );
  });
});

// When the user closes the inactive (blank) copy of a synced tab, the close
// propagated to the window holding the active contents must still be
// recorded, so undo close tab can restore the page.
add_task(async function test_SyncCloseRecordsActiveTab() {
  await withNewSyncedWindow(async win => {
    let newTab;
    await runSyncAction(
      () => {
        newTab = gBrowser.addTrustedTab("https://example.com/", {
          inBackground: true,
        });
      },
      async () => {},
      "TabOpen"
    );
    const syncId = newTab.id;
    const otherTab = gZenWindowSync.getItemFromWindow(win, syncId);
    Assert.ok(otherTab, "The opened tab should be found in the synced window");
    Assert.ok(
      newTab._zenContentsVisible,
      "The original tab should hold the contents"
    );

    await BrowserTestUtils.browserLoaded(newTab.linkedBrowser);
    await TabStateFlusher.flush(newTab.linkedBrowser);

    const closedCountBefore = SessionStore.getClosedTabCountForWindow(window);

    // Close the blank mirror copy; sync then closes the original tab.
    await runSyncAction(
      () => {
        win.gBrowser.removeTab(otherTab);
      },
      async () => {},
      "TabClose"
    );
    await TestUtils.waitForCondition(
      () => !gZenWindowSync.getItemFromWindow(window, syncId),
      "Waiting for the synced tab to be closed in the original window"
    );

    Assert.equal(
      SessionStore.getClosedTabCountForWindow(window),
      closedCountBefore + 1,
      "The window holding the active tab contents should record the close"
    );
  });
});
