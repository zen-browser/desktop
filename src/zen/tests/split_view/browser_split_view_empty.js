/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { UrlbarTestUtils } = ChromeUtils.importESModule(
  "resource://testing-common/UrlbarTestUtils.sys.mjs"
);

add_task(async function test_Split_View_Empty() {
  await BrowserTestUtils.withNewTab("https://example.com", async function () {
    const originalTab = gBrowser.selectedTab;
    const command = document.getElementById("cmd_zenNewEmptySplit");
    command.doCommand();
    await UrlbarTestUtils.promisePopupOpen(window, () => {});
    await UrlbarTestUtils.promiseAutocompleteResultPopup({
      window,
      waitForFocus,
      value: "https://example.com",
    });
    const waitForActivationPromise = BrowserTestUtils.waitForEvent(
      window,
      "ZenViewSplitter:SplitViewActivated"
    );
    let result = await UrlbarTestUtils.getDetailsOfResultAt(window, 0);
    EventUtils.synthesizeMouseAtCenter(result.element.row, {});
    await waitForActivationPromise;
    await new Promise((resolve) => {
      /* eslint-disable mozilla/no-arbitrary-setTimeout */
      setTimeout(async () => {
        resolve();
      }, 100);
    });
    const selectedTab = gBrowser.selectedTab;
    ok(
      gBrowser.tabpanels.hasAttribute("zen-split-view"),
      "The split view should not have crashed with two tabs in it"
    );
    ok(!gZenWorkspaces._emptyTab.splitView, "The empty tab should not be in split view");
    ok(!gZenWorkspaces._emptyTab.group, "The empty tab should not be in a group");
    ok(selectedTab.splitView, "The selected tab should be in split view");
    ok(originalTab.splitView, "The original tab should be in split view");
    Assert.equal(
      gBrowser.tabpanels.querySelectorAll('[zen-split="true"]').length,
      2,
      "There should be two split views present"
    );
    await BrowserTestUtils.removeTab(selectedTab);
  });
});
