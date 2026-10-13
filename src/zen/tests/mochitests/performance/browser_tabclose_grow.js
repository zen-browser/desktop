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
 * uninterruptible reflows when closing a tab that will
 * cause the existing tabs to grow bigger.
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

  // At the time of writing, there are no reflows on tab closing with
  // tab growth. Mochitest will fail if we have no assertions, so we
  // add one here to make sure nobody adds any new ones.
  Assert.equal(
    EXPECTED_REFLOWS.length,
    0,
    "We shouldn't have added any new expected reflows."
  );

  // Compute the number of tabs we can put into the strip without
  // overflowing. If we remove one of the tabs, we know that the
  // remaining tabs will grow to fill the remaining space in the
  // tabstrip.
  const TAB_COUNT_FOR_GROWTH = computeMaxTabCount();
  await createTabs(TAB_COUNT_FOR_GROWTH);

  let lastTab = gBrowser.tabs[gBrowser.tabs.length - 1];
  await BrowserTestUtils.switchTab(gBrowser, lastTab);

  let tabStripRect =
    gBrowser.tabContainer.arrowScrollbox.getBoundingClientRect();

  function isInTabStrip(r) {
    return (
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
    );
  }

  await withPerfObserver(
    async function () {
      let switchDone = BrowserTestUtils.waitForEvent(window, "TabSwitchDone");
      let tab = gBrowser.tabs[gBrowser.tabs.length - 1];
      gBrowser.removeTab(tab, { animate: true });
      await BrowserTestUtils.waitForEvent(tab, "TabAnimationEnd");
      await switchDone;
    },
    {
      expectedReflows: EXPECTED_REFLOWS,
      frames: {
        filter: rects => rects.filter(r => !isInTabStrip(r)),
      },
    }
  );

  await removeAllButFirstTab();
});
