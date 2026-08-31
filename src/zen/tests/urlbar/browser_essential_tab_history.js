/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

ChromeUtils.defineESModuleGetters(this, {
  UrlbarTestUtils: "resource://testing-common/UrlbarTestUtils.sys.mjs",
});

const PROVIDER_NAME = "ZenUrlbarProviderEssentials";
const TEST_ROOT = "https://example.com/browser/zen/tests/urlbar/";

async function search(win, value) {
  await SimpleTest.promiseFocus(win);
  await UrlbarTestUtils.promiseAutocompleteResultPopup({
    window: win,
    waitForFocus,
    value,
  });

  const rows = [];
  const count = UrlbarTestUtils.getResultCount(win);
  for (let i = 0; i < count; i++) {
    rows.push(await UrlbarTestUtils.getRowAt(win, i));
  }
  return rows;
}

add_task(async function test_cross_window_essential_records_source() {
  const originalTabs = new Set(gBrowser.tabs);
  const originalTab = gBrowser.selectedTab;
  const sourceTab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    TEST_ROOT + "history-source"
  );
  let otherWindow;

  try {
    otherWindow = await BrowserTestUtils.openNewBrowserWindow();
    await otherWindow.gZenWorkspaces.promiseInitialized;
    const otherOriginalTab = otherWindow.gBrowser.selectedTab;
    const targetTab = await BrowserTestUtils.openNewForegroundTab(
      otherWindow.gBrowser,
      TEST_ROOT + "history-target"
    );
    targetTab.setAttribute("label", "Unique History Target");
    targetTab.setAttribute("zen-essential", "true");
    otherWindow.gBrowser.selectedTab = otherOriginalTab;

    const rows = await search(window, "unique history target");
    const row = rows.find(
      resultRow => resultRow.result.providerName == PROVIDER_NAME
    );
    Assert.ok(row, "The cross-window Essential is suggested");
    if (!row) {
      return;
    }

    gURLBar.pickResult(
      row.result,
      new KeyboardEvent("keydown", { key: "Enter" }),
      row
    );
    await TestUtils.waitForCondition(
      () => otherWindow.gBrowser.selectedTab == targetTab,
      "The Essential target should be selected"
    );

    Assert.ok(
      await otherWindow.gZenTabHistory.goBack(otherWindow),
      "Back returns from the Essential to its source"
    );
    Assert.equal(
      gBrowser.selectedTab,
      sourceTab,
      "Back restores the source tab"
    );
    Assert.equal(
      Services.wm.getMostRecentWindow("navigator:browser"),
      window,
      "Back focuses the source window"
    );

    Assert.ok(
      await gZenTabHistory.goForward(window),
      "Forward returns to the Essential"
    );
    Assert.equal(
      otherWindow.gBrowser.selectedTab,
      targetTab,
      "Forward restores the Essential target"
    );
  } finally {
    if (UrlbarTestUtils.isPopupOpen(window)) {
      await UrlbarTestUtils.promisePopupClose(window, () =>
        EventUtils.synthesizeKey("KEY_Escape", {}, window)
      );
    }
    if (otherWindow && !otherWindow.closed) {
      await BrowserTestUtils.closeWindow(otherWindow);
    }
    await SimpleTest.promiseFocus(window);
    if (!originalTab.closing) {
      gBrowser.selectedTab = originalTab;
    }
    for (const tab of [...gBrowser.tabs]) {
      if (!originalTabs.has(tab) && !tab.closing) {
        await BrowserTestUtils.removeTab(tab);
      }
    }
  }
});
