/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_New_Tab_Inside_Folder() {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.folders.new-tabs-in-folder", true]],
  });
  const selectedTab = gBrowser.selectedTab;
  const tab = BrowserTestUtils.addTab(gBrowser, "about:blank");
  const folder = await gZenFolders.createFolder([tab], {
    renameFolder: false,
  });
  gBrowser.selectedTab = tab;
  const triggeringPrincipal = Services.scriptSecurityManager.getSystemPrincipal();

  const newTab = gBrowser.addTab("https://example.com", {
    inBackground: true,
    triggeringPrincipal,
  });

  /* eslint-disable mozilla/no-arbitrary-setTimeout */
  await new Promise((resolve) => setTimeout(resolve, 100));

  Assert.equal(folder.tabs.length, 3, "New tab was added to the folder");
  Assert.equal(newTab.group, folder, "New tab is in the folder group");

  gBrowser.selectedTab = selectedTab;
  await removeFolder(folder);
  await SpecialPowers.popPrefEnv();
});

add_task(async function test_New_Tab_Not_Inside_Folder_When_Pref_Disabled() {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.folders.new-tabs-in-folder", false]],
  });
  const selectedTab = gBrowser.selectedTab;
  const tab = BrowserTestUtils.addTab(gBrowser, "about:blank");
  const folder = await gZenFolders.createFolder([tab], {
    renameFolder: false,
  });
  gBrowser.selectedTab = tab;
  const triggeringPrincipal = Services.scriptSecurityManager.getSystemPrincipal();

  const newTab = gBrowser.addTab("https://example.com", {
    inBackground: true,
    triggeringPrincipal,
  });

  await new Promise((resolve) => setTimeout(resolve, 100));

  Assert.equal(folder.tabs.length, 2, "New tab was not added to the folder");
  ok(!newTab.group, "New tab should not be in any group");

  gBrowser.selectedTab = selectedTab;
  BrowserTestUtils.removeTab(newTab);
  await removeFolder(folder);
  await SpecialPowers.popPrefEnv();
});

add_task(async function test_Owned_Tab_Not_Captured_By_New_Tabs_In_Folder() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.folders.new-tabs-in-folder", true],
      ["zen.folders.owned-tabs-in-folder", false],
    ],
  });
  const selectedTab = gBrowser.selectedTab;
  const tab = BrowserTestUtils.addTab(gBrowser, "about:blank");
  const folder = await gZenFolders.createFolder([tab], {
    renameFolder: false,
  });
  gBrowser.selectedTab = tab;

  const newTab = gBrowser.addTab("https://example.com", {
    relatedToCurrent: true,
    ownerTab: tab,
    triggeringPrincipal,
  });

  await new Promise((resolve) => setTimeout(resolve, 100));

  Assert.equal(folder.tabs.length, 2, "Owned tab was not captured by new-tabs-in-folder");
  ok(!newTab.group, "Owned tab should not be in any group");

  gBrowser.selectedTab = selectedTab;
  BrowserTestUtils.removeTab(newTab);
  await removeFolder(folder);
  await SpecialPowers.popPrefEnv();
});
