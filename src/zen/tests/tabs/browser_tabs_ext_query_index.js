/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// Regression test: browser.tabs.query() must report contiguous 0..N-1 indices
// even though Zen hides "empty tab" placeholders (workspace New Tab button,
// one per folder) that occupy physical positions in the tab strip.

// Asserts query({currentWindow: true}) returns contiguous 0-based indices and
// that query({index: i}) round-trips. The label is passed via messaging since
// background scripts cannot close over test-file variables.
async function assertContiguousIndices(label) {
  let extension = ExtensionTestUtils.loadExtension({
    manifest: {
      permissions: ["tabs"],
    },
    background() {
      browser.test.onMessage.addListener(async msg => {
        let { label } = msg;
        try {
          let tabs = await browser.tabs.query({ currentWindow: true });
          tabs.sort((a, b) => a.index - b.index);

          for (let i = 0; i < tabs.length; i++) {
            browser.test.assertEq(
              tabs[i].index,
              i,
              `${label}: tab at position ${i} should have index ${i} (got ${tabs[i].index})`
            );
          }

          // Round-trip: query({index: i}) must return exactly the same tab.
          for (let i = 0; i < tabs.length; i++) {
            let found = await browser.tabs.query({ index: i });
            browser.test.assertEq(
              found.length,
              1,
              `${label}: query({index: ${i}}) should return one tab`
            );
            browser.test.assertEq(
              found[0].id,
              tabs[i].id,
              `${label}: query({index: ${i}}) should match tab ${i} from full query`
            );
          }

          // Out-of-range index returns no tabs.
          let none = await browser.tabs.query({ index: tabs.length });
          browser.test.assertEq(
            none.length,
            0,
            `${label}: query({index: tabs.length}) should return no tabs`
          );

          browser.test.notifyPass("done");
        } catch (e) {
          browser.test.fail(`unexpected error: ${e}`);
          browser.test.notifyFail("done");
        }
      });
    },
  });
  await extension.startup();
  await extension.sendMessage({ label });
  await extension.awaitFinish("done");
  await extension.unload();
}

add_task(async function test_query_indices_contiguous_at_startup() {
  // Startup has one hidden workspace empty tab plus the initial about:blank.
  await assertContiguousIndices("startup");
});

add_task(async function test_query_indices_contiguous_with_real_tabs() {
  let tab1 = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "about:robots"
  );
  let tab2 = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "about:config"
  );
  try {
    await assertContiguousIndices("with tabs");
  } finally {
    BrowserTestUtils.removeTab(tab2);
    BrowserTestUtils.removeTab(tab1);
  }
});

add_task(async function test_query_indices_contiguous_with_folder() {
  // A Zen Folder inserts a hidden empty-tab placeholder that used to gap indices.
  let tab = BrowserTestUtils.addTab(gBrowser, "about:blank");
  let folder = await gZenFolders.createFolder([tab], {
    renameFolder: false,
    label: "test-folder",
  });
  Assert.ok(folder, "Folder created");

  try {
    await assertContiguousIndices("with folder");
  } finally {
    let removed = BrowserTestUtils.waitForEvent(folder, "TabGroupRemoved");
    folder.delete();
    await removed;
  }
});

