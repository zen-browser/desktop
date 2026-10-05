/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { Sqlite } = ChromeUtils.importESModule(
  "resource://gre/modules/Sqlite.sys.mjs"
);

add_task(async function test_bookmark_save_retains_multiple_spaces() {
  await ZenWorkspaceBookmarksStorage.promiseInitialized;
  const originalSpaces = gZenWorkspaces.getWorkspaces();
  const originalSpaceIds = new Set(originalSpaces.map(space => space.uuid));
  let bookmark;
  let createdSpace;
  try {
    await gZenWorkspaces.createAndSaveWorkspace(
      "Bookmark assignment test",
      undefined,
      true
    );
    createdSpace = gZenWorkspaces
      .getWorkspaces()
      .find(space => !originalSpaceIds.has(space.uuid));
    ok(createdSpace, "A second Space was created");
    const spaceIds = [originalSpaces[0].uuid, createdSpace.uuid];
    bookmark = await PlacesUtils.bookmarks.insert({
      parentGuid: PlacesUtils.bookmarks.unfiledGuid,
      title: "Bookmark in two Spaces",
      url: "https://example.com/bookmark-workspace-storage",
    });
    const state = new PlacesUIUtils.BookmarkState({
      info: {
        itemGuid: bookmark.guid,
        parentGuid: bookmark.parentGuid,
        title: bookmark.title,
        uri: Services.io.newURI(bookmark.url.href),
      },
      workspaces: [],
    });

    await state._workspacesChanged(spaceIds);
    is(await state.save(), bookmark.guid, "Save returns the bookmark GUID");
    Assert.deepEqual(
      (
        await ZenWorkspaceBookmarksStorage.getBookmarkWorkspaces(bookmark.guid)
      ).sort(),
      [...spaceIds].sort(),
      "Save persists both Space assignments"
    );
    let changes = await ZenWorkspaceBookmarksStorage.getChangedIDs();
    for (const spaceId of spaceIds) {
      is(
        changes[`${bookmark.guid}:${spaceId}`]?.type,
        "added",
        "Save records each Space assignment for sync"
      );
    }

    await state._workspacesChanged([spaceIds[1]]);
    await state.save();
    Assert.deepEqual(
      await ZenWorkspaceBookmarksStorage.getBookmarkWorkspaces(bookmark.guid),
      [spaceIds[1]],
      "Editing removes only the unchecked Space"
    );
    changes = await ZenWorkspaceBookmarksStorage.getChangedIDs();
    is(
      changes[`${bookmark.guid}:${spaceIds[0]}`]?.type,
      "removed",
      "The removed assignment has its own sync record"
    );
    is(
      changes[`${bookmark.guid}:${spaceIds[1]}`]?.type,
      "added",
      "Removing one assignment preserves the other sync record"
    );

    await state._workspacesChanged(spaceIds);
    await state.save();
    Assert.deepEqual(
      (
        await ZenWorkspaceBookmarksStorage.getBookmarkWorkspaces(bookmark.guid)
      ).sort(),
      [...spaceIds].sort(),
      "A removed Space can be assigned again"
    );
    changes = await ZenWorkspaceBookmarksStorage.getChangedIDs();
    is(
      changes[`${bookmark.guid}:${spaceIds[0]}`]?.type,
      "added",
      "Reassigning a Space replaces that pair's removal record"
    );
  } finally {
    if (bookmark) {
      await PlacesUtils.bookmarks.remove(bookmark);
    }
    if (createdSpace) {
      await gZenWorkspaces.removeWorkspace(createdSpace.uuid);
    }
  }
});

// Keep schema fixtures separate from the browser's Places database.
async function withBookmarkStorageDatabase(task) {
  const directory = await IOUtils.createUniqueDirectory(
    PathUtils.tempDir,
    "zen-bookmark-workspaces"
  );
  let db;
  try {
    db = await Sqlite.openConnection({
      path: PathUtils.join(directory, "bookmarks.sqlite"),
    });
    await db.execute("PRAGMA foreign_keys = ON");
    await db.execute("CREATE TABLE moz_bookmarks (guid TEXT PRIMARY KEY)");
    await db.execute("CREATE TABLE moz_meta (key TEXT PRIMARY KEY, value)");
    await db.execute("CREATE TABLE zen_workspaces (uuid TEXT PRIMARY KEY)");
    await db.execute(
      "INSERT INTO moz_bookmarks VALUES ('bookmark0001'), ('bookmark0002')"
    );
    await db.execute(
      "INSERT INTO zen_workspaces VALUES ('space-one'), ('space-two')"
    );
    const storage = Object.create(ZenWorkspaceBookmarksStorage);
    storage.lazy = {
      PlacesUtils: {
        withConnectionWrapper: (_name, callback) => callback(db),
      },
    };
    storage._resolveInitialized = () => {};
    await task(db, storage);
  } finally {
    if (db) {
      await db.close();
    }
    await IOUtils.remove(directory, { recursive: true });
  }
}

async function readStorageRows(db, table, columns) {
  const rows = await db.execute(
    `SELECT ${columns.join(", ")} FROM ${table} ORDER BY id`
  );
  return rows.map(row => columns.map(column => row.getResultByName(column)));
}

