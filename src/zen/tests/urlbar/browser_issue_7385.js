/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

ChromeUtils.defineESModuleGetters(this, {
  UrlbarTestUtils: "resource://testing-common/UrlbarTestUtils.sys.mjs",
});

add_task(async function test_Selection_Remains_Double_Toolbar() {
  await goToMultipleLayouts(async () => {
    const untrimmedValue = "https://example.com/";
    let trimmedValue = UrlbarTestUtils.trimURL(untrimmedValue);
    await SimpleTest.promiseFocus(window);
    await BrowserTestUtils.withNewTab(untrimmedValue, async () => {
      Assert.equal(gURLBar.value, trimmedValue, "Value has been trimmed");
      await selectWithMouseDrag(10, 20);

      Assert.greater(gURLBar.selectionStart, 0, "Selection start is positive.");
      Assert.greater(
        gURLBar.selectionEnd,
        gURLBar.selectionStart,
        "Selection is not empty."
      );

      Assert.equal(gURLBar.value, untrimmedValue, `Value should be untrimmed`);

      gURLBar.handleRevert();
      gURLBar.view.close();
    });
  });
});
