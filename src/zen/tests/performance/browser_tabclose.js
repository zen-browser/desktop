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
 * uninterruptible reflows when closing new tabs.
 */
add_task(async function () {
  // Force-enable tab animations
  gReduceMotionOverride = false;

  await ensureNoPreloadedBrowser();
  await disableFxaBadge();

  // The test starts on about:blank and opens an about:blank
  // tab which triggers opening the toolbar since
  // ensureNoPreloadedBrowser sets AboutNewTab.newTabURL to about:blank.
  await SpecialPowers.pushPrefEnv({
    set: [["browser.toolbars.bookmarks.visibility", "never"]],
  });

  let tab = await BrowserTestUtils.openNewForegroundTab(gBrowser);
  await TestUtils.waitForCondition(() => tab._fullyOpen);

  let tabStripRect =
    gBrowser.tabContainer.arrowScrollbox.getBoundingClientRect();
  let newTabButtonRect =
    gBrowser.tabContainer.newTabButton.getBoundingClientRect();
  let inRange = (val, min, max) => min <= val && val <= max;

  // The '+' button uses a different glyph under nova which paints 1px
  // shorter than the proton one.
  const kNewTabIconHeight = Services.prefs.getBoolPref(
    "browser.nova.enabled",
    false
  )
    ? 12
    : 13;

  // Add a reflow observer and open a new tab.
  await withPerfObserver(
    async function () {
      let switchDone = BrowserTestUtils.waitForEvent(window, "TabSwitchDone");
      gBrowser.removeTab(tab, { animate: true });
      await BrowserTestUtils.waitForEvent(tab, "TabAnimationEnd");
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
                  // The closed tab should disappear at the same time as the previous
                  // tab gets selected, causing both tab areas to change color at once:
                  // this should be a single rect of the width of 2 tabs, and can
                  // include the '+' button if it starts its animation.
                  ((r.w > gBrowser.selectedTab.clientWidth &&
                    r.x2 <= newTabButtonRect.right) ||
                    // The '+' icon moves with an animation. At the end of the animation
                    // the former and new positions can touch each other causing the rect
                    // to have twice the icon's width.
                    (r.h == kNewTabIconHeight &&
                      r.w <= 2 * kNewTabIconHeight + kMaxEmptyPixels) ||
                    // We sometimes have a rect for the right most 2px of the '+' button.
                    (r.h == 2 && r.w == 2))
                )
              )
          ),
        exceptions: [
          {
            name:
              "bug 1444886 - the next tab should be selected at the same time" +
              " as the closed one disappears",
            condition: r =>
              // In tab strip
              r.y1 >= tabStripRect.top &&
              r.y2 <= tabStripRect.bottom &&
              r.x1 >= tabStripRect.left &&
              r.x2 <= tabStripRect.right &&
              // Width of one tab plus tab separator(s)
              inRange(gBrowser.selectedTab.clientWidth - r.w, 0, 2),
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
  is(EXPECTED_REFLOWS.length, 0, "No reflows are expected when closing a tab");
});
