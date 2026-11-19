/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_SimpleTabOpen() {
  await withNewTabAndWindow(async (newTab, win) => {
    let tabId = newTab.id;
    let otherTab = gZenWindowSync.getItemFromWindow(win, tabId);
    Assert.ok(otherTab, "The opened tab should be found in the synced window");
    Assert.ok(newTab._zenContentsVisible, "The opened tab should be visible");
    Assert.equal(
      otherTab.id,
      tabId,
      "The opened tab ID should match the synced tab ID"
    );
  });
});

add_task(async function test_TabOpenInContainer() {
  await SpecialPowers.pushPrefEnv({
    set: [["privacy.userContext.enabled", true]],
  });
  let newTab = null;
  await withNewSyncedWindow(async win => {
    await runSyncAction(
      () => {
        newTab = gBrowser.addTrustedTab("https://example.com/", {
          inBackground: true,
          userContextId: 1,
        });
      },
      async () => {
        Assert.equal(
          newTab.userContextId,
          1,
          "The opened tab should keep its container"
        );
        const otherTab = gZenWindowSync.getItemFromWindow(win, newTab.id);
        Assert.ok(
          otherTab,
          "The opened tab should be found in the synced window"
        );
        Assert.equal(
          otherTab.userContextId,
          newTab.userContextId,
          "The synced tab should inherit the original tab's container"
        );
      },
      "TabOpen"
    );
  });
  let tabClosing = BrowserTestUtils.waitForTabClosing(newTab);
  BrowserTestUtils.removeTab(newTab);
  await tabClosing;
});
