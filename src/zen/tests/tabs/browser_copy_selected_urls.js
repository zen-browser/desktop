/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const URL1 = "https://example.com/?tab=1";
const URL2 = "https://example.org/?tab=2";
const URL3 = "https://example.org/?tab=3";
const BLANK_URL = "about:blank";

add_task(async function test_copy_urls_of_multiselected_tabs() {
  // setup tabs
  const tab1 = BrowserTestUtils.addTab(gBrowser, URL1);
  const tab2 = BrowserTestUtils.addTab(gBrowser, URL2);
  const tab3 = BrowserTestUtils.addTab(gBrowser, URL3);
  const blankTab = BrowserTestUtils.addTab(gBrowser, BLANK_URL);
  registerCleanupFunction(() => {
    BrowserTestUtils.removeTab(tab1);
    BrowserTestUtils.removeTab(tab2);
    BrowserTestUtils.removeTab(tab3);
    BrowserTestUtils.removeTab(blankTab);
  });

  // wait for non-blank tabs to load
  await Promise.all(
    [tab1, tab2, tab3].map(tab =>
      BrowserTestUtils.browserLoaded(tab.linkedBrowser)
    )
  );

  // create the following structure:
  //
  // folder
  // ├─ subfolder
  // │  └─ tab2
  // └─ tab1
  // about:blank
  // tab3
  const subfolder = await gZenFolders.createFolder([tab2], {
    renameFolder: false,
    label: "subfolder",
  });
  const folder = await gZenFolders.createFolder([tab1], {
    renameFolder: false,
    label: "folder",
  });
  folder.tabs[0].after(subfolder);
  registerCleanupFunction(async () => {
    for (const group of [subfolder, folder]) {
      if (group.isConnected) {
        await group.delete();
      }
    }
  });
  Assert.equal(subfolder.group, folder, "The subfolder is inside the folder");
  Assert.equal(tab2.group, subfolder, "tab2 is in the subfolder");
  Assert.equal(tab1.group, folder, "tab1 is in the folder");
  Assert.equal(tab3.group, null, "tab3 is loose");

  registerCleanupFunction(() => {
    // A toast that is still visible is reused with its old count, so don't
    // leave one for the next test.
    document.getElementById("zen-toast-container").replaceChildren();
  });

  // select tabs
  await BrowserTestUtils.switchTab(gBrowser, blankTab);
  gBrowser.addToMultiSelectedTabs(tab3);
  gBrowser.addToMultiSelectedTabs(tab2);
  gBrowser.addToMultiSelectedTabs(tab1);

  // test multi-copy
  // in sidebar order, without the unshareable blank tab
  const expectedTabs = [tab2, tab1, tab3];

  await SimpleTest.promiseClipboardChange(
    expectedTabs.map(tab => tab.linkedBrowser.currentURI.spec).join("\n"),
    () => document.getElementById("cmd_zenCopyCurrentURL").doCommand()
  );
  ok(true, "Copy URL copies every multiselected tab, in sidebar order");

  await SimpleTest.promiseClipboardChange(
    expectedTabs
      .map(tab => `[${tab.label}](${tab.linkedBrowser.currentURI.spec})`)
      .join("\n"),
    () => document.getElementById("cmd_zenCopyCurrentURLMarkdown").doCommand()
  );
  ok(true, "Copy URL as Markdown copies a link per multiselected tab");
});
