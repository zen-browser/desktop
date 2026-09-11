/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

ChromeUtils.defineESModuleGetters(this, {
  globalActions: "resource:///modules/ZenUBGlobalActions.sys.mjs",
  UrlbarTestUtils: "resource://testing-common/UrlbarTestUtils.sys.mjs",
});

async function assertFirstAction(query, expectedCommand) {
  const action = globalActions.find(a => a.command === expectedCommand);
  ok(action, `Action ${expectedCommand} exists`);
  await UrlbarTestUtils.promiseAutocompleteResultPopup({
    window,
    waitForFocus,
    value: query,
  });
  await new Promise(resolve =>
    setTimeout(async () => {
      const { result } = await UrlbarTestUtils.getRowAt(window, 1);
      Assert.equal(
        result.providerName,
        "ZenUrlbarProviderGlobalActions",
        `"${query}" returns an action`
      );
      Assert.equal(
        result.payload.title,
        action.label,
        `"${query}" returns ${expectedCommand}`
      );
      resolve();
    }, 0)
  );
}

// Query words may appear in any order.
add_task(async function test_Ub_Actions_Word_Order() {
  await assertFirstAction("pick theme", "cmd_zenOpenZenThemePicker");
  await assertFirstAction("picker theme open", "cmd_zenOpenZenThemePicker");
});

// Localized keywords act as synonyms for the label.
add_task(async function test_Ub_Actions_Keywords() {
  await assertFirstAction("change theme", "cmd_zenOpenZenThemePicker");
  await assertFirstAction("incognito", "Tools:PrivateBrowsing");
});
