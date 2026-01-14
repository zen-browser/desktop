/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

ChromeUtils.defineESModuleGetters(this, {
  globalActions: "resource:///modules/ZenUBGlobalActions.sys.mjs",
  UrlbarTestUtils: "resource://testing-common/UrlbarTestUtils.sys.mjs",
});

add_task(async function test_Ub_Actions_Search() {
  for (const action of globalActions) {
    if (!action.isAvailable(window)) {
      ok(true, `Skipping action: ${action.command}`);
      continue;
    }
    const label = action.label;
    await UrlbarTestUtils.promiseAutocompleteResultPopup({
      window,
      waitForFocus,
      value: label,
    });
    await new Promise((resolve) =>
      setTimeout(async () => {
        let index = typeof action.suggestedIndex === "number" ? action.suggestedIndex : Infinity;
        let { result } = await UrlbarTestUtils.getRowAt(window, Math.min(index, 1));
        Assert.equal(result.providerName, "ZenUrlbarProviderGlobalActions");
        Assert.equal(result.payload.title, label);
        resolve();
      }, 0)
    );
  }
});
