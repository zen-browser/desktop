/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { Sqlite } = ChromeUtils.importESModule(
  "resource://gre/modules/Sqlite.sys.mjs"
);

// Table constraints that older profiles can still have.
const OLD_CONSTRAINTS = {
  "before 1.18": `UNIQUE(bookmark_guid, workspace_uuid),
    FOREIGN KEY(workspace_uuid) REFERENCES zen_workspaces(uuid) ON DELETE CASCADE`,
  "1.18 and later": "UNIQUE(bookmark_guid)",
};

const TABLES = [
  {
    name: "zen_bookmarks_workspaces",
    index: "idx_bookmarks_workspaces_lookup",
    indexColumns: "workspace_uuid, bookmark_guid",
    columns: "created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL",
    values: [101, 102],
  },
  {
    name: "zen_bookmarks_workspaces_changes",
    index: "idx_bookmarks_workspaces_changes",
    indexColumns: "bookmark_guid, workspace_uuid",
    columns: "change_type TEXT NOT NULL, timestamp INTEGER NOT NULL",
    values: ["added", 103],
  },
];

// Opens a throwaway database with the Places tables that the migration reads.
async function withTestDatabase(task) {
  const directory = await IOUtils.createUniqueDirectory(
    PathUtils.tempDir,
    "zen-bookmark-spaces"
  );
  const db = await Sqlite.openConnection({
    path: PathUtils.join(directory, "places.sqlite"),
  });
  try {
    await db.execute("CREATE TABLE moz_bookmarks (guid TEXT PRIMARY KEY)");
    await db.execute("CREATE TABLE moz_meta (key TEXT PRIMARY KEY, value)");
    // Empty, so the old foreign key rejects every space.
    await db.execute("CREATE TABLE zen_workspaces (uuid TEXT PRIMARY KEY)");
    await db.execute("INSERT INTO moz_bookmarks VALUES ('bookmark-one')");
    await task(db);
  } finally {
    await db.close();
    await IOUtils.remove(directory, { recursive: true });
  }
}

// Runs _ensureTable() against the test database.
function migrate(db) {
  return ZenWorkspaceBookmarksStorage._ensureTable.call({
    lazy: {
      PlacesUtils: { withConnectionWrapper: (_name, task) => task(db) },
    },
  });
}

add_task(async function test_save_bookmark_in_two_spaces() {
  await gZenWorkspaces.promiseInitialized;
  await ZenWorkspaceBookmarksStorage.promiseInitialized;
  const firstSpace = gZenWorkspaces.getActiveWorkspace();
  const secondSpace = await gZenWorkspaces.createAndSaveWorkspace(
    "Second Space",
    undefined,
    true
  );
  registerCleanupFunction(() =>
    gZenWorkspaces.removeWorkspace(secondSpace.uuid)
  );
  const bookmark = await PlacesUtils.bookmarks.insert({
    parentGuid: PlacesUtils.bookmarks.unfiledGuid,
    title: "Bookmark in two spaces",
    url: "https://example.com/",
  });
  registerCleanupFunction(() => PlacesUtils.bookmarks.remove(bookmark));

  // Edit Bookmark saves space changes through BookmarkState.
  const state = new PlacesUIUtils.BookmarkState({
    info: {
      itemGuid: bookmark.guid,
      parentGuid: bookmark.parentGuid,
      title: bookmark.title,
      uri: Services.io.newURI(bookmark.url.href),
    },
  });
  const spaceIds = [firstSpace.uuid, secondSpace.uuid].sort();
  await state._workspacesChanged(spaceIds);
  await state.save();
  Assert.deepEqual(
    (
      await ZenWorkspaceBookmarksStorage.getBookmarkWorkspaces(bookmark.guid)
    ).sort(),
    spaceIds,
    "Saving keeps both spaces"
  );

  await state._workspacesChanged([secondSpace.uuid]);
  await state.save();
  Assert.deepEqual(
    await ZenWorkspaceBookmarksStorage.getBookmarkWorkspaces(bookmark.guid),
    [secondSpace.uuid],
    "Unchecking one space keeps the other"
  );
});

