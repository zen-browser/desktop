// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
var ZenPinnedTabsStorage = {
  _saveCache: [],

  async init() {
    await this._ensureTable();
  },

  async _ensureTable() {
    await PlacesUtils.withConnectionWrapper('ZenPinnedTabsStorage._ensureTable', async (db) => {
      // Create the pins table if it doesn't exist
      await db.execute(`
        CREATE TABLE IF NOT EXISTS zen_pins (
      id INTEGER PRIMARY KEY,
      uuid TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      url TEXT,
      container_id INTEGER,
      workspace_uuid TEXT,
      position INTEGER NOT NULL DEFAULT 0,
      is_essential BOOLEAN NOT NULL DEFAULT 0,
      is_group BOOLEAN NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
          )
      `);

      const columns = await db.execute(`PRAGMA table_info(zen_pins)`);
      const columnNames = columns.map((row) => row.getResultByName('name'));

      // Helper function to add column if it doesn't exist
      const addColumnIfNotExists = async (columnName, definition) => {
        if (!columnNames.includes(columnName)) {
          await db.execute(`ALTER TABLE zen_pins ADD COLUMN ${columnName} ${definition}`);
        }
      };

      await addColumnIfNotExists('edited_title', 'BOOLEAN NOT NULL DEFAULT 0');
      await addColumnIfNotExists('is_folder_collapsed', 'BOOLEAN NOT NULL DEFAULT 0');
      await addColumnIfNotExists('folder_icon', 'TEXT DEFAULT NULL');
      await addColumnIfNotExists('folder_parent_uuid', 'TEXT DEFAULT NULL');

      await db.execute(`
        CREATE INDEX IF NOT EXISTS idx_zen_pins_uuid ON zen_pins(uuid)
      `);

      await db.execute(`
        CREATE TABLE IF NOT EXISTS zen_pins_changes (
          uuid TEXT PRIMARY KEY,
          timestamp INTEGER NOT NULL
        )
      `);

      await db.execute(`
        CREATE INDEX IF NOT EXISTS idx_zen_pins_changes_uuid ON zen_pins_changes(uuid)
      `);

      this._resolveInitialized();
    });
  },

  /**
   * Private helper method to notify observers with a list of changed UUIDs.
   * @param {string} event - The observer event name.
   * @param {Array<string>} uuids - Array of changed workspace UUIDs.
   */
  _notifyPinsChanged(event, uuids) {
    if (uuids.length === 0) return; // No changes to notify

    // Convert the array of UUIDs to a JSON string
    const data = JSON.stringify(uuids);

    Services.obs.notifyObservers(null, event, data);
  },

  async savePin(pin, notifyObservers = true) {
    // If we find the exact same pin in the cache, skip saving
    const existingIndex = this._saveCache.findIndex((cachedPin) => cachedPin.uuid === pin.uuid);
    if (existingIndex !== -1) {
      const existingPin = this._saveCache[existingIndex];
      const isSame = Object.keys(pin).every((key) => pin[key] === existingPin[key]);
      if (isSame) {
        return; // No changes, skip saving
      } else {
        // Update the cached pin
        this._saveCache[existingIndex] = pin;
      }
    } else {
      // Add to cache
      this._saveCache.push(pin);
    }

    const changedUUIDs = new Set();

    await PlacesUtils.withConnectionWrapper('ZenPinnedTabsStorage.savePin', async (db) => {
      await db.executeTransaction(async () => {
        const now = Date.now();

        let newPosition;
        if ('position' in pin && Number.isFinite(pin.position)) {
          newPosition = pin.position;
        } else {
          // Get the maximum position within the same parent group (or null for root level)
          const maxPositionResult = await db.execute(
            `
            SELECT MAX("position") as max_position
            FROM zen_pins
            WHERE COALESCE(folder_parent_uuid, '') = COALESCE(:folder_parent_uuid, '')
          `,
            { folder_parent_uuid: pin.parentUuid || null }
          );
          const maxPosition = maxPositionResult[0].getResultByName('max_position') || 0;
          newPosition = maxPosition + 1000;
        }

        // Insert or replace the pin
        await db.executeCached(
          `
          INSERT OR REPLACE INTO zen_pins (
            uuid, title, url, container_id, workspace_uuid, position,
            is_essential, is_group, folder_parent_uuid, edited_title, created_at,
            updated_at, is_folder_collapsed, folder_icon
          ) VALUES (
            :uuid, :title, :url, :container_id, :workspace_uuid, :position,
            :is_essential, :is_group, :folder_parent_uuid, :edited_title,
            COALESCE((SELECT created_at FROM zen_pins WHERE uuid = :uuid), :now),
            :now, :is_folder_collapsed, :folder_icon
          )
        `,
          {
            uuid: pin.uuid,
            title: pin.title,
            url: pin.isGroup ? '' : pin.url,
            container_id: pin.containerTabId || null,
            workspace_uuid: pin.workspaceUuid || null,
            position: newPosition,
            is_essential: pin.isEssential || false,
            is_group: pin.isGroup || false,
            folder_parent_uuid: pin.parentUuid || null,
            edited_title: pin.editedTitle || false,
            now,
            folder_icon: pin.folderIcon || null,
            is_folder_collapsed: pin.isFolderCollapsed || false,
          }
        );

        await db.execute(
          `
          INSERT OR REPLACE INTO zen_pins_changes (uuid, timestamp)
          VALUES (:uuid, :timestamp)
        `,
          {
            uuid: pin.uuid,
            timestamp: Math.floor(now / 1000),
          }
        );

        changedUUIDs.add(pin.uuid);
        await this.updateLastChangeTimestamp(db);
      });
    });

    if (notifyObservers) {
      this._notifyPinsChanged('zen-pin-updated', Array.from(changedUUIDs));
    }
  },

  async getPins() {
    const db = await PlacesUtils.promiseDBConnection();
    const rows = await db.executeCached(`
      SELECT * FROM zen_pins
      ORDER BY position ASC
    `);
    return rows.map((row) => ({
      uuid: row.getResultByName('uuid'),
      title: row.getResultByName('title'),
      url: row.getResultByName('url'),
      containerTabId: row.getResultByName('container_id'),
      workspaceUuid: row.getResultByName('workspace_uuid'),
      position: row.getResultByName('position'),
      isEssential: Boolean(row.getResultByName('is_essential')),
      isGroup: Boolean(row.getResultByName('is_group')),
      parentUuid: row.getResultByName('folder_parent_uuid'),
      editedTitle: Boolean(row.getResultByName('edited_title')),
      folderIcon: row.getResultByName('folder_icon'),
      isFolderCollapsed: Boolean(row.getResultByName('is_folder_collapsed')),
    }));
  },

  /**
   * Create a new group
   * @param {string} title - The title of the group
   * @param {string} workspaceUuid - The workspace UUID (optional)
   * @param {string} parentUuid - The parent group UUID (optional, null for root level)
   * @param {number} position - The position of the group (optional, will auto-calculate if not provided)
   * @param {boolean} notifyObservers - Whether to notify observers (default: true)
   * @returns {Promise<string>} The UUID of the created group
   */
  async createGroup(
    title,
    icon = null,
    isCollapsed = false,
    workspaceUuid = null,
    parentUuid = null,
    position = null,
    notifyObservers = true
  ) {
    if (!title || typeof title !== 'string') {
      throw new Error('Group title is required and must be a string');
    }

    const groupUuid = gZenUIManager.generateUuidv4();

    const groupPin = {
      uuid: groupUuid,
      title,
      folderIcon: icon || null,
      isFolderCollapsed: isCollapsed || false,
      workspaceUuid,
      parentUuid,
      position,
      isGroup: true,
      isEssential: false,
      editedTitle: true, // Group titles are always considered edited
    };

    await this.savePin(groupPin, notifyObservers);
    return groupUuid;
  },

  /**
   * Add an existing tab/pin to a group
   * @param {string} tabUuid - The UUID of the tab to add to the group
   * @param {string} groupUuid - The UUID of the target group
   * @param {number} position - The position within the group (optional, will append if not provided)
   * @param {boolean} notifyObservers - Whether to notify observers (default: true)
   */
  async addTabToGroup(tabUuid, groupUuid, position = null, notifyObservers = true) {
    if (!tabUuid || !groupUuid) {
      throw new Error('Both tabUuid and groupUuid are required');
    }

    const changedUUIDs = new Set();

    await PlacesUtils.withConnectionWrapper('ZenPinnedTabsStorage.addTabToGroup', async (db) => {
      await db.executeTransaction(async () => {
        // Verify the group exists and is actually a group
        const groupCheck = await db.execute(
          `SELECT is_group FROM zen_pins WHERE uuid = :groupUuid`,
          { groupUuid }
        );

        if (groupCheck.length === 0) {
          throw new Error(`Group with UUID ${groupUuid} does not exist`);
        }

        if (!groupCheck[0].getResultByName('is_group')) {
          throw new Error(`Pin with UUID ${groupUuid} is not a group`);
        }

        const tabCheck = await db.execute(`SELECT uuid FROM zen_pins WHERE uuid = :tabUuid`, {
          tabUuid,
        });

        if (tabCheck.length === 0) {
          throw new Error(`Tab with UUID ${tabUuid} does not exist`);
        }

        const now = Date.now();
        let newPosition;

        if (position !== null && Number.isFinite(position)) {
          newPosition = position;
        } else {
          // Get the maximum position within the group
          const maxPositionResult = await db.execute(
            `SELECT MAX("position") as max_position FROM zen_pins WHERE folder_parent_uuid = :groupUuid`,
            { groupUuid }
          );
          const maxPosition = maxPositionResult[0].getResultByName('max_position') || 0;
          newPosition = maxPosition + 1000;
        }

        await db.execute(
          `
          UPDATE zen_pins
          SET folder_parent_uuid = :groupUuid,
              position = :newPosition,
              updated_at = :now
          WHERE uuid = :tabUuid
          `,
          {
            tabUuid,
            groupUuid,
            newPosition,
            now,
          }
        );

        changedUUIDs.add(tabUuid);

        await db.execute(
          `
          INSERT OR REPLACE INTO zen_pins_changes (uuid, timestamp)
          VALUES (:uuid, :timestamp)
          `,
          {
            uuid: tabUuid,
            timestamp: Math.floor(now / 1000),
          }
        );

        await this.updateLastChangeTimestamp(db);
      });
    });

    if (notifyObservers) {
      this._notifyPinsChanged('zen-pin-updated', Array.from(changedUUIDs));
    }
  },

  /**
   * Remove a tab from its group (move to root level)
   * @param {string} tabUuid - The UUID of the tab to remove from its group
   * @param {number} newPosition - The new position at root level (optional, will append if not provided)
   * @param {boolean} notifyObservers - Whether to notify observers (default: true)
   */
  async removeTabFromGroup(tabUuid, newPosition = null, notifyObservers = true) {
    if (!tabUuid) {
      throw new Error('tabUuid is required');
    }

    const changedUUIDs = new Set();

    await PlacesUtils.withConnectionWrapper(
      'ZenPinnedTabsStorage.removeTabFromGroup',
      async (db) => {
        await db.executeTransaction(async () => {
          // Verify the tab exists and is in a group
          const tabCheck = await db.execute(
            `SELECT folder_parent_uuid FROM zen_pins WHERE uuid = :tabUuid`,
            { tabUuid }
          );

          if (tabCheck.length === 0) {
            throw new Error(`Tab with UUID ${tabUuid} does not exist`);
          }

          if (!tabCheck[0].getResultByName('folder_parent_uuid')) {
            return;
          }

          const now = Date.now();
          let finalPosition;

          if (newPosition !== null && Number.isFinite(newPosition)) {
            finalPosition = newPosition;
          } else {
            // Get the maximum position at root level (where folder_parent_uuid is null)
            const maxPositionResult = await db.execute(
              `SELECT MAX("position") as max_position FROM zen_pins WHERE folder_parent_uuid IS NULL`
            );
            const maxPosition = maxPositionResult[0].getResultByName('max_position') || 0;
            finalPosition = maxPosition + 1000;
          }

          // Update the tab to be at root level
          await db.execute(
            `
          UPDATE zen_pins
          SET folder_parent_uuid = NULL,
              position = :newPosition,
              updated_at = :now
          WHERE uuid = :tabUuid
          `,
            {
              tabUuid,
              newPosition: finalPosition,
              now,
            }
          );

          changedUUIDs.add(tabUuid);

          // Record the change
          await db.execute(
            `
          INSERT OR REPLACE INTO zen_pins_changes (uuid, timestamp)
          VALUES (:uuid, :timestamp)
          `,
            {
              uuid: tabUuid,
              timestamp: Math.floor(now / 1000),
            }
          );

          await this.updateLastChangeTimestamp(db);
        });
      }
    );

    if (notifyObservers) {
      this._notifyPinsChanged('zen-pin-updated', Array.from(changedUUIDs));
    }
  },

  async removePin(uuid, notifyObservers = true) {
    const cachedIndex = this._saveCache.findIndex((cachedPin) => cachedPin.uuid === uuid);
    if (cachedIndex !== -1) {
      this._saveCache.splice(cachedIndex, 1);
    }

    const changedUUIDs = [uuid];

    await PlacesUtils.withConnectionWrapper('ZenPinnedTabsStorage.removePin', async (db) => {
      await db.executeTransaction(async () => {
        // Get all child UUIDs first for change tracking
        const children = await db.execute(
          `SELECT uuid FROM zen_pins WHERE folder_parent_uuid = :uuid`,
          {
            uuid,
          }
        );

        // Add child UUIDs to changedUUIDs array
        for (const child of children) {
          changedUUIDs.push(child.getResultByName('uuid'));
        }

        // Delete the pin/group itself
        await db.execute(`DELETE FROM zen_pins WHERE uuid = :uuid`, { uuid });

        // Record the changes
        const now = Math.floor(Date.now() / 1000);
        for (const changedUuid of changedUUIDs) {
          await db.execute(
            `
            INSERT OR REPLACE INTO zen_pins_changes (uuid, timestamp)
            VALUES (:uuid, :timestamp)
          `,
            {
              uuid: changedUuid,
              timestamp: now,
            }
          );
        }

        await this.updateLastChangeTimestamp(db);
      });
    });

    if (notifyObservers) {
      this._notifyPinsChanged('zen-pin-removed', changedUUIDs);
    }
  },

  async wipeAllPins() {
    await PlacesUtils.withConnectionWrapper('ZenPinnedTabsStorage.wipeAllPins', async (db) => {
      await db.execute(`DELETE FROM zen_pins`);
      await db.execute(`DELETE FROM zen_pins_changes`);
      await this.updateLastChangeTimestamp(db);
    });
  },

  async markChanged(uuid) {
    await PlacesUtils.withConnectionWrapper('ZenPinnedTabsStorage.markChanged', async (db) => {
      const now = Date.now();
      await db.execute(
        `
        INSERT OR REPLACE INTO zen_pins_changes (uuid, timestamp)
        VALUES (:uuid, :timestamp)
      `,
        {
          uuid,
          timestamp: Math.floor(now / 1000),
        }
      );
    });
  },

  async getChangedIDs() {
    const db = await PlacesUtils.promiseDBConnection();
    const rows = await db.execute(`
      SELECT uuid, timestamp FROM zen_pins_changes
    `);
    const changes = {};
    for (const row of rows) {
      changes[row.getResultByName('uuid')] = row.getResultByName('timestamp');
    }
    return changes;
  },

  async clearChangedIDs() {
    await PlacesUtils.withConnectionWrapper('ZenPinnedTabsStorage.clearChangedIDs', async (db) => {
      await db.execute(`DELETE FROM zen_pins_changes`);
    });
  },

  shouldReorderPins(before, current, after) {
    const minGap = 1; // Minimum allowed gap between positions
    return (
      (before !== null && current - before < minGap) || (after !== null && after - current < minGap)
    );
  },

  async reorderAllPins(db, changedUUIDs) {
    const pins = await db.execute(`
      SELECT uuid
      FROM zen_pins
      ORDER BY position ASC
    `);

    for (let i = 0; i < pins.length; i++) {
      const newPosition = (i + 1) * 1000; // Use large increments
      await db.execute(
        `
        UPDATE zen_pins
        SET position = :newPosition
        WHERE uuid = :uuid
      `,
        { newPosition, uuid: pins[i].getResultByName('uuid') }
      );
      changedUUIDs.add(pins[i].getResultByName('uuid'));
    }
  },

  async updateLastChangeTimestamp(db) {
    const now = Date.now();
    await db.execute(
      `
      INSERT OR REPLACE INTO moz_meta (key, value)
      VALUES ('zen_pins_last_change', :now)
    `,
      { now }
    );
  },

  async getLastChangeTimestamp() {
    const db = await PlacesUtils.promiseDBConnection();
    const result = await db.executeCached(`
      SELECT value FROM moz_meta WHERE key = 'zen_pins_last_change'
    `);
    return result.length ? parseInt(result[0].getResultByName('value'), 10) : 0;
  },

  async updatePinPositions(pins) {
    const changedUUIDs = new Set();

    await PlacesUtils.withConnectionWrapper(
      'ZenPinnedTabsStorage.updatePinPositions',
      async (db) => {
        await db.executeTransaction(async () => {
          const now = Date.now();

          for (let i = 0; i < pins.length; i++) {
            const pin = pins[i];
            const newPosition = (i + 1) * 1000;

            await db.execute(
              `
            UPDATE zen_pins
            SET position = :newPosition
            WHERE uuid = :uuid
          `,
              { newPosition, uuid: pin.uuid }
            );

            changedUUIDs.add(pin.uuid);

            // Record the change
            await db.execute(
              `
            INSERT OR REPLACE INTO zen_pins_changes (uuid, timestamp)
            VALUES (:uuid, :timestamp)
          `,
              {
                uuid: pin.uuid,
                timestamp: Math.floor(now / 1000),
              }
            );
          }

          await this.updateLastChangeTimestamp(db);
        });
      }
    );

    this._notifyPinsChanged('zen-pin-updated', Array.from(changedUUIDs));
  },

  async updatePinTitle(uuid, newTitle, isEdited = true, notifyObservers = true) {
    if (!uuid || typeof newTitle !== 'string') {
      throw new Error('Invalid parameters: uuid and newTitle are required');
    }

    const changedUUIDs = new Set();

    await PlacesUtils.withConnectionWrapper('ZenPinnedTabsStorage.updatePinTitle', async (db) => {
      await db.executeTransaction(async () => {
        const now = Date.now();

        // Update the pin's title and edited_title flag
        const result = await db.execute(
          `
            UPDATE zen_pins
            SET title = :newTitle,
                edited_title = :isEdited,
                updated_at = :now
            WHERE uuid = :uuid
          `,
          {
            uuid,
            newTitle,
            isEdited,
            now,
          }
        );

        // Only proceed with change tracking if a row was actually updated
        if (result.rowsAffected > 0) {
          changedUUIDs.add(uuid);

          // Record the change
          await db.execute(
            `
              INSERT OR REPLACE INTO zen_pins_changes (uuid, timestamp)
          VALUES (:uuid, :timestamp)
            `,
            {
              uuid,
              timestamp: Math.floor(now / 1000),
            }
          );

          await this.updateLastChangeTimestamp(db);
        }
      });
    });

    if (notifyObservers && changedUUIDs.size > 0) {
      this._notifyPinsChanged('zen-pin-updated', Array.from(changedUUIDs));
    }
  },

  async __dropTables() {
    await PlacesUtils.withConnectionWrapper('ZenPinnedTabsStorage.__dropTables', async (db) => {
      await db.execute(`DROP TABLE IF EXISTS zen_pins`);
      await db.execute(`DROP TABLE IF EXISTS zen_pins_changes`);
    });
  },
};

ZenPinnedTabsStorage.promiseInitialized = new Promise((resolve) => {
  ZenPinnedTabsStorage._resolveInitialized = resolve;
  ZenPinnedTabsStorage.init();
});
