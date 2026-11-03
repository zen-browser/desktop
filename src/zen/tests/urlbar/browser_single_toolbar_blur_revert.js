/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

ChromeUtils.defineESModuleGetters(this, {
  UrlbarTestUtils: "resource://testing-common/UrlbarTestUtils.sys.mjs",
});

const PAGE_URL = "https://example.com/";
const TYPED_VALUE = "zen blur revert test";

async function typeIntoUrlbar() {
  await UrlbarTestUtils.promiseAutocompleteResultPopup({
    window,
    value: TYPED_VALUE,
    fireInputEvent: true,
  });
  Assert.equal(
    gURLBar.value,
    TYPED_VALUE,
    "The typed value is present while the address bar is focused"
  );
}

add_task(async function test_single_toolbar_reverts_typed_value_on_blur() {
  await TestUtils.waitForCondition(
    () => gZenVerticalTabsManager._hasSetSingleToolbar,
    "The default layout should be single-toolbar"
  );

  await BrowserTestUtils.withNewTab(PAGE_URL, async () => {
    await typeIntoUrlbar();

    await UrlbarTestUtils.promisePopupClose(window, () => gURLBar.blur());
    await SimpleTest.promiseFocus(window);
    await new Promise(resolve => setTimeout(resolve));

    await TestUtils.waitForCondition(
      () => gURLBar.value !== TYPED_VALUE,
      "The address bar should revert away from the typed value on blur"
    );

    Assert.ok(
      gURLBar.value.includes("example.com"),
      `Reverted to the page URL (got "${gURLBar.value}")`
    );
    Assert.notEqual(
      gURLBar.value,
      TYPED_VALUE,
      "Single-toolbar blur did not retain the typed value"
    );
  });

  gURLBar.handleRevert();
});

add_task(async function test_double_toolbar_keeps_typed_value_on_blur() {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.view.use-single-toolbar", false]],
  });
  await TestUtils.waitForCondition(
    () => !gZenVerticalTabsManager._hasSetSingleToolbar,
    "The layout should switch to double-toolbar"
  );

  await BrowserTestUtils.withNewTab(PAGE_URL, async () => {
    await typeIntoUrlbar();

    await UrlbarTestUtils.promisePopupClose(window, () => gURLBar.blur());
    await SimpleTest.promiseFocus(window);

    Assert.equal(
      gURLBar.value,
      TYPED_VALUE,
      "Double-toolbar blur keeps the typed value (no forced revert)"
    );
  });

  gURLBar.handleRevert();
  await SpecialPowers.popPrefEnv();
});
