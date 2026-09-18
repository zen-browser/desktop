/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_New_Rename_Cleans_Up_Unfocused_Editor() {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.view.sidebar-expanded", true]],
  });
  const tab = BrowserTestUtils.addTab(gBrowser, "about:blank");
  const folder = await gZenFolders.createFolder([tab], {
    renameFolder: false,
    label: "Original folder name",
  });
  const tabLabel = tab.querySelector(".tab-label-container");
  const originalFocus = HTMLInputElement.prototype.focus;

  try {
    ok(tabLabel, "The tab in the folder has a label container");
    HTMLInputElement.prototype.focus = function () {};

    gZenVerticalTabsManager.renameTabStart({
      target: tabLabel,
    });

    ok(
      document.getElementById("tab-label-input"),
      "The unfocused editor remains available for cleanup"
    );
    Assert.equal(
      gZenVerticalTabsManager._tabEdited,
      tab,
      "The tab remains the edited item until another rename starts"
    );

    HTMLInputElement.prototype.focus = originalFocus;
    gZenVerticalTabsManager.renameTabStart({
      target: folder.labelElement,
      explicit: true,
    });
    const input = document.getElementById("tab-label-input");
    Assert.equal(
      document.activeElement,
      input,
      "Starting another rename focuses its editor"
    );
    input.value = "Renamed folder";
    await gZenVerticalTabsManager.renameTabKeydown({
      key: "Enter",
      target: input,
      stopPropagation() {},
    });

    Assert.equal(folder.label, "Renamed folder", "The folder can be renamed");
  } finally {
    HTMLInputElement.prototype.focus = originalFocus;
    await removeFolder(folder);
    await SpecialPowers.popPrefEnv();
  }
});
