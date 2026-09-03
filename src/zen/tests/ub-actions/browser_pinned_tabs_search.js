/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

ChromeUtils.defineESModuleGetters(this, {
  UrlbarTestUtils: "resource://testing-common/UrlbarTestUtils.sys.mjs",
});

const PROVIDER_NAME = "ZenUrlbarProviderPinnedTabs";

async function searchAndGetFirstRow(value) {
  await UrlbarTestUtils.promiseAutocompleteResultPopup({
    window,
    waitForFocus,
    value,
  });
  const { result } = await UrlbarTestUtils.getRowAt(window, 0);
  return result;
}

async function pickFirstRow() {
  await UrlbarTestUtils.promisePopupClose(window, () => {
    EventUtils.synthesizeKey("KEY_Enter");
  });
}

add_task(async function test_pinned_tab_found_by_custom_label() {
  await BrowserTestUtils.withNewTab(
    { gBrowser, url: "https://example.com/pinned" },
    async browser => {
      const tab = gBrowser.getTabForBrowser(browser);
      gBrowser.pinTab(tab);
      tab.zenStaticLabel = "Pinned Example";
      await gBrowser.TabStateFlusher.flush(browser);

      const otherTab = await BrowserTestUtils.openNewForegroundTab(
        gBrowser,
        "about:blank"
      );
      const tabCount = gBrowser.tabs.length;

      const result = await searchAndGetFirstRow("pinned ex");
      Assert.equal(result.providerName, PROVIDER_NAME);
      Assert.equal(result.payload.title, "Pinned Example");
      Assert.ok(result.heuristic, "The best pin match is the heuristic row");

      await pickFirstRow();
      Assert.equal(
        gBrowser.selectedTab,
        tab,
        "Enter switched to the pinned tab"
      );
      Assert.equal(gBrowser.tabs.length, tabCount, "No new tab was opened");

      BrowserTestUtils.removeTab(otherTab);
      gBrowser.unpinTab(tab);
    }
  );
});

add_task(async function test_unloaded_pinned_tab_found_by_host() {
  await BrowserTestUtils.withNewTab(
    { gBrowser, url: "https://example.com/unloaded" },
    async browser => {
      const tab = gBrowser.getTabForBrowser(browser);
      gBrowser.pinTab(tab);
      await gBrowser.TabStateFlusher.flush(browser);

      const otherTab = await BrowserTestUtils.openNewForegroundTab(
        gBrowser,
        "about:blank"
      );
      gBrowser.discardBrowser(tab, true);
      Assert.ok(tab.hasAttribute("pending"), "The pinned tab is unloaded");
      const tabCount = gBrowser.tabs.length;

      const result = await searchAndGetFirstRow("example.co");
      Assert.notEqual(
        result.providerName,
        PROVIDER_NAME,
        "URL-like input keeps Firefox's heuristic first"
      );
      const { result: second } = await UrlbarTestUtils.getRowAt(window, 1);
      Assert.equal(second.providerName, PROVIDER_NAME);
      Assert.ok(second.payload.isPending, "The row knows the pin is unloaded");
      Assert.equal(second.payload.host, "example.com");

      await UrlbarTestUtils.promisePopupClose(window, () => {
        EventUtils.synthesizeKey("KEY_ArrowDown");
        EventUtils.synthesizeKey("KEY_Enter");
      });
      Assert.equal(gBrowser.selectedTab, tab, "Enter switched to the pin");
      await BrowserTestUtils.waitForCondition(
        () => !tab.hasAttribute("pending"),
        "The pinned tab was restored"
      );
      Assert.equal(gBrowser.tabs.length, tabCount, "No new tab was opened");

      BrowserTestUtils.removeTab(otherTab);
      gBrowser.unpinTab(tab);
    }
  );
});

add_task(async function test_disabled_by_pref() {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.urlbar.suggestions.pinned-tabs", false]],
  });
  await BrowserTestUtils.withNewTab(
    { gBrowser, url: "https://example.com/disabled" },
    async browser => {
      const tab = gBrowser.getTabForBrowser(browser);
      gBrowser.pinTab(tab);
      tab.zenStaticLabel = "Disabled Pin";
      await gBrowser.TabStateFlusher.flush(browser);

      const result = await searchAndGetFirstRow("disabled pi");
      Assert.notEqual(result.providerName, PROVIDER_NAME);
      await UrlbarTestUtils.promisePopupClose(window, () => gURLBar.blur());
      gBrowser.unpinTab(tab);
    }
  );
  await SpecialPowers.popPrefEnv();
});
