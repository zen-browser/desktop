/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

ChromeUtils.defineESModuleGetters(this, {
  UrlbarTestUtils: "resource://testing-common/UrlbarTestUtils.sys.mjs",
});

UrlbarTestUtils.init(this);

const CUSTOM_LABEL = "Zen Project Dashboard 14595";
const PROVIDER_NAME = "ZenUrlbarProviderRenamedTabs";

async function findRenamedTabResult(searchString) {
  await UrlbarTestUtils.promiseAutocompleteResultPopup({
    window,
    value: searchString,
  });

  const resultCount = UrlbarTestUtils.getResultCount(window);
  for (let index = 0; index < resultCount; index++) {
    const details = await UrlbarTestUtils.getDetailsOfResultAt(window, index);
    if (details.result.providerName == PROVIDER_NAME) {
      return { details, index };
    }
  }
  return null;
}

add_task(async function test_urlbar_matches_renamed_tab_label() {
  const targetTab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "https://example.com/?zen-renamed-tab"
  );
  const searchTab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "https://example.org/?zen-urlbar-search"
  );

  registerCleanupFunction(async () => {
    for (const tab of [targetTab, searchTab]) {
      if (tab.isConnected) {
        await BrowserTestUtils.removeTab(tab);
      }
    }
  });

  targetTab.zenStaticLabel = CUSTOM_LABEL;
  gBrowser._setTabLabel(targetTab, CUSTOM_LABEL, {
    _zenChangeLabelFlag: true,
  });

  for (const searchString of [CUSTOM_LABEL, `% ${CUSTOM_LABEL}`]) {
    const match = await findRenamedTabResult(searchString);
    Assert.ok(match, `The renamed tab should match "${searchString}"`);
    Assert.equal(
      match.details.result.payload.title,
      CUSTOM_LABEL,
      "The result should display the renamed label"
    );
    Assert.equal(
      match.details.result.payload.url,
      targetTab.linkedBrowser.currentURI.spec,
      "The result should point to the renamed tab"
    );
    gURLBar.view.close();
  }

  delete targetTab.zenStaticLabel;
  gBrowser.setTabTitle(targetTab);
  Assert.ok(
    !(await findRenamedTabResult(CUSTOM_LABEL)),
    "Resetting the label should remove the custom title match"
  );
  gURLBar.view.close();

  targetTab.zenStaticLabel = CUSTOM_LABEL;
  gBrowser._setTabLabel(targetTab, CUSTOM_LABEL, {
    _zenChangeLabelFlag: true,
  });
  const match = await findRenamedTabResult(CUSTOM_LABEL);
  Assert.ok(match, "The renamed tab should be available for switching");

  UrlbarTestUtils.setSelectedRowIndex(window, match.index);
  const switched = BrowserTestUtils.waitForEvent(
    gBrowser.tabContainer,
    "TabSelect"
  );
  EventUtils.synthesizeKey("KEY_Enter");
  await switched;
  Assert.equal(
    gBrowser.selectedTab,
    targetTab,
    "Selecting the result should switch to the renamed tab"
  );
});
