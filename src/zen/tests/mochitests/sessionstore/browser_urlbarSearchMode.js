/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

/**
 * This test makes sure that the urlbar's search mode is correctly preserved.
 */

ChromeUtils.defineESModuleGetters(this, {
  UrlbarShared: "chrome://browser/content/urlbar/UrlbarShared.mjs",
});

ChromeUtils.defineLazyGetter(this, "UrlbarTestUtils", () => {
  const { UrlbarTestUtils: module } = ChromeUtils.importESModule(
    "resource://testing-common/UrlbarTestUtils.sys.mjs"
  );
  module.init(this);
  return module;
});

add_task(async function test() {
  await SpecialPowers.pushPrefEnv({
    set: [["browser.urlbar.scotchBonnet.enableOverride", false]],
  });
  // Open the urlbar view and enter search mode.
  await UrlbarTestUtils.promiseAutocompleteResultPopup({
    window,
    value: "test",
  });
  await UrlbarTestUtils.enterSearchMode(window, {
    source: UrlbarShared.RESULT_SOURCE.HISTORY,
  });

  // The search mode should be in the tab state.
  let state = JSON.parse(ss.getTabState(gBrowser.selectedTab));
  Assert.ok(
    "searchMode" in state,
    "state.searchMode is present after entering search mode"
  );
  Assert.deepEqual(
    state.searchMode,
    {
      source: UrlbarShared.RESULT_SOURCE.HISTORY,
      entry: "oneoff",
      isPreview: false,
    },
    "state.searchMode is correct"
  );

  // Exit search mode.
  await UrlbarTestUtils.exitSearchMode(window);

  // The search mode should not be in the tab state.
  let newState = JSON.parse(ss.getTabState(gBrowser.selectedTab));
  Assert.ok(
    !newState.searchMode,
    "state.searchMode is not present after exiting search mode"
  );

  await UrlbarTestUtils.promisePopupClose(window);
});
