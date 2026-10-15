"use strict";

add_setup(async function () {
  await SpecialPowers.pushPrefEnv({
    set: [
      // Disable the window active/inactive transitions so the closing
      // window's activation change doesn't register as flicker.
      ["ui.prefersReducedMotion", 1],
    ],
  });
});

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

/**
 * This test ensures that there are no unexpected
 * uninterruptible reflows when closing windows. When the
 * window is closed, the test waits until the original window
 * has activated.
 */
add_task(async function () {
  // Ensure that this browser window starts focused. This seems to be
  // necessary to avoid intermittent failures when running this test
  // on repeat.
  await new Promise(resolve => {
    waitForFocus(resolve, window);
  });

  let win = await BrowserTestUtils.openNewBrowserWindow();
  await new Promise(resolve => {
    waitForFocus(resolve, win);
  });

  // At the time of writing, there are no reflows on window closing.
  // Mochitest will fail if we have no assertions, so we add one here
  // to make sure nobody adds any new ones.
  Assert.equal(
    EXPECTED_REFLOWS.length,
    0,
    "We shouldn't have added any new expected reflows for window close."
  );

  let inRange = (val, min, max) => min <= val && val <= max;
  let tabRect = win.gBrowser.tabContainer
    .querySelector("tab[selected] .tab-background")
    .getBoundingClientRect();
  await withPerfObserver(
    async function () {
      let promiseOrigBrowserFocused = TestUtils.waitForCondition(() => {
        return Services.focus.activeWindow == window;
      });
      await BrowserTestUtils.closeWindow(win);
      await promiseOrigBrowserFocused;
    },
    {
      expectedReflows: EXPECTED_REFLOWS,
      frames: {
        filter(rects, frame) {
          // Ignore the focus-out animation.
          if (isLikelyFocusChange(rects, frame)) {
            return [];
          }
          return rects;
        },
        exceptions: [
          {
            name: "Shadow around active tab should not flicker on macOS (bug 1960967)",
            condition(r) {
              return (
                AppConstants.platform == "macosx" &&
                inRange(r.x1, tabRect.x - 2, tabRect.x + 2) &&
                inRange(r.y1, tabRect.y - 2, tabRect.y + 2) &&
                inRange(r.w, tabRect.width - 4, tabRect.width + 4) &&
                inRange(r.h, tabRect.height - 4, tabRect.height + 4)
              );
            },
          },
        ],
      },
    },
    win
  );
});
