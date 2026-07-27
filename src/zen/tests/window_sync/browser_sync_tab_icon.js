/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// 1x1 transparent PNG.
const TEST_ICON =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

add_task(async function test_SimpleIconChange() {
  const initialTabs = new Set(gBrowser.tabs);
  await withNewTabAndWindow(async (newTab, win) => {
    let otherTab = gZenWindowSync.getItemFromWindow(win, newTab.id);
    Assert.ok(otherTab, "The opened tab should be found in the synced window");
    // Wait out the page load so a real favicon update can't race the test
    // icon below.
    await BrowserTestUtils.browserLoaded(newTab.linkedBrowser);
    await runSyncAction(
      () => {
        gBrowser.setIcon(newTab, TEST_ICON);
        Assert.equal(
          gBrowser.getIcon(newTab),
          TEST_ICON,
          "The original tab icon should be changed"
        );
      },
      async () => {
        Assert.equal(
          otherTab.getAttribute("image"),
          TEST_ICON,
          "The synced tab should show the original tab's favicon"
        );
        Assert.equal(
          win.gBrowser.getIcon(otherTab),
          TEST_ICON,
          "The synced tab's browser should carry the icon URL"
        );
      },
      "ZenTabIconChanged"
    );
  });
  // withNewTabAndWindow closes the tab it opened, but window sync also mirrors
  // the synced window's blank tab into this one; drop that too.
  const closing = [];
  for (const tab of [...gBrowser.tabs]) {
    if (!initialTabs.has(tab) && !tab.closing) {
      closing.push(BrowserTestUtils.waitForTabClosing(tab));
      BrowserTestUtils.removeTab(tab);
    }
  }
  await Promise.all(closing);
});

add_task(async function test_IconRemovalSyncs() {
  const initialTabs = new Set(gBrowser.tabs);
  await withNewTabAndWindow(async (newTab, win) => {
    let otherTab = gZenWindowSync.getItemFromWindow(win, newTab.id);
    await BrowserTestUtils.browserLoaded(newTab.linkedBrowser);
    await runSyncAction(
      () => {
        gBrowser.setIcon(newTab, TEST_ICON);
      },
      async () => {
        Assert.equal(
          otherTab.getAttribute("image"),
          TEST_ICON,
          "The synced tab should have the favicon before removal"
        );
      },
      "ZenTabIconChanged"
    );
    // Simulate the tab progress listener dropping a stale favicon: it nulls
    // out mIconURL and removes the image attribute without calling setIcon,
    // so only TabAttrModified fires.
    await runSyncAction(
      () => {
        newTab.linkedBrowser.mIconURL = null;
        newTab.removeAttribute("image");
        gBrowser._tabAttrModified(newTab, ["image"]);
      },
      async () => {
        // The setIcon call above also queued a TabAttrModified event, so this
        // callback may run for it before the removal got synced.
        await TestUtils.waitForCondition(
          () => !otherTab.getAttribute("image"),
          "Waiting for the synced tab's favicon to be removed"
        );
        Assert.ok(
          !otherTab.getAttribute("image"),
          "The synced tab's favicon should be removed as well"
        );
      },
      "TabAttrModified"
    );
  });
  // withNewTabAndWindow closes the tab it opened, but window sync also mirrors
  // the synced window's blank tab into this one; drop that too.
  const closing = [];
  for (const tab of [...gBrowser.tabs]) {
    if (!initialTabs.has(tab) && !tab.closing) {
      closing.push(BrowserTestUtils.waitForTabClosing(tab));
      BrowserTestUtils.removeTab(tab);
    }
  }
  await Promise.all(closing);
});

add_task(async function test_DontChangeBluredTabIcon() {
  const initialTabs = new Set(gBrowser.tabs);
  await withNewTabAndWindow(async (newTab, win) => {
    let otherTab = gZenWindowSync.getItemFromWindow(win, newTab.id);
    Assert.ok(!otherTab._zenContentsVisible, "The synced tab should be blured");
    // Setting an icon on the inactive synced copy must not propagate back
    // to the original tab.
    await runSyncAction(
      () => {
        win.gBrowser.setIcon(otherTab, TEST_ICON);
      },
      async () => {
        Assert.notEqual(
          gBrowser.getIcon(newTab),
          TEST_ICON,
          "The original tab icon should NOT change from the synced tab"
        );
      },
      "ZenTabIconChanged"
    );
  });
  // withNewTabAndWindow closes the tab it opened, but window sync also mirrors
  // the synced window's blank tab into this one; drop that too.
  const closing = [];
  for (const tab of [...gBrowser.tabs]) {
    if (!initialTabs.has(tab) && !tab.closing) {
      closing.push(BrowserTestUtils.waitForTabClosing(tab));
      BrowserTestUtils.removeTab(tab);
    }
  }
  await Promise.all(closing);
});
