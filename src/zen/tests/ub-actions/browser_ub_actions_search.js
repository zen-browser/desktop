/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

ChromeUtils.defineESModuleGetters(this, {
  globalActions: "resource:///modules/ZenUBGlobalActions.sys.mjs",
  SessionStore: "resource:///modules/sessionstore/SessionStore.sys.mjs",
  TabStateFlusher: "resource:///modules/sessionstore/TabStateFlusher.sys.mjs",
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
    await new Promise(resolve =>
      setTimeout(async () => {
        let index =
          typeof action.suggestedIndex === "number"
            ? action.suggestedIndex
            : Infinity;
        let { result } = await UrlbarTestUtils.getRowAt(
          window,
          Math.min(index, 1)
        );
        Assert.equal(result.providerName, "ZenUrlbarProviderGlobalActions");
        Assert.equal(result.payload.title, label);
        resolve();
      }, 0)
    );
  }
});

add_task(async function test_Ub_Actions_Exact_Match_Ranks_First() {
  // With a closed tab in history, "Reopen Closed Tab" is available too, and it
  // contains "close tab". The exact label must still be the first action.
  const tab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "https://example.com"
  );
  await TabStateFlusher.flush(tab.linkedBrowser);
  BrowserTestUtils.removeTab(tab);
  await TestUtils.waitForCondition(
    () => SessionStore.getClosedTabCount(window) > 0,
    "Waiting for the closed tab to be recorded"
  );

  const closeTab = globalActions.find(a => a.command === "cmd_close");
  await UrlbarTestUtils.promiseAutocompleteResultPopup({
    window,
    waitForFocus,
    value: closeTab.label,
  });
  let { result } = await UrlbarTestUtils.getRowAt(window, 1);
  Assert.equal(result.providerName, "ZenUrlbarProviderGlobalActions");
  Assert.equal(result.payload.title, closeTab.label);
  SessionStore.forgetClosedTab(window, 0);
});
