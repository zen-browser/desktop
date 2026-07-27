/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_SimpleLabelChange() {
  const initialTabs = new Set(gBrowser.tabs);
  let newLabel = "Test Label";
  await withNewTabAndWindow(async (newTab, win) => {
    let otherTab = gZenWindowSync.getItemFromWindow(win, newTab.id);
    // Let the page load settle first. The load sets the tab's real title, and
    // if that lands after the label below it overwrites it, and window sync
    // then faithfully propagates the title to the mirror.
    await TestUtils.waitForCondition(
      () =>
        !newTab.linkedBrowser.webProgress.isLoadingDocument &&
        newTab.label &&
        !newTab.label.includes("example.com"),
      "Waiting for the page title to arrive before setting a label"
    );
    await runSyncAction(
      () => {
        gBrowser._setTabLabel(newTab, newLabel);
        Assert.equal(
          newTab.label,
          newLabel,
          "The original tab label should be changed"
        );
      },
      async () => {
        Assert.equal(
          otherTab.label,
          newLabel,
          "The synced tab label should match the changed label"
        );
      },
      "ZenTabLabelChanged"
    );
  });
  // Window sync mirrors the synced window's blank tab into this one.
  const closing = [];
  for (const tab of [...gBrowser.tabs]) {
    if (!initialTabs.has(tab) && !tab.closing) {
      closing.push(BrowserTestUtils.waitForTabClosing(tab));
      BrowserTestUtils.removeTab(tab);
    }
  }
  await Promise.all(closing);
});

add_task(async function test_DontChangeBluredTabLabel() {
  const initialTabs = new Set(gBrowser.tabs);
  let newLabel = "Test Label";
  await withNewTabAndWindow(async (newTab, win) => {
    let otherTab = gZenWindowSync.getItemFromWindow(win, newTab.id);
    Assert.ok(!otherTab._zenContentsVisible, "The synced tab should be blured");
    gBrowser._setTabLabel(newTab, newLabel);
    Assert.notEqual(
      otherTab.label,
      newLabel,
      "The synced tab label should NOT match the changed label"
    );
  });
  // Window sync mirrors the synced window's blank tab into this one.
  const closing = [];
  for (const tab of [...gBrowser.tabs]) {
    if (!initialTabs.has(tab) && !tab.closing) {
      closing.push(BrowserTestUtils.waitForTabClosing(tab));
      BrowserTestUtils.removeTab(tab);
    }
  }
  await Promise.all(closing);
});
