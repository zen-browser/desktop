/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_folder_template_pref_guard() {
  Services.prefs.clearUserPref("zen.folders.super.enabled");
  Services.prefs.clearUserPref("zen.folders.templates.enabled");

  const disabledResult = gZenFolders.createFolderFromTemplate("workday");
  Assert.equal(
    disabledResult,
    null,
    "Template creation is guarded when super folders are disabled."
  );

  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.folders.super.enabled", true],
      ["zen.folders.templates.enabled", true],
    ],
  });

  const folder = gZenFolders.createFolderFromTemplate("research");
  ok(folder, "Template folder is created when prefs are enabled.");
  Assert.equal(folder.label, "Research", "Template label should be applied.");

  await removeFolder(folder);
  await SpecialPowers.popPrefEnv();
});

add_task(async function test_folder_quick_search_command() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.folders.super.enabled", true],
      ["zen.folders.keyboard-search.enabled", true],
    ],
  });

  const tab = await addTabTo(gBrowser, "https://example.com/");
  const folder = gZenFolders.createFolder([tab], {
    renameFolder: false,
    label: "Quick Search Folder",
  });
  ok(folder, "Folder created for quick search test.");
  folder.collapsed = true;
  gBrowser.selectedTab = tab;

  const popup = document.getElementById("zen-folder-tabs-popup");
  const shown = BrowserTestUtils.waitForEvent(popup, "popupshown");
  ok(gZenFolders.openSearchForActiveFolder(), "Quick search command should open popup.");
  await shown;

  const hidden = BrowserTestUtils.waitForEvent(popup, "popuphidden");
  popup.hidePopup(true);
  await hidden;

  await removeFolder(folder);
  await SpecialPowers.popPrefEnv();
});

add_task(async function test_auto_folder_uses_existing_and_collapses() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.folders.super.enabled", true],
      ["zen.folders.autofolders.enabled", true],
      ["zen.folders.autofolders.create-if-missing", false],
      ["zen.folders.autofolders.collapse-target", true],
      [
        "zen.folders.autofolders.rules",
        JSON.stringify([{ match: ["example.org"], folderName: "Auto Inbox" }]),
      ],
    ],
  });

  const existingFolder = gZenFolders.createFolder([], {
    renameFolder: false,
    label: "Auto Inbox",
  });
  ok(existingFolder, "Existing target folder should be available.");

  const tab = BrowserTestUtils.addTab(gBrowser, "https://example.org/");
  const browser = gBrowser.getBrowserForTab(tab);
  await BrowserTestUtils.browserLoaded(browser);

  await TestUtils.waitForCondition(() => tab.group?.id === existingFolder.id);
  ok(tab.group === existingFolder, "Auto folder should group tab into existing folder.");
  ok(existingFolder.collapsed, "Target folder should auto-collapse to save space.");

  // Ensure no extra folder with same label was created.
  const sameLabelFolders = Array.from(
    gBrowser.tabContainer.querySelectorAll("zen-folder")
  ).filter(folder => folder.label === "Auto Inbox");
  Assert.equal(
    sameLabelFolders.length,
    1,
    "Auto-folder should hook existing folder only when create-if-missing is false."
  );

  await removeFolder(existingFolder);
  await SpecialPowers.popPrefEnv();
});
