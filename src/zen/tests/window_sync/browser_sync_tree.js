/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_nest_syncs_to_other_window() {
  const initialTabs = new Set(gBrowser.tabs);
  await withNewSyncedWindow(async win => {
    // Create two synced tabs (open in this window, mirrored in `win`).
    const parent = gBrowser.addTrustedTab("https://example.com/", {
      inBackground: true,
    });
    const child = gBrowser.addTrustedTab("https://example.com/", {
      inBackground: true,
    });
    await TestUtils.waitForCondition(
      () =>
        win.gZenWindowSync.getItemFromWindow(win, parent.id) &&
        win.gZenWindowSync.getItemFromWindow(win, child.id)
    );

    gZenTabTree.nestTab(child, parent);

    await TestUtils.waitForCondition(() => {
      const mirror = win.gZenWindowSync.getItemFromWindow(win, child.id);
      return mirror?.getAttribute("zen-tree-parent-id") === parent.id;
    }, "child mirror gets the parent id");

    const mirrorChild = win.gZenWindowSync.getItemFromWindow(win, child.id);
    Assert.equal(
      win.gZenTabTree.getParent(mirrorChild)?.id,
      parent.id,
      "mirror window rebuilt the parent pointer"
    );

    gZenTabTree.setCollapsed(parent, true);
    await TestUtils.waitForCondition(() => {
      const m = win.gZenWindowSync.getItemFromWindow(win, parent.id);
      return m?.hasAttribute("zen-tree-collapsed");
    }, "collapse syncs to mirror window");

    BrowserTestUtils.removeTab(child);
    BrowserTestUtils.removeTab(parent);
  });

  // Clean up any tab window-sync mirrored into this window (done at the test
  // level, not in the shared helper — doing it inside withNewSyncedWindow
  // collides with withNewTabAndWindow's teardown and triggers a sync jam).
  for (const tab of [...gBrowser.tabs]) {
    if (!initialTabs.has(tab) && !tab.closing) {
      BrowserTestUtils.removeTab(tab);
    }
  }
});