add_task(async function test_migrate_old_tables() {
  for (const [version, constraints] of Object.entries(OLD_CONSTRAINTS)) {
    info(`Migrating tables created by Zen ${version}`);
    await withTestDatabase(async db => {
      for (const { name, index, indexColumns, columns, values } of TABLES) {
        await db.execute(`CREATE TABLE ${name} (
          id INTEGER PRIMARY KEY,
          bookmark_guid TEXT NOT NULL,
          workspace_uuid TEXT NOT NULL,
          ${columns},
          ${constraints},
          FOREIGN KEY(bookmark_guid) REFERENCES moz_bookmarks(guid) ON DELETE CASCADE
        )`);
        await db.execute(`CREATE INDEX ${index} ON ${name}(${indexColumns})`);
        // Row 42 points at a bookmark that no longer exists.
        await db.execute(
          `INSERT INTO ${name} VALUES
            (41, 'bookmark-one', 'space-one', ?, ?),
            (42, 'deleted-bookmark', 'space-one', ?, ?)`,
          [...values, ...values]
        );
      }
      // Places enables foreign keys on its connection.
      await db.execute("PRAGMA foreign_keys = ON");
      await migrate(db);

      for (const { name, values } of TABLES) {
        await db.execute(
          `INSERT INTO ${name} VALUES (43, 'bookmark-one', 'space-two', ?, ?)`,
          values
        );
        const rows = await db.execute(`SELECT * FROM ${name} ORDER BY id`);
        Assert.deepEqual(
          rows.map(row => [0, 1, 2, 3, 4].map(i => row.getResultByIndex(i))),
          [
            [41, "bookmark-one", "space-one", ...values],
            [43, "bookmark-one", "space-two", ...values],
          ],
          `${name} keeps rows for existing bookmarks and accepts a second space`
        );
      }
    });
  }
});

add_task(async function test_recreate_tables_after_places_recovery() {
  await withTestDatabase(async db => {
    // Recovering a corrupt database keeps moz_meta but drops our tables.
    await db.execute(`
      INSERT INTO moz_meta (key, value)
      VALUES ('zen_bookmarks_workspaces_schema_version', 1)
    `);
    await migrate(db);
    for (const { name } of TABLES) {
      ok(await db.tableExists(name), `${name} is recreated`);
    }
  });
});

add_task(async function test_add_and_remove_bookmarks_in_space() {
  await gZenWorkspaces.promiseInitialized;
  await ZenWorkspaceBookmarksStorage.promiseInitialized;
  const space = gZenWorkspaces.getActiveWorkspace();
  const bookmarks = [];
  for (const title of ["First", "Second"]) {
    bookmarks.push(
      await PlacesUtils.bookmarks.insert({
        parentGuid: PlacesUtils.bookmarks.unfiledGuid,
        title,
        url: `https://example.com/${title}`,
      })
    );
  }
  const [first, second] = bookmarks;
  registerCleanupFunction(async () => {
    for (const bookmark of bookmarks) {
      await PlacesUtils.bookmarks.remove(bookmark);
    }
  });
  let notifications = 0;
  const observer = () => notifications++;
  Services.obs.addObserver(observer, "workspace-bookmarks-updated");
  registerCleanupFunction(() =>
    Services.obs.removeObserver(observer, "workspace-bookmarks-updated")
  );

  const added = await ZenWorkspaceBookmarksStorage.addBookmarksToWorkspace(
    [first.guid, second.guid, first.guid, "missing-guid"],
    space.uuid
  );
  Assert.deepEqual(
    added,
    [first.guid, second.guid],
    "Duplicates and unknown GUIDs are not assigned"
  );
  Assert.equal(notifications, 1, "Every window is notified once");
  Assert.deepEqual(
    (await ZenWorkspaceBookmarksStorage.getBookmarkGuidsByWorkspace())[
      space.uuid
    ].filter(guid => bookmarks.some(bookmark => bookmark.guid === guid)),
    [first.guid, second.guid],
    "Bookmarks keep the order they were pinned in"
  );
  const changes = await ZenWorkspaceBookmarksStorage.getChangedIDs();
  Assert.equal(
    changes[`${first.guid}:${space.uuid}`]?.type,
    "added",
    "The assignment is recorded for sync"
  );

  Assert.deepEqual(
    await ZenWorkspaceBookmarksStorage.addBookmarksToWorkspace(
      [first.guid],
      space.uuid
    ),
    [],
    "Assigning again is a no-op"
  );
  Assert.equal(notifications, 1, "A no-op does not notify");

  ok(
    await ZenWorkspaceBookmarksStorage.removeBookmarkFromWorkspace(
      first.guid,
      space.uuid
    ),
    "The assignment is removed"
  );
  Assert.equal(
    (await ZenWorkspaceBookmarksStorage.getChangedIDs())[
      `${first.guid}:${space.uuid}`
    ]?.type,
    "removed",
    "The removal is recorded for sync"
  );
  ok(
    !(await ZenWorkspaceBookmarksStorage.removeBookmarkFromWorkspace(
      first.guid,
      space.uuid
    )),
    "Removing twice does nothing"
  );
  Assert.deepEqual(
    await ZenWorkspaceBookmarksStorage.getBookmarkWorkspaces(second.guid),
    [space.uuid],
    "Other assignments stay"
  );
  ok(await PlacesUtils.bookmarks.fetch(first.guid), "The bookmark is kept");
});
