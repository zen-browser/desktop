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

/*
 * This test ensures that there are no unexpected
 * uninterruptible reflows when opening new tabs.
 */
add_task(async function () {
  // Force-enable tab animations
  gReduceMotionOverride = false;

  // TODO (bug 1702653): Disable tab shadows for tests since the shadow
  // can extend outside of the boundingClientRect. The tabRect will need
  // to grow to include the shadow size.
  gBrowser.tabContainer.setAttribute("noshadowfortests", "true");

  await ensureNoPreloadedBrowser();
  await disableFxaBadge();
  await ensureSearchIconVisible();

  // The test starts on about:blank and opens an about:blank
  // tab which triggers opening the toolbar since
  // ensureNoPreloadedBrowser sets AboutNewTab.newTabURL to about:blank.
  await SpecialPowers.pushPrefEnv({
    set: [["browser.toolbars.bookmarks.visibility", "never"]],
  });

  // Prepare the window to avoid flicker and reflow that's unrelated to our
  // tab opening operation.
  gURLBar.focus();

  let tabStripRect =
    gBrowser.tabContainer.arrowScrollbox.getBoundingClientRect();
  let firstTabRect = gBrowser.selectedTab.getBoundingClientRect();
  let tabPaddingStart = parseFloat(
    getComputedStyle(gBrowser.selectedTab).paddingInlineStart
  );
  let minTabWidth = firstTabRect.width - 2 * tabPaddingStart;
  let maxTabWidth = firstTabRect.width;
  let firstTabLabelRect =
    gBrowser.selectedTab.textLabel.getBoundingClientRect();
  let newTabButtonRect = document
    .getElementById("tabs-newtab-button")
    .getBoundingClientRect();
  let textBoxRect = gURLBar
    .querySelector(".urlbar-input-box")
    .getBoundingClientRect();

  let inRange = (val, min, max) => min <= val && val <= max;

  info(`tabStripRect=${JSON.stringify(tabStripRect)}`);
  info(`firstTabRect=${JSON.stringify(firstTabRect)}`);
  info(`tabPaddingStart=${JSON.stringify(tabPaddingStart)}`);
  info(`firstTabLabelRect=${JSON.stringify(firstTabLabelRect)}`);
  info(`newTabButtonRect=${JSON.stringify(newTabButtonRect)}`);
  info(`textBoxRect=${JSON.stringify(textBoxRect)}`);

  let inTabStrip = function (r) {
    return (
      r.y1 >= tabStripRect.top &&
      r.y2 <= tabStripRect.bottom &&
      r.x1 >= tabStripRect.left &&
      r.x2 <= tabStripRect.right
    );
  };

  const kTabCloseIconWidth = 13;

  // The '+' button uses a different glyph under nova which paints 1px
  // shorter than the proton one.
  const kNewTabIconHeight = Services.prefs.getBoolPref(
    "browser.nova.enabled",
    false
  )
    ? 12
    : 13;

  let isExpectedChange = function (r) {
    // We expect all changes to be within the tab strip.
    if (!inTabStrip(r)) {
      return false;
    }

    // The first tab should get deselected at the same time as the next tab
    // starts appearing, so we should have one rect that includes the first tab
    // but is wider.
    if (
      inRange(r.w, minTabWidth, maxTabWidth * 2) &&
      inRange(r.x1, firstTabRect.x, firstTabRect.x + tabPaddingStart)
    ) {
      return true;
    }

    // The second tab gets painted several times due to tabopen animation.
    let isSecondTabRect =
      inRange(
        r.x1,
        // When the animation starts the tab close icon overflows.
        // -1 for the border on Win7
        firstTabRect.right - kTabCloseIconWidth - 1,
        firstTabRect.right + firstTabRect.width
      ) &&
      r.x2 <
        firstTabRect.right +
          firstTabRect.width +
          // Sometimes the '+' is in the same rect.
          newTabButtonRect.width;

    if (isSecondTabRect) {
      return true;
    }
    // The '+' icon moves with an animation. At the end of the animation
    // the former and new positions can touch each other causing the rect
    // to have twice the icon's width.
    if (
      r.h == kNewTabIconHeight &&
      r.w <= 2 * kNewTabIconHeight + kMaxEmptyPixels
    ) {
      return true;
    }

    // We sometimes have a rect for the right most 2px of the '+' button.
    if (r.h == 2 && r.w == 2) {
      return true;
    }

    // Same for the 'X' icon.
    if (r.h == 10 && r.w <= 2 * 10) {
      return true;
    }

    // Other changes are unexpected.
    return false;
  };

  // Add a reflow observer and open a new tab.
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
        filter: rects => rects.filter(r => !isExpectedChange(r)),
        exceptions: [
          {
            name:
              "bug 1446452 - the new tab should appear at the same time as the" +
              " previous one gets deselected",
            condition: r =>
              // In tab strip
              r.y1 >= tabStripRect.top &&
              r.y2 <= tabStripRect.bottom &&
              // Position and size of the first tab.
              r.x1 == firstTabRect.left &&
              inRange(
                r.w,
                firstTabRect.width - 1, // -1 as the border doesn't change
                firstTabRect.width
              ),
          },
          {
            name: "the urlbar placeolder moves up and down by a few pixels",
            // This seems to only happen on the second run in --verify
            condition: r =>
              r.x1 >= textBoxRect.left &&
              r.x2 <= textBoxRect.right &&
              r.y1 >= textBoxRect.top &&
              r.y2 <= textBoxRect.bottom,
          },
          {
            name: "bug 1477966 - the name of a deselected tab should appear immediately",
            condition: r =>
              AppConstants.platform == "macosx" &&
              r.x1 >= firstTabLabelRect.x &&
              r.x2 <= firstTabLabelRect.right &&
              r.y1 >= firstTabLabelRect.y &&
              r.y2 <= firstTabLabelRect.bottom,
          },
        ],
      },
    }
  );

  let switchDone = BrowserTestUtils.waitForEvent(window, "TabSwitchDone");
  BrowserTestUtils.removeTab(gBrowser.selectedTab);
  await switchDone;
});
