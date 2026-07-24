/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

ChromeUtils.defineESModuleGetters(this, {
  UrlbarTestUtils: "resource://testing-common/UrlbarTestUtils.sys.mjs",
});

add_task(async function test_Floating_Urlbar() {
  gURLBar.blur();

  await SimpleTest.promiseFocus(window);
  document.getElementById("Browser:OpenLocation").doCommand();
  await UrlbarTestUtils.promiseAutocompleteResultPopup({
    window,
    waitForFocus: SimpleTest.waitForFocus,
    value: "https://example.com/",
  });

  ok(
    gURLBar.hasAttribute("zen-floating-urlbar"),
    "URL bar should be in floating mode"
  );
});

add_task(async function test_Click_Shoudnt_FLoat_Urlbar() {
  gURLBar.blur();

  await simulateClick(window);

  await UrlbarTestUtils.promiseAutocompleteResultPopup({
    window,
    waitForFocus: SimpleTest.waitForFocus,
    value: "https://example.com/",
  });

  ok(
    !gURLBar.hasAttribute("zen-floating-urlbar"),
    "URL bar should not be in floating mode"
  );
});

add_task(async function test_Keyboard_Focus_Floats_In_Float_Mode() {
  await SpecialPowers.pushPrefEnv({ set: [["zen.urlbar.behavior", "float"]] });

  if (gURLBar.view.isOpen) {
    await UrlbarTestUtils.promisePopupClose(window, () => gURLBar.blur());
  } else {
    gURLBar.blur();
  }
  await SimpleTest.promiseFocus(window);
  gBrowser.selectedBrowser.focus();

  let focusPromise = BrowserTestUtils.waitForEvent(gURLBar.inputField, "focus");
  EventUtils.synthesizeKey("VK_F6");
  await focusPromise;

  await BrowserTestUtils.waitForCondition(
    () => gURLBar.hasAttribute("zen-floating-urlbar"),
    "URL bar should float after pressing F6 in 'float' mode"
  );
  ok(gURLBar.hasAttribute("zen-floating-urlbar"), "URL bar is floating");

  await UrlbarTestUtils.promisePopupClose(window, () => gURLBar.blur());
  await SpecialPowers.popPrefEnv();
});

add_task(async function test_Floating_Highlight_Everything() {
  gURLBar.blur();

  await SimpleTest.promiseFocus(window);
  await selectWithMouseDrag(2, 5);
  document.getElementById("Browser:OpenLocation").doCommand();

  // Selection range
  Assert.equal(gURLBar.selectionStart, 0, "Selection start should be 0");
  Assert.equal(
    gURLBar.selectionEnd,
    gURLBar.value.length,
    "Selection end should be the length of the value"
  );
});
