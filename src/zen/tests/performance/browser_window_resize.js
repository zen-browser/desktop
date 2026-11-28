/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * WHOA THERE: We should never be adding new things to EXPECTED_REFLOWS.
 * Instead of adding reflows to the list, you should be modifying your code to
 * avoid the reflow.
 *
 * See https://firefox-source-docs.mozilla.org/performance/bestpractices.html
 * for tips on how to do that.
 */
const EXPECTED_REFLOWS = [
  /**
   * Nothing here! Please don't add anything new!
   */
];

const gToolbar = document.getElementById("PersonalToolbar");

/**
 * Sets the visibility state on the Bookmarks Toolbar, and
 * waits for it to transition to fully visible.
 *
 * @param visible (bool)
 *        Whether or not the bookmarks toolbar should be made visible.
 * @returns Promise
 */
async function toggleBookmarksToolbar(visible) {
  let transitionPromise = BrowserTestUtils.waitForEvent(
    gToolbar,
    "transitionend",
    e => e.propertyName == "max-height"
  );

  setToolbarVisibility(gToolbar, visible);
  await transitionPromise;
}

/**
 * Resizes a browser window to a particular width and height, and
 * waits for it to reach a "steady state" with respect to its overflowing
 * toolbars.
 *
 * @param win (browser window)
 *        The window to resize.
 * @param width (int)
 *        The width to resize the window to.
 * @param height (int)
 *        The height to resize the window to.
 * @returns Promise
 */
async function resizeWindow(win, width, height) {
  let toolbarEvent = BrowserTestUtils.waitForEvent(
    win,
    "BookmarksToolbarVisibilityUpdated"
  );
  let resizeEvent = BrowserTestUtils.waitForEvent(win, "resize");
  win.windowUtils.ensureDirtyRootFrame();
  win.resizeTo(width, height);
  await resizeEvent;
  await toolbarEvent;
}

/*
 * This test ensures that there are no unexpected
 * uninterruptible reflows when resizing windows.
 */
add_task(async function () {
  const BOOKMARKS_COUNT = 150;
  const STARTING_WIDTH = 600;
  const STARTING_HEIGHT = 400;
  const SMALL_WIDTH = 150;
  const SMALL_HEIGHT = 150;

  await PlacesUtils.bookmarks.eraseEverything();

  // Add a bunch of bookmarks to display in the Bookmarks toolbar
  await PlacesUtils.bookmarks.insertTree({
    guid: PlacesUtils.bookmarks.toolbarGuid,
    children: Array(BOOKMARKS_COUNT)
      .fill("")
      // eslint-disable-next-line sdl/no-insecure-url
      .map((_, i) => ({ url: `http://test.places.${i}.x/` })),
  });

  let wasCollapsed = gToolbar.collapsed;
  Assert.ok(wasCollapsed, "The toolbar is collapsed by default");
  if (wasCollapsed) {
    let promiseReady = BrowserTestUtils.waitForEvent(
      gToolbar,
      "BookmarksToolbarVisibilityUpdated"
    );
    await toggleBookmarksToolbar(true);
    await promiseReady;
  }

  registerCleanupFunction(async () => {
    if (wasCollapsed) {
      await toggleBookmarksToolbar(false);
    }
    await PlacesUtils.bookmarks.eraseEverything();
    await PlacesUtils.history.clear();
  });

  let win = await prepareSettledWindow();

  if (
    win.screen.availWidth < STARTING_WIDTH ||
    win.screen.availHeight < STARTING_HEIGHT
  ) {
    Assert.ok(
      false,
      "This test is running on too small a display - " +
        `(${STARTING_WIDTH}x${STARTING_HEIGHT} min)`
    );
    return;
  }

  await resizeWindow(win, STARTING_WIDTH, STARTING_HEIGHT);

  await withPerfObserver(
    async function () {
      await resizeWindow(win, SMALL_WIDTH, SMALL_HEIGHT);
      await resizeWindow(win, STARTING_WIDTH, STARTING_HEIGHT);
    },
    { expectedReflows: EXPECTED_REFLOWS, frames: { filter: () => [] } },
    win
  );

  await BrowserTestUtils.closeWindow(win);
});
