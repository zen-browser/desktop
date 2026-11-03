"use strict";
/* global PanelUI */

const { CustomizableUITestUtils } = ChromeUtils.importESModule(
  "resource://testing-common/CustomizableUITestUtils.sys.mjs"
);
let gCUITestUtils = new CustomizableUITestUtils(window);

/**
 * WHOA THERE: We should never be adding new things to
 * EXPECTED_APPMENU_OPEN_REFLOWS. This list should slowly go
 * away as we improve the performance of the front-end. Instead of adding more
 * reflows to the list, you should be modifying your code to avoid the reflow.
 *
 * See https://firefox-source-docs.mozilla.org/performance/bestpractices.html
 * for tips on how to do that.
 */
const EXPECTED_APPMENU_OPEN_REFLOWS = [
  {
    stack: [
      "openPopup/this._openPopupPromise<@moz-src:///browser/components/customizableui/PanelMultiView.sys.mjs",
    ],
  },
];

add_task(async function () {
  await ensureNoPreloadedBrowser();
  await ensureAnimationsFinished();
  await disableFxaBadge();
  await ensureSearchIconVisible();

  let textBoxRect = gURLBar
    .querySelector(".urlbar-input-box")
    .getBoundingClientRect();
  let menuButtonRect = document
    .getElementById("PanelUI-menu-button")
    .getBoundingClientRect();
  let firstTabRect = gBrowser.selectedTab.getBoundingClientRect();
  let frameExpectations = {
    filter: rects => {
      // We expect the menu button to get into the active state.
      //
      // XXX For some reason the menu panel isn't in our screenshots, but
      // that's where we actually expect many changes.
      return rects.filter(r => !rectInBoundingClientRect(r, menuButtonRect));
    },
    exceptions: [
      {
        name: "the urlbar placeholder moves up and down by a few pixels",
        condition: r => rectInBoundingClientRect(r, textBoxRect),
      },
      {
        name: "bug 1547341 - a first tab gets drawn early",
        condition: r => rectInBoundingClientRect(r, firstTabRect),
      },
    ],
  };

  // First, open the appmenu.
  await withPerfObserver(() => gCUITestUtils.openMainMenu(), {
    expectedReflows: EXPECTED_APPMENU_OPEN_REFLOWS,
    frames: frameExpectations,
  });

  // Now open a series of subviews, and then close the appmenu. We
  // should not reflow during any of this.
  await withPerfObserver(
    async function () {
      // This recursive function will take the current main or subview,
      // find all of the buttons that navigate to subviews inside it,
      // and click each one individually. Upon entering the new view,
      // we recurse. When the subviews within a view have been
      // exhausted, we go back up a level.
      async function openSubViewsRecursively(currentView) {
        let navButtons = Array.from(
          // Ensure that only enabled buttons are tested
          currentView.querySelectorAll(
            ".subviewbutton-nav:not([disabled]):not([hidden])"
          )
        );
        if (!navButtons) {
          return;
        }

        for (let button of navButtons) {
          info("Click " + button.id);
          let promiseViewShown = BrowserTestUtils.waitForEvent(
            PanelUI.panel,
            "ViewShown"
          );
          button.click();
          let viewShownEvent = await promiseViewShown;

          // Workaround until bug 1363756 is fixed, then this can be removed.
          let container = PanelUI.multiView.querySelector(
            ".panel-viewcontainer"
          );
          await TestUtils.waitForCondition(() => {
            return !container.hasAttribute("width");
          });

          info("Shown " + viewShownEvent.originalTarget.id);
          await openSubViewsRecursively(viewShownEvent.originalTarget);
          promiseViewShown = BrowserTestUtils.waitForEvent(
            currentView,
            "ViewShown"
          );
          PanelUI.multiView.goBack();
          await promiseViewShown;

          // Workaround until bug 1363756 is fixed, then this can be removed.
          await TestUtils.waitForCondition(() => {
            return !container.hasAttribute("width");
          });
        }
      }

      await openSubViewsRecursively(PanelUI.mainView);

      await gCUITestUtils.hideMainMenu();
    },
    { expectedReflows: [], frames: frameExpectations }
  );
});
