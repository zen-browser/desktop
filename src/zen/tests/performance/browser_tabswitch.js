/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * WHOA THERE: We should never be adding new things to EXPECTED_REFLOWS.
 * Instead of adding reflows to the list, you should be modifying your code to
 * avoid the reflow.
 *
 * See  https://firefox-source-docs.mozilla.org/performance/bestpractices.html
 * for tips on how to do that.
 */
const EXPECTED_REFLOWS = [
  /**
   * Nothing here! Please don't add anything new!
   */
];

/*
 * This test ensures that there are no unexpected
 * uninterruptible reflows when switching between two
 * tabs that are both fully visible.
 */
add_task(async function () {
  // TODO (bug 1702653): Disable tab shadows for tests since the shadow
  // can extend outside of the boundingClientRect. The tabRect will need
  // to grow to include the shadow size.
  gBrowser.tabContainer.setAttribute("noshadowfortests", "true");

  await ensureNoPreloadedBrowser();
  await disableFxaBadge();

  // The test starts on about:blank and opens an about:blank
  // tab which triggers opening the toolbar since
  // ensureNoPreloadedBrowser sets AboutNewTab.newTabURL to about:blank.
  await SpecialPowers.pushPrefEnv({
    set: [["browser.toolbars.bookmarks.visibility", "never"]],
  });

  // At the time of writing, there are no reflows on simple tab switching.
  // Mochitest will fail if we have no assertions, so we add one here
  // to make sure nobody adds any new ones.
  Assert.equal(
    EXPECTED_REFLOWS.length,
    0,
    "We shouldn't have added any new expected reflows."
  );

  let origTab = gBrowser.selectedTab;
  let firstSwitchDone = BrowserTestUtils.waitForEvent(window, "TabSwitchDone");
  let otherTab = await BrowserTestUtils.openNewForegroundTab(gBrowser);
  await firstSwitchDone;

  let tabStripRect =
    gBrowser.tabContainer.arrowScrollbox.getBoundingClientRect();
  let firstTabRect = origTab.getBoundingClientRect();
  let tabPaddingStart = parseFloat(
    getComputedStyle(gBrowser.selectedTab).paddingInlineStart
  );
  let minTabWidth = firstTabRect.width - 2 * tabPaddingStart;
  if (AppConstants.platform == "macosx") {
    // On macOS, after bug 1886729, gecko screenshots like the ones for this
    // test can't screenshot the native titlebar. That, plus the fact that
    // there's no border or shadow (see bug 1702653) means that we only end up
    // with the tab text color changing, which is smaller than the tab
    // background size.
    minTabWidth = 0;
  }
  let maxTabWidth = firstTabRect.width;
  let inRange = (val, min, max) => min <= val && val <= max;

  await withPerfObserver(
    async function () {
      let switchDone = BrowserTestUtils.waitForEvent(window, "TabSwitchDone");
      gBrowser.selectedTab = origTab;
      await switchDone;
    },
    {
      expectedReflows: EXPECTED_REFLOWS,
      frames: {
        filter: rects =>
          rects.filter(
            r =>
              !(
                // We expect all changes to be within the tab strip.
                (
                  r.y1 >= tabStripRect.top &&
                  r.y2 <= tabStripRect.bottom &&
                  r.x1 >= tabStripRect.left &&
                  r.x2 <= tabStripRect.right &&
                  // The tab selection changes between 2 adjacent tabs, so we expect
                  // both to change color at once: this should be a single rect of the
                  // width of 2 tabs.
                  inRange(r.w, minTabWidth, maxTabWidth * 2)
                )
              )
          ),
        exceptions: [
          {
            name:
              "bug 1446454 - the border between tabs should be painted at" +
              " the same time as the tab switch",
            condition: r =>
              // In tab strip
              r.y1 >= tabStripRect.top &&
              r.y2 <= tabStripRect.bottom &&
              // 1px border, 1px before the end of the first tab.
              r.w == 1 &&
              r.x1 == firstTabRect.right - 1,
          },
          {
            name: "bug 1446449 - spurious tab switch spinner",
            condition: r =>
              AppConstants.DEBUG &&
              // In the content area
              r.y1 >=
                document
                  .getElementById("tabbrowser-tabbox")
                  .getBoundingClientRect().top,
          },
        ],
      },
    }
  );

  BrowserTestUtils.removeTab(otherTab);
});
