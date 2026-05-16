/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  PlacesUtils: "resource://gre/modules/PlacesUtils.sys.mjs",
});

/**
 * Adds workspace-scoping columns to the shared Places database for history.
 *
 * This works alongside the existing ZenSpaceBookmarksStorage pattern:
 * adds a zen_history_workspaces table that maps moz_places entries
 * (history) to workspace UUIDs.
 *
 * All new history entries are tagged with the current workspace UUID.
 * History queries (awesomebar, library, etc.) filter by workspace.
 */
export class ZenWorkspaceHistoryStorage {
  /** @type {boolean} */
  #initialized = false;

  /** @type {Promise<void>|null} */
  #promiseInitialized = null;

  /** @type {Function|null} */
  #resolveInitialized = null;

  /**
   * Initializes the history workspace table in places.sqlite.
   * Safe to call multiple times.
   */
  async init() {
    if (this.#initialized) {
      return;
    }

    this.#promiseInitialized = new Promise(resolve => {
      this.#resolveInitialized = resolve;
    });

    await lazy.PlacesUtils.withConnectionWrapper(
      "ZenWorkspaceHistoryStorage.init",
      async db => {
        await db.execute(`
          CREATE TABLE IF NOT EXISTS zen_history_workspaces (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            place_id INTEGER NOT NULL,
            workspace_uuid TEXT NOT NULL,
            created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
            UNIQUE(place_id),
            FOREIGN KEY(place_id) REFERENCES moz_places(id) ON DELETE CASCADE
          )
        `);

        await db.execute(`
          CREATE INDEX IF NOT EXISTS idx_zen_history_workspaces_lookup
            ON zen_history_workspaces(workspace_uuid, place_id)
        `);

        this.#initialized = true;
        this.#resolveInitialized();
        this.#resolveInitialized = null;
      }
    );
  }

  /**
   * Associates a history entry (place_id) with a workspace.
   * Called whenever a new page is visited.
   *
   * @param {number} placeId       - moz_places.id
   * @param {string} workspaceUuid - The active workspace UUID
   */
  async assignHistoryToWorkspace(placeId, workspaceUuid) {
    if (!this.#initialized) {
      await this.#promiseInitialized;
    }

    if (!workspaceUuid) {
      return;
    }

    try {
      const db = await lazy.PlacesUtils.promiseDBConnection();
      await db.execute(
        `
        INSERT OR IGNORE INTO zen_history_workspaces (place_id, workspace_uuid)
        VALUES (:placeId, :workspaceUuid)
      `,
        { placeId, workspaceUuid }
      );
    } catch (e) {
      console.error(
        "ZenWorkspaceHistoryStorage: Failed to assign history entry:",
        e
      );
    }
  }

  /**
   * Returns place IDs belonging to a workspace.
   *
   * @param {string} workspaceUuid
   * @returns {Promise<Set<number>>} Set of place_id values
   */
  async getPlaceIdsForWorkspace(workspaceUuid) {
    if (!this.#initialized) {
      await this.#promiseInitialized;
    }

    try {
      const db = await lazy.PlacesUtils.promiseDBConnection();
      const rows = await db.execute(
        `
        SELECT place_id FROM zen_history_workspaces
        WHERE workspace_uuid = :workspaceUuid
      `,
        { workspaceUuid }
      );
      return new Set(rows.map(row => row.getResultByName("place_id")));
    } catch (e) {
      console.error(
        "ZenWorkspaceHistoryStorage: Failed to get place IDs:",
        e
      );
      return new Set();
    }
  }

  /**
   * Moves history entries from one workspace to another.
   *
   * @param {number[]} placeIds          - Array of place_id values
   * @param {string}   targetWorkspaceUuid
   */
  async moveHistoryToWorkspace(placeIds, targetWorkspaceUuid) {
    if (!this.#initialized) {
      await this.#promiseInitialized;
    }

    const db = await lazy.PlacesUtils.promiseDBConnection();
    await db.executeTransaction(async () => {
      for (const placeId of placeIds) {
        await db.execute(
          `
          INSERT OR REPLACE INTO zen_history_workspaces (place_id, workspace_uuid, created_at)
          VALUES (:placeId, :workspaceUuid, :now)
        `,
          { placeId, workspaceUuid: targetWorkspaceUuid, now: Date.now() }
        );
      }
    });
  }

  /**
   * Deletes all history entries for a workspace.
   *
   * @param {string} workspaceUuid
   */
  async deleteWorkspaceHistory(workspaceUuid) {
    if (!this.#initialized) {
      await this.#promiseInitialized;
    }

    const db = await lazy.PlacesUtils.promiseDBConnection();
    await db.execute(
      `
      DELETE FROM zen_history_workspaces
      WHERE workspace_uuid = :workspaceUuid
    `,
      { workspaceUuid }
    );
  }
}

export const gZenWorkspaceHistoryStorage = new ZenWorkspaceHistoryStorage();
