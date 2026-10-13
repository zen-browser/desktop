"use strict";

/**
 * Ensure redundant style flushes are not triggered when switching between windows
 */
add_task(async function test_toolbar_element_restyles_on_activation() {
  let restyles = {
    win1: {},
    win2: {},
  };

  // create a window and snapshot the elementsStyled
  let win1 = await BrowserTestUtils.openNewBrowserWindow();
  await new Promise(resolve => waitForFocus(resolve, win1));

  // create a 2nd window and snapshot the elementsStyled
  let win2 = await BrowserTestUtils.openNewBrowserWindow();
  await new Promise(resolve => waitForFocus(resolve, win2));

  // (De)-activate both windows once before we take a measurement. The first
  // (de-)activation may flush styles, after that the style data should be
  // cached.
  win1.focus();
  win2.focus();

  // Flush any pending styles before we take a measurement.
  win1.getComputedStyle(win1.document.firstElementChild);
  win2.getComputedStyle(win2.document.firstElementChild);

  // Clear the focused element from each window so that when
  // we raise them, the focus of the element doesn't cause an
  // unrelated style flush.
  Services.focus.clearFocus(win1);
  Services.focus.clearFocus(win2);

  let utils1 = SpecialPowers.getDOMWindowUtils(win1);
  restyles.win1.initial = utils1.restyleGeneration;

  let utils2 = SpecialPowers.getDOMWindowUtils(win2);
  restyles.win2.initial = utils2.restyleGeneration;

  // switch back to 1st window, and snapshot elementsStyled
  win1.focus();
  restyles.win1.activate = utils1.restyleGeneration;
  restyles.win2.deactivate = utils2.restyleGeneration;

  // switch back to 2nd window, and snapshot elementsStyled
  win2.focus();
  restyles.win2.activate = utils2.restyleGeneration;
  restyles.win1.deactivate = utils1.restyleGeneration;

  is(
    restyles.win1.activate - restyles.win1.deactivate,
    0,
    "No elements restyled when re-activating/deactivating a window"
  );
  is(
    restyles.win2.activate - restyles.win2.deactivate,
    0,
    "No elements restyled when re-activating/deactivating a window"
  );

  await BrowserTestUtils.closeWindow(win1);
  await BrowserTestUtils.closeWindow(win2);
});