// Older schemas used a workspace foreign key or bookmark-only uniqueness.
for (const schema of [
  "fresh",
  "workspace-foreign-key",
  "bookmark-only-unique",
]) {
  add_task(async function test_bookmark_storage_schema() {
    info(`Testing ${schema} bookmark storage`);
    await withBookmarkStorageDatabase(async (db, storage) => {
      const tables = [
        {
          name: "zen_bookmarks_workspaces",
          columns: [
            "id",
            "bookmark_guid",
            "workspace_uuid",
            "created_at",
            "updated_at",
          ],
          fields: "created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL",
          rows: [
            [41, "bookmark0001", "space-one", 101, 202],
            [42, "bookmark0002", "space-two", 103, 204],
          ],
        },
        {
          name: "zen_bookmarks_workspaces_changes",
          columns: [
            "id",
            "bookmark_guid",
            "workspace_uuid",
            "change_type",
            "timestamp",
          ],
          fields: "change_type TEXT NOT NULL, timestamp INTEGER NOT NULL",
          rows: [
            [51, "bookmark0001", "space-one", "removed", 301],
            [52, "bookmark0002", "space-two", "added", 302],
          ],
        },
      ];
      if (schema !== "fresh") {
        for (const table of tables) {
          const uniqueColumns =
            schema === "bookmark-only-unique"
              ? "bookmark_guid"
              : "bookmark_guid, workspace_uuid";
          const workspaceForeignKey =
            schema === "workspace-foreign-key"
              ? ", FOREIGN KEY(workspace_uuid) REFERENCES zen_workspaces(uuid) ON DELETE CASCADE"
              : "";
          await db.execute(`CREATE TABLE ${table.name} (
            id INTEGER PRIMARY KEY,
            bookmark_guid TEXT NOT NULL,
            workspace_uuid TEXT NOT NULL,
            ${table.fields},
            UNIQUE(${uniqueColumns}),
            FOREIGN KEY(bookmark_guid) REFERENCES moz_bookmarks(guid) ON DELETE CASCADE
            ${workspaceForeignKey}
          )`);
          for (const row of table.rows) {
            await db.execute(
              `INSERT INTO ${table.name} VALUES (?, ?, ?, ?, ?)`,
              row
            );
          }
        }
      }

      if (schema === "workspace-foreign-key") {
        // Old profiles can retain this foreign key after Spaces stopped using SQLite.
        await db.execute("PRAGMA foreign_keys = OFF");
        await db.execute("DROP TABLE zen_workspaces");
        await db.execute("PRAGMA foreign_keys = ON");
      }
      await storage._ensureTable();
      for (const table of tables) {
        Assert.deepEqual(
          await readStorageRows(db, table.name, table.columns),
          schema === "fresh" ? [] : table.rows,
          `${table.name} preserves existing row IDs and values`
        );
        const foreignKeys = await db.execute(
          `PRAGMA foreign_key_list(${table.name})`
        );
        Assert.deepEqual(
          foreignKeys.map(row => [
            row.getResultByName("table"),
            row.getResultByName("from"),
            row.getResultByName("to"),
            row.getResultByName("on_delete"),
          ]),
          [["moz_bookmarks", "bookmark_guid", "guid", "CASCADE"]],
          `${table.name} retains only the bookmark cascade foreign key`
        );
      }

      await db.execute("DROP TABLE IF EXISTS zen_workspaces");
      for (const table of tables) {
        const values =
          table.name === "zen_bookmarks_workspaces"
            ? ["bookmark0001", "space-three", 501, 502]
            : ["bookmark0001", "space-three", "added", 503];
        const insert = `INSERT INTO ${table.name} (${table.columns.slice(1).join(", ")}) VALUES (?, ?, ?, ?)`;
        await db.execute(insert, values);
        const otherSpace = [...values];
        otherSpace[1] = "space-four";
        await db.execute(insert, otherSpace);
        await Assert.rejects(
          db.execute(insert, values),
          /UNIQUE constraint failed/,
          `${table.name} permits multiple Spaces but rejects a duplicate pair`
        );
        await Assert.rejects(
          db.execute(insert, ["missing-guid", ...values.slice(1)]),
          /FOREIGN KEY constraint failed/,
          `${table.name} rejects an assignment without a bookmark`
        );
      }

      const beforeReinit = await Promise.all(
        tables.map(table => readStorageRows(db, table.name, table.columns))
      );
      await storage._ensureTable();
      Assert.deepEqual(
        await Promise.all(
          tables.map(table => readStorageRows(db, table.name, table.columns))
        ),
        beforeReinit,
        "Repeated initialization preserves every assignment and pending change"
      );
      await db.execute("DELETE FROM moz_bookmarks WHERE guid = 'bookmark0001'");
      for (const table of tables) {
        const rows = await db.execute(
          `SELECT id FROM ${table.name} WHERE bookmark_guid = 'bookmark0001'`
        );
        is(rows.length, 0, `${table.name} cascades bookmark deletion`);
        const remainingRows = await readStorageRows(
          db,
          table.name,
          table.columns
        );
        Assert.deepEqual(
          remainingRows,
          schema === "fresh" ? [] : [table.rows[1]],
          `${table.name} keeps the other bookmark's records`
        );
      }
    });
  });
}
