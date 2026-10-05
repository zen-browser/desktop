/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Integration of workspace-specific bookmarks into Places
window.ZenWorkspaceBookmarksStorage = {
  lazy: {},

  async init() {
    ChromeUtils.defineESModuleGetters(this.lazy, {
      PlacesUtils: "resource://gre/modules/PlacesUtils.sys.mjs",
    });
    this.promiseInitialized = new Promise(resolve => {
      this._resolveInitialized = resolve;
    });
    await this._ensureTable();
    this._resolveInitialized();
    delete this._resolveInitialized;
  },

  async _ensureTable() {
    await this.lazy.PlacesUtils.withConnectionWrapper(
      "ZenWorkspaceBookmarksStorage.init",
      async db => {
        await db.executeTransaction(async () => {
          const rows = await db.execute(`
            SELECT value FROM moz_meta
            WHERE key = 'zen_bookmarks_workspaces_schema_version'
          `);
          // Skip once migrated. Places recovery keeps moz_meta but drops these tables.
          if (
            rows[0]?.getResultByName("value") >= 1 &&
            (await db.tableExists("zen_bookmarks_workspaces")) &&
            (await db.tableExists("zen_bookmarks_workspaces_changes"))
          ) {
            return;
          }

          // Rebuild with pair uniqueness and without the obsolete workspace foreign key.
          for (const [tableName, columns] of [
            [
              "zen_bookmarks_workspaces",
              "created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL",
            ],
            [
              "zen_bookmarks_workspaces_changes",
              "change_type TEXT NOT NULL, timestamp INTEGER NOT NULL",
            ],
          ]) {
            await db.execute(`
              CREATE TABLE ${tableName}_new (
                id INTEGER PRIMARY KEY,
                bookmark_guid TEXT NOT NULL,
                workspace_uuid TEXT NOT NULL,
                ${columns},
                UNIQUE(bookmark_guid, workspace_uuid),
                FOREIGN KEY(bookmark_guid) REFERENCES moz_bookmarks(guid) ON DELETE CASCADE
              )
            `);
            if (await db.tableExists(tableName)) {
              // Zen 1.18b to 1.18.5b disabled foreign keys, which can leave rows for deleted bookmarks.
              await db.execute(`
                INSERT INTO ${tableName}_new
                SELECT * FROM ${tableName}
                WHERE bookmark_guid IN (SELECT guid FROM moz_bookmarks)
              `);
              await db.execute(`DROP TABLE ${tableName}`);
            }
            await db.execute(
              `ALTER TABLE ${tableName}_new RENAME TO ${tableName}`
            );
          }

          await db.execute(`
            CREATE INDEX idx_bookmarks_workspaces_lookup
              ON zen_bookmarks_workspaces(workspace_uuid, bookmark_guid)
          `);
          await db.execute(`
            CREATE INDEX idx_bookmarks_workspaces_changes
              ON zen_bookmarks_workspaces_changes(bookmark_guid, workspace_uuid)
          `);
          await db.execute(`
            INSERT OR REPLACE INTO moz_meta (key, value)
            VALUES ('zen_bookmarks_workspaces_schema_version', 1)
          `);
        });
      }
    );
  },

  /**
   * Updates the last change timestamp in the metadata table.
   *
   * @param {object} db - The database connection.
   */
  async updateLastChangeTimestamp(db) {
    const now = Date.now();
    await this.promiseInitialized;
    await db.execute(
      `
      INSERT OR REPLACE INTO moz_meta (key, value)
      VALUES ('zen_bookmarks_workspaces_last_change', :now)
    `,
      { now }
    );
  },

  /**
   * Gets the timestamp of the last change.
   *
   * @returns {Promise<number>} The timestamp of the last change.
   */
  async getLastChangeTimestamp() {
    const db = await this.lazy.PlacesUtils.promiseDBConnection();
    await this.promiseInitialized;
    const result = await db.executeCached(`
      SELECT value FROM moz_meta WHERE key = 'zen_bookmarks_workspaces_last_change'
    `);
    return result.length ? parseInt(result[0].getResultByName("value"), 10) : 0;
  },

  async getBookmarkWorkspaces(bookmarkGuid) {
    await this.promiseInitialized;
    const db = await this.lazy.PlacesUtils.promiseDBConnection();
    let rows = [];
    try {
      rows = await db.execute(
        `
      SELECT workspace_uuid
      FROM zen_bookmarks_workspaces
      WHERE bookmark_guid = :bookmark_guid
    `,
        { bookmark_guid: bookmarkGuid }
      );
    } catch (e) {
      console.error("Error fetching bookmark workspaces:", e);
    }

    return rows.map(row => row.getResultByName("workspace_uuid"));
  },

  /**
   * Get all bookmark GUIDs organized by workspace UUID.
   *
   * @returns {Promise<object>} A dictionary with workspace UUIDs as keys and arrays of bookmark GUIDs as values.
   * @example
   * // Returns:
   * {
   *   "workspace-uuid-1": ["bookmark-guid-1", "bookmark-guid-2"],
   *   "workspace-uuid-2": ["bookmark-guid-3"]
   * }
   */
  async getBookmarkGuidsByWorkspace() {
    await this.promiseInitialized;
    const db = await this.lazy.PlacesUtils.promiseDBConnection();
    const rows = await db.execute(`
      SELECT workspace_uuid, GROUP_CONCAT(bookmark_guid) as bookmark_guids
      FROM zen_bookmarks_workspaces
      GROUP BY workspace_uuid
    `);

    const result = {};
    for (const row of rows) {
      const workspaceUuid = row.getResultByName("workspace_uuid");
      const bookmarkGuids = row.getResultByName("bookmark_guids");
      result[workspaceUuid] = bookmarkGuids ? bookmarkGuids.split(",") : [];
    }

    return result;
  },

  /**
   * Get all changed bookmarks with their change types.
   *
   * @returns {Promise<object>} An object mapping bookmark+workspace pairs to their change data.
   */
  async getChangedIDs() {
    await this.promiseInitialized;
    const db = await this.lazy.PlacesUtils.promiseDBConnection();
    const rows = await db.execute(`
      SELECT bookmark_guid, workspace_uuid, change_type, timestamp
      FROM zen_bookmarks_workspaces_changes
    `);

    const changes = {};
    for (const row of rows) {
      const key = `${row.getResultByName("bookmark_guid")}:${row.getResultByName("workspace_uuid")}`;
      changes[key] = {
        type: row.getResultByName("change_type"),
        timestamp: row.getResultByName("timestamp"),
      };
    }
    return changes;
  },

  /**
   * Clear all recorded changes.
   */
  async clearChangedIDs() {
    await this.promiseInitialized;
    await this.lazy.PlacesUtils.withConnectionWrapper(
      "ZenWorkspaceBookmarksStorage.clearChangedIDs",
      async db => {
        await db.execute(`DELETE FROM zen_bookmarks_workspaces_changes`);
      }
    );
  },
};

ZenWorkspaceBookmarksStorage.init();
