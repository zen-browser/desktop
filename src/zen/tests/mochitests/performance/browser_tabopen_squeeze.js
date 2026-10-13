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

/*
 * This test ensures that there are no unexpected
 * uninterruptible reflows when opening a new tab that will
 * cause the existing tabs to squeeze smaller.
 */
add_task(async function () {
  // Force-enable tab animations
  gReduceMotionOverride = false;

  await ensureNoPreloadedBrowser();
  await disableFxaBadge();
  await ensureSearchIconVisible();

  // The test starts on about:blank and opens an about:blank
  // tab which triggers opening the toolbar since
  // ensureNoPreloadedBrowser sets AboutNewTab.newTabURL to about:blank.
  // Disable tab hover previews to avoid asynchronous reflows. On Windows when
  // running standalone, mouse events on tabs during creation can trigger hover
  // preview activation, causing a reflow during the performance measurement.
  await SpecialPowers.pushPrefEnv({
    set: [
      ["browser.toolbars.bookmarks.visibility", "never"],
      ["browser.tabs.hoverPreview.enabled", false],
    ],
  });

  // Compute the number of tabs we can put into the strip without
  // overflowing, and remove one, so that we can create
  // TAB_COUNT_FOR_SQUEEE tabs, and then one more, which should
  // cause the tab to squeeze to a smaller size rather than overflow.
  const TAB_COUNT_FOR_SQUEEZE = computeMaxTabCount() - 1;

  await createTabs(TAB_COUNT_FOR_SQUEEZE);

  gURLBar.focus();

  let tabStripRect =
    gBrowser.tabContainer.arrowScrollbox.getBoundingClientRect();
  let textBoxRect = gURLBar
    .querySelector(".urlbar-input-box")
    .getBoundingClientRect();

  await withPerfObserver(
    async function () {
      let switchDone = BrowserTestUtils.waitForEvent(window, "TabSwitchDone");
      BrowserCommands.openTab();
      await BrowserTestUtils.waitForEvent(
        gBrowser.selectedTab,
        "TabAnimationEnd"
      );
      await switchDone;
    },
    {
      expectedReflows: EXPECTED_REFLOWS,
      frames: {
        filter: rects =>
          rects.filter(
            r =>
              !(
                // We expect plenty of changed rects within the tab strip.
                (
                  r.y1 >= tabStripRect.top &&
                  r.y2 <= tabStripRect.bottom &&
                  r.x1 >= tabStripRect.left &&
                  r.x2 <= tabStripRect.right &&
                  // It would make sense for each rect to have a width smaller than
                  // a tab (ie. tabstrip.width / tabcount), but tabs are small enough
                  // that they sometimes get reported in the same rect.
                  // So we accept up to the width of n-1 tabs.
                  r.w <=
                    (gBrowser.tabs.length - 1) *
                      Math.ceil(tabStripRect.width / gBrowser.tabs.length)
                )
              )
          ),
        exceptions: [
          {
            name: "the urlbar placeolder moves up and down by a few pixels",
            condition: r =>
              r.x1 >= textBoxRect.left &&
              r.x2 <= textBoxRect.right &&
              r.y1 >= textBoxRect.top &&
              r.y2 <= textBoxRect.bottom,
          },
        ],
      },
    }
  );

  await removeAllButFirstTab();
});
