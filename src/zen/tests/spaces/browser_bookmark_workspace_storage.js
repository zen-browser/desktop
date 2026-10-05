/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { Sqlite } = ChromeUtils.importESModule(
  "resource://gre/modules/Sqlite.sys.mjs"
);

// Profiles keep the tables from the Zen version that created them.
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
    // Zen stopped adding Spaces to zen_workspaces in 1.18.
    await db.execute("CREATE TABLE zen_workspaces (uuid TEXT PRIMARY KEY)");
    await db.execute("INSERT INTO moz_bookmarks VALUES ('bookmark-one')");
    await task(db);
  } finally {
    await db.close();
    await IOUtils.remove(directory, { recursive: true });
  }
}

// Runs the production migration against the test database.
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
    title: "Bookmark in two Spaces",
    url: "https://example.com/",
  });
  registerCleanupFunction(() => PlacesUtils.bookmarks.remove(bookmark));

  // Edit Bookmark saves Space changes through BookmarkState.
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
    "Saving keeps both Spaces"
  );

  await state._workspacesChanged([secondSpace.uuid]);
  await state.save();
  Assert.deepEqual(
    await ZenWorkspaceBookmarksStorage.getBookmarkWorkspaces(bookmark.guid),
    [secondSpace.uuid],
    "Unchecking one Space keeps the other"
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
        // Row 42 belongs to a bookmark deleted while foreign keys were off.
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
          `${name} keeps rows for existing bookmarks and accepts a second Space`
        );
      }
    });
  }
});

add_task(async function test_recreate_tables_after_places_recovery() {
  await withTestDatabase(async db => {
    // Places recovery copies only moz_ tables, so the schema version survives.
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
