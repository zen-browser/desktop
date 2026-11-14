/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// Before a page moves to another window, the window it leaves captures it for
// a placeholder. If that capture fails (e.g. the page is switching processes),
// the page must still move, and later moves must keep working.

ChromeUtils.defineESModuleGetters(this, {
  sinon: "resource://testing-common/Sinon.sys.mjs",
});

const PAGE = "https://example.com/";

function pageIsIn(tab, otherTab) {
  return (
    tab.linkedBrowser.currentURI.spec === PAGE &&
    otherTab.linkedBrowser.currentURI.spec !== PAGE
  );
}

add_task(async function test_failed_snapshot_does_not_block_swaps() {
  await withNewTabAndWindow(async (newTab, win) => {
    gBrowser.selectedTab = newTab;
    await TestUtils.waitForCondition(
      () =>
        newTab.linkedBrowser.currentURI.spec === PAGE &&
        !newTab.hasAttribute("busy"),
      "The page should load in this window"
    );
    const otherTab = gZenWindowSync.getItemFromWindow(win, newTab.id);

    const sandbox = sinon.createSandbox();
    sandbox
      .stub(newTab.linkedBrowser, "drawSnapshot")
      .rejects(new Error("Snapshot failed"));
    try {
      await SimpleTest.promiseFocus(win);
      win.gBrowser.selectedTab = otherTab;
      await TestUtils.waitForCondition(
        () => pageIsIn(otherTab, newTab),
        "The page should move to the other window without a placeholder"
      );
    } finally {
      sandbox.restore();
    }

    // Focusing this window again brings the page back, which only works if
    // the failed capture didn't leave the swap queue stuck.
    await SimpleTest.promiseFocus(window);
    await TestUtils.waitForCondition(
      () => pageIsIn(newTab, otherTab),
      "The page should move back to this window"
    );
    Assert.ok(
      newTab._zenContentsVisible,
      "This window should show the page again"
    );
  });
});
