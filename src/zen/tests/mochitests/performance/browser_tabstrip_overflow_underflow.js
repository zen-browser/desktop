"use strict";

/**
 * WHOA THERE: We should never be adding new things to EXPECTED_*_REFLOWS.
 * This is a (now empty) list of known reflows.
 * Instead of adding more reflows to the lists, you should be modifying your
 * code to avoid the reflow.
 *
 * See https://firefox-source-docs.mozilla.org/performance/bestpractices.html
 * for tips on how to do that.
 */
const EXPECTED_OVERFLOW_REFLOWS = [
  /**
   * Nothing here! Please don't add anything new!
   */
];

const EXPECTED_UNDERFLOW_REFLOWS = [
  /**
   * Nothing here! Please don't add anything new!
   */
];

/**
 * This test ensures that there are no unexpected uninterruptible reflows when
 * opening a new tab that will cause the existing tabs to overflow and the tab
 * strip to become scrollable. It also tests that there are no unexpected
 * uninterruptible reflows when closing that tab, which causes the tab strip to
 * underflow.
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

  const TAB_COUNT_FOR_OVERFLOW = computeMaxTabCount();

  await createTabs(TAB_COUNT_FOR_OVERFLOW);

  gURLBar.focus();

  let tabStripRect =
    gBrowser.tabContainer.arrowScrollbox.getBoundingClientRect();
  let textBoxRect = gURLBar
    .querySelector(".urlbar-input-box")
    .getBoundingClientRect();

  let ignoreTabstripRects = {
    filter: rects =>
      rects.filter(
        r =>
          !(
            // We expect plenty of changed rects within the tab strip.
            (
              r.y1 >= tabStripRect.top &&
              r.y2 <= tabStripRect.bottom &&
              r.x1 >= tabStripRect.left &&
              r.x2 <= tabStripRect.right
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
      {
        name: "bug 1446449 - spurious tab switch spinner",
        condition: r =>
          // In the content area
          r.y1 >=
          document.getElementById("tabbrowser-tabbox").getBoundingClientRect()
            .top,
      },
    ],
  };

  await withPerfObserver(
    async function () {
      let switchDone = BrowserTestUtils.waitForEvent(window, "TabSwitchDone");
      BrowserCommands.openTab();
      await BrowserTestUtils.waitForEvent(
        gBrowser.selectedTab,
        "TabAnimationEnd"
      );
      await switchDone;
      await TestUtils.waitForCondition(() => {
        return gBrowser.tabContainer.arrowScrollbox.hasAttribute(
          "scrolledtoend"
        );
      });
    },
    { expectedReflows: EXPECTED_OVERFLOW_REFLOWS, frames: ignoreTabstripRects }
  );

  Assert.ok(
    gBrowser.tabContainer.overflowing,
    "Tabs should now be overflowed."
  );

  // Now test that opening and closing a tab while overflowed doesn't cause
  // us to reflow.
  await withPerfObserver(
    async function () {
      let switchDone = BrowserTestUtils.waitForEvent(window, "TabSwitchDone");
      BrowserCommands.openTab();
      await switchDone;
      await TestUtils.waitForCondition(() => {
        return gBrowser.tabContainer.arrowScrollbox.hasAttribute(
          "scrolledtoend"
        );
      });
    },
    { expectedReflows: [], frames: ignoreTabstripRects }
  );

  await withPerfObserver(
    async function () {
      let switchDone = BrowserTestUtils.waitForEvent(window, "TabSwitchDone");
      BrowserTestUtils.removeTab(gBrowser.selectedTab, { animate: true });
      await switchDone;
    },
    { expectedReflows: [], frames: ignoreTabstripRects }
  );

  // At this point, we have an overflowed tab strip, and we've got the last tab
  // selected. This should mean that the first tab is scrolled out of view.
  // Let's test that we don't reflow when switching to that first tab.
  let lastTab = gBrowser.selectedTab;
  let arrowScrollbox = gBrowser.tabContainer.arrowScrollbox;

  // First, we'll check that the first tab is actually scrolled
  // at least partially out of view.
  Assert.greater(
    arrowScrollbox.scrollPosition,
    0,
    "First tab should be partially scrolled out of view."
  );

  // Now switch to the first tab. We shouldn't flush layout at all.
  await withPerfObserver(
    async function () {
      let firstTab = gBrowser.tabs[0];
      await BrowserTestUtils.switchTab(gBrowser, firstTab);
      await TestUtils.waitForCondition(() => {
        return gBrowser.tabContainer.arrowScrollbox.hasAttribute(
          "scrolledtostart"
        );
      });
    },
    { expectedReflows: [], frames: ignoreTabstripRects }
  );

  // Okay, now close the last tab. The tabstrip should stay overflowed, but removing
  // one more after that should underflow it.
  BrowserTestUtils.removeTab(lastTab);

  Assert.ok(
    gBrowser.tabContainer.overflowing,
    "Tabs should still be overflowed."
  );

  // Depending on the size of the window, it might take one or more tab
  // removals to put the tab strip out of the overflow state, so we'll just
  // keep testing removals until that occurs.
  while (gBrowser.tabContainer.overflowing) {
    lastTab = gBrowser.tabs.at(-1);
    if (gBrowser.selectedTab !== lastTab) {
      await BrowserTestUtils.switchTab(gBrowser, lastTab);
    }

    // ... and make sure we don't flush layout when closing it, and exiting
    // the overflowed state.
    await withPerfObserver(
      async function () {
        let switchDone = BrowserTestUtils.waitForEvent(window, "TabSwitchDone");
        BrowserTestUtils.removeTab(lastTab, { animate: true });
        await switchDone;
        await TestUtils.waitForCondition(() => !lastTab.isConnected);
      },
      {
        expectedReflows: EXPECTED_UNDERFLOW_REFLOWS,
        frames: ignoreTabstripRects,
      }
    );
  }

  await removeAllButFirstTab();
});
