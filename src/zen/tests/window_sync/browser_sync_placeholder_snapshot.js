/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// When a page moves to another window, the window it leaves shows a snapshot
// of it as a placeholder. The placeholder's blob URL must not keep that
// snapshot alive on its own, or the snapshot of every tab closed meanwhile
// stays in memory until its window closes.

add_task(async function test_placeholder_does_not_pin_its_snapshot() {
  await withNewTabAndWindow(async (newTab, win) => {
    // Show the page here first, so there is something to capture once it
    // moves to the other window.
    gBrowser.selectedTab = newTab;
    await TestUtils.waitForCondition(
      () =>
        newTab.linkedBrowser.currentURI.spec === "https://example.com/" &&
        !newTab.hasAttribute("busy"),
      "The page should load in this window"
    );

    const otherTab = gZenWindowSync.getItemFromWindow(win, newTab.id);
    await SimpleTest.promiseFocus(win);
    win.gBrowser.selectedTab = otherTab;

    const placeholder = await TestUtils.waitForCondition(
      () =>
        newTab.linkedBrowser.parentNode.querySelector(
          ".zen-pseudo-browser-image"
        ),
      "Moving the page away should leave a placeholder in this window"
    );
    Assert.ok(otherTab._zenContentsVisible, "The page should have moved");
    Assert.greater(
      placeholder.naturalWidth,
      0,
      "The placeholder should still show the snapshot"
    );
    await Assert.rejects(
      fetch(placeholder.src),
      /NetworkError/,
      "The placeholder's blob URL should already be revoked"
    );
  });
});
