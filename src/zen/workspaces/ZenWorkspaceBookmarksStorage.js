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
    if (!window.gZenWorkspaces) {
      return;
    }
    await this._ensureTable();
  },

  async _ensureTable() {
    await this.lazy.PlacesUtils.withConnectionWrapper(
      "ZenWorkspaceBookmarksStorage.init",
      async (db) => {
        // Create table using GUIDs instead of IDs
        await db.execute(`
        CREATE TABLE IF NOT EXISTS zen_bookmarks_workspaces (
          id INTEGER PRIMARY KEY,
          bookmark_guid TEXT NOT NULL,
          workspace_uuid TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          UNIQUE(bookmark_guid),
          FOREIGN KEY(bookmark_guid) REFERENCES moz_bookmarks(guid) ON DELETE CASCADE
          )
      `);

        // Create index for fast lookups
        await db.execute(`
        CREATE INDEX IF NOT EXISTS idx_bookmarks_workspaces_lookup
          ON zen_bookmarks_workspaces(workspace_uuid, bookmark_guid)
      `);

        // Add changes tracking table
        await db.execute(`
        CREATE TABLE IF NOT EXISTS zen_bookmarks_workspaces_changes (
          id INTEGER PRIMARY KEY,
          bookmark_guid TEXT NOT NULL,
          workspace_uuid TEXT NOT NULL,
          change_type TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          UNIQUE(bookmark_guid),
          FOREIGN KEY(bookmark_guid) REFERENCES moz_bookmarks(guid) ON DELETE CASCADE
          )
      `);

        // Create index for changes tracking
        await db.execute(`
        CREATE INDEX IF NOT EXISTS idx_bookmarks_workspaces_changes
          ON zen_bookmarks_workspaces_changes(bookmark_guid, workspace_uuid)
      `);
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
    const result = await db.executeCached(`
      SELECT value FROM moz_meta WHERE key = 'zen_bookmarks_workspaces_last_change'
    `);
    return result.length ? parseInt(result[0].getResultByName("value"), 10) : 0;
  },

  async getBookmarkWorkspaces(bookmarkGuid) {
    const db = await this.lazy.PlacesUtils.promiseDBConnection();

    const rows = await db.execute(
      `
      SELECT workspace_uuid
      FROM zen_bookmarks_workspaces
      WHERE bookmark_guid = :bookmark_guid
    `,
      { bookmark_guid: bookmarkGuid }
    );

    return rows.map((row) => row.getResultByName("workspace_uuid"));
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
    await this.lazy.PlacesUtils.withConnectionWrapper(
      "ZenWorkspaceBookmarksStorage.clearChangedIDs",
      async (db) => {
        await db.execute(`DELETE FROM zen_bookmarks_workspaces_changes`);
      }
    );
  },
};

ZenWorkspaceBookmarksStorage.init();
