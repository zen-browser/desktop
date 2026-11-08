/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_Pinned_To_Essential() {
  let resolvePromise;
  const promise = new Promise(resolve => {
    resolvePromise = resolve;
  });

  await BrowserTestUtils.openNewForegroundTab(
    window.gBrowser,
    "https://example.com/",
    true
  );

  const newTab = gBrowser.selectedTab;
  gBrowser.pinTab(newTab);

  ok(newTab.pinned, "The tab should be pinned after calling gBrowser.pinTab()");

  gZenPinnedTabManager.addToEssentials(newTab);
  ok(
    newTab.hasAttribute("zen-essential") &&
      newTab.parentNode.getAttribute("container") == "0",
    "New tab should be marked as essential."
  );

  resolvePromise();

  await promise;
  await BrowserTestUtils.removeTab(newTab);
});

add_task(async function test_Pinned_In_Folder_To_Essential() {
  const tab = BrowserTestUtils.addTab(gBrowser, "https://example.com/");
  const folder = await gZenFolders.createFolder([tab], {
    renameFolder: false,
    label: "test-folder",
  });
  ok(folder, "Folder created successfully");
  ok(tab.pinned, "Tab in folder is pinned");
  ok(tab.group, "Tab belongs to folder group");

  gZenPinnedTabManager.updatePinnedTabContextMenu(tab);
  const zenAddEssential = document.getElementById("context_zen-add-essential");
  ok(
    !zenAddEssential.hidden,
    "Add to essentials should be visible for tab in folder"
  );

  gZenPinnedTabManager.addToEssentials(tab);
  ok(
    tab.hasAttribute("zen-essential") &&
      tab.parentNode.getAttribute("container") == "0",
    "Tab from folder should be marked as essential."
  );
  ok(
    !tab.group,
    "Tab should be ungrouped from folder after becoming essential"
  );

  const removeEvent = BrowserTestUtils.waitForEvent(folder, "TabGroupRemoved");
  folder.delete();
  await removeEvent;
  await BrowserTestUtils.removeTab(tab);
});
