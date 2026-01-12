/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_Split_View_Inside_Folder() {
  const [tab1, tab2] = await Promise.all([
    addTabTo(gBrowser, getUrlForNthTab(1)),
    addTabTo(gBrowser, getUrlForNthTab(2)),
  ]);
  const pinEvent1 = BrowserTestUtils.waitForEvent(tab1, "TabPinned");
  const pinEvent2 = BrowserTestUtils.waitForEvent(tab2, "TabPinned");
  gBrowser.pinTab(tab1);
  gBrowser.pinTab(tab2);
  await Promise.all([pinEvent1, pinEvent2]);
  Assert.strictEqual(gBrowser.tabs.length, 4, "There should be four tabs after pinning both tabs");
  const folder = await gZenFolders.createFolder([tab1, tab2], {
    renameFolder: false,
    label: "test",
  });
  Assert.equal(tab1.group, folder, "The first pinned tab should be in the folder group");
  Assert.equal(tab2.group, folder, "The second pinned tab should be in the folder group");
  await createSplitView([tab1, tab2], "grid");
  Assert.strictEqual(
    tab2.group,
    tab1.group,
    "The second pinned tab should be in the same split group after duplication"
  );
  ok(
    tab1.group.hasAttribute("split-view-group"),
    "The first pinned tab should be in a split group after duplication"
  );
  Assert.ok(tab1.group.pinned, "The split group should be pinned after duplication of both tabs");
  Assert.equal(tab1.group.group, folder, "The split group should be the folder after duplication");
  const removeEvent = BrowserTestUtils.waitForEvent(window, "TabGroupRemoved");
  folder.delete();
  await removeEvent;
});
