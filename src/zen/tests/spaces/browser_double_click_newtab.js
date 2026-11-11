/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_setup(async function () {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.urlbar.replace-newtab", false]],
  });

  registerCleanupFunction(async () => {
    await SpecialPowers.popPrefEnv();
  });
});

add_task(async function test_Check_Creation() {
  const placeToDoubleClick =
    gZenWorkspaces.activeWorkspaceElement.querySelector(
      ".zen-workspace-empty-space"
    );
  ok(placeToDoubleClick, "We should have found the place to double click.");
  EventUtils.sendMouseEvent({ type: "dblclick" }, placeToDoubleClick, window);
  await TestUtils.waitForCondition(
    () => gBrowser.tabs.length === 3,
    "New tab should be opened."
  );
  ok(true, "New tab should be opened.");
  await BrowserTestUtils.removeTab(gBrowser.tabs[1]);
  Assert.strictEqual(gBrowser.tabs.length, 2, "There should be one tab.");
});

add_task(async function test_double_click_overflow_padding() {
  await gZenWorkspaces.promiseInitialized;
  const workspace = gZenWorkspaces.activeWorkspaceElement;
  const scrollbox = workspace.scrollbox.scrollbox;
  const originalMaxHeight = workspace.scrollbox.style.maxHeight;
  const originalTabs = new Set(gBrowser.tabs);
  workspace.scrollbox.style.maxHeight = "100px";
  try {
    for (let i = 0; i < 8; i++) {
      BrowserTestUtils.addTab(gBrowser, "about:blank", { skipAnimation: true });
    }
    await TestUtils.waitForCondition(() => workspace.scrollbox.overflowing);
    scrollbox.scrollTo({ top: scrollbox.scrollHeight, behavior: "instant" });
    const bounds = scrollbox.getBoundingClientRect();
    const target = workspace.scrollbox.shadowRoot.elementFromPoint(
      bounds.left + bounds.width / 2,
      bounds.bottom - 20
    );
    Assert.equal(
      target,
      scrollbox,
      "The blank padding belongs to the scrollbox"
    );
    const opened = BrowserTestUtils.waitForNewTab(gBrowser);
    target.dispatchEvent(
      new MouseEvent("dblclick", { bubbles: true, composed: true, detail: 2 })
    );
    await opened;
  } finally {
    for (const tab of gBrowser.tabs.filter(tab => !originalTabs.has(tab))) {
      await BrowserTestUtils.removeTab(tab);
    }
    workspace.scrollbox.style.maxHeight = originalMaxHeight;
  }
});
