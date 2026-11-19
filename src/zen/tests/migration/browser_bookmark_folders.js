/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const kPinnedFoldersPref = "zen.migration.bookmarks-as-pinned-folders";

function bookmarkTree() {
  const { TYPE_FOLDER } = PlacesUtils.bookmarks;
  return [
    { url: "https://example.com/loose", title: "Loose" },
    {
      type: TYPE_FOLDER,
      title: "Reading",
      children: [
        { url: "https://example.com/a", title: "A" },
        { url: new URL("https://example.com/b"), title: "B" },
        {
          type: TYPE_FOLDER,
          title: "Deeper",
          children: [{ url: "https://example.com/c", title: "C" }],
        },
        { url: "javascript:void(0)", title: "Not importable" },
      ],
    },
    { type: TYPE_FOLDER, title: "Empty", children: [] },
  ];
}

function topLevelFolders() {
  return gBrowser.tabGroups.filter(
    group => group.isZenFolder && !group.group?.isZenFolder
  );
}

add_task(async function test_bookmark_tree_to_items() {
  const items = ZenMigrationUtils.bookmarkTreeToItems(bookmarkTree());
  Assert.deepEqual(
    items,
    [
      {
        type: "folder",
        title: "Reading",
        items: [
          { type: "tab", url: "https://example.com/a", title: "A" },
          { type: "tab", url: "https://example.com/b", title: "B" },
          {
            type: "folder",
            title: "Deeper",
            items: [{ type: "tab", url: "https://example.com/c", title: "C" }],
          },
        ],
      },
    ],
    "Only folders are kept, loose and unloadable bookmarks are dropped"
  );
});

add_task(async function test_import_bookmark_folders() {
  const original = snapshotActiveWorkspace();
  const items = ZenMigrationUtils.bookmarkTreeToItems(bookmarkTree());

  await ZenMigrationUtils.importItems(items, window);

  const folders = topLevelFolders();
  Assert.equal(folders.length, 1, "One folder was pinned");
  const folder = folders[0];
  Assert.equal(folder.label, "Reading");
  ok(folder.collapsed, "Pinned bookmark folders start collapsed");
  Assert.equal(
    folder.getAttribute("zen-workspace-id"),
    original.uuid,
    "The folder lives in the active space"
  );
  const folderItems = folderItemsOf(folder);
  Assert.equal(folderItems.length, 3, "Two tabs and a subfolder");
  Assert.deepEqual(folderItems.slice(0, 2).map(pinnedUrlOf), [
    "https://example.com/a",
    "https://example.com/b",
  ]);
  Assert.deepEqual(
    folderItems.slice(0, 2).map(tab => tab.label),
    ["A", "B"],
    "Pinned tabs show the bookmark titles without loading"
  );
  Assert.deepEqual(
    folderItems.slice(0, 2).map(pinnedTitleOf),
    ["A", "B"],
    "The bookmark titles are what the pins reset to"
  );
  ok(folderItems[2].isZenFolder, "The nested folder became a subfolder");
  Assert.equal(folderItems[2].label, "Deeper");
  for (const tab of folderItems.slice(0, 2)) {
    ok(tab.pinned, "Imported bookmarks are pinned tabs");
    ok(tab.hasAttribute("pending"), "Imported bookmarks are not loaded");
  }

  await cleanupImportedState(original);
});

add_task(async function test_import_bookmark_folders_budget() {
  const original = snapshotActiveWorkspace();
  const items = ZenMigrationUtils.bookmarkTreeToItems(bookmarkTree());

  await ZenMigrationUtils.importItems(items, window, { maxTabs: 1 });

  const folders = topLevelFolders();
  Assert.equal(folders.length, 1, "The folder is still created");
  Assert.equal(
    folderItemsOf(folders[0]).length,
    1,
    "Only as many tabs as the budget allows are pinned"
  );

  await cleanupImportedState(original);
});

add_task(async function test_bookmarks_hook_respects_pref() {
  const original = snapshotActiveWorkspace();
  await SpecialPowers.pushPrefEnv({ set: [[kPinnedFoldersPref, false]] });

  await ZenMigrationUtils.onBookmarksImported(bookmarkTree());
  Assert.equal(topLevelFolders().length, 0, "Nothing is pinned when opted out");

  await SpecialPowers.popPrefEnv();
  await ZenMigrationUtils.onBookmarksImported(bookmarkTree());
  Assert.equal(topLevelFolders().length, 1, "Folders are pinned by default");

  await cleanupImportedState(original);
});

add_task(async function test_bookmarks_hook_runs_on_import() {
  const original = snapshotActiveWorkspace();

  await MigrationUtils.insertManyBookmarksWrapper(
    bookmarkTree(),
    PlacesUtils.bookmarks.unfiledGuid
  );

  const bookmark = await PlacesUtils.bookmarks.fetch({
    url: "https://example.com/loose",
  });
  ok(bookmark, "The bookmarks were still imported as bookmarks");
  Assert.equal(
    topLevelFolders().length,
    1,
    "Importing bookmarks also pinned the folder"
  );

  await cleanupImportedState(original);
  await PlacesUtils.bookmarks.eraseEverything();
});
