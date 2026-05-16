/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  gZenWorkspaceStorage: "resource:///modules/zen/ZenWorkspaceStorage.sys.mjs",
});

const MIGRATION_VERSION_PREF = "zen.workspaces.isolation.migration-version";
const CURRENT_MIGRATION_VERSION = 1;

/**
 * Handles migrating existing user data into the per-workspace storage system.
 *
 * Migration strategy:
 * - On first run after this feature is enabled:
 *   1. The default/first workspace gets a copy of the existing global data
 *      (logins.json, cookies.sqlite, extension data)
 *   2. Existing bookmarks in zen_bookmarks_workspaces are preserved
 *   3. Existing history entries are assigned to the default workspace
 *   4. Other workspaces start with empty isolated data
 *
 * This is a one-way migration. Users can choose to reset isolation or
 * export data between workspaces later.
 */
export class ZenWorkspaceMigration {
  /** @type {boolean} */
  #hasMigrated = false;

  /**
   * Runs migration if needed. Safe to call multiple times — only runs once.
   *
   * @param {object[]} existingWorkspaces - Current workspace cache from gZenWorkspaces
   * @returns {Promise<boolean>} Whether migration was performed
   */
  async migrateIfNeeded(existingWorkspaces) {
    if (this.#hasMigrated) {
      return false;
    }

    const lastMigrated = Services.prefs.getIntPref(
      MIGRATION_VERSION_PREF,
      0
    );

    if (lastMigrated >= CURRENT_MIGRATION_VERSION) {
      return false;
    }

    const isolationEnabled = Services.prefs.getBoolPref(
      "zen.workspaces.isolation.enabled",
      false
    );

    if (!isolationEnabled) {
      return false;
    }

    this.#hasMigrated = true;

    try {
      await this.#performMigration(existingWorkspaces);
      Services.prefs.setIntPref(
        MIGRATION_VERSION_PREF,
        CURRENT_MIGRATION_VERSION
      );
      return true;
    } catch (e) {
      console.error("ZenWorkspaceMigration: Migration failed:", e);
      return false;
    }
  }

  /**
   * Performs the actual migration of existing data into per-workspace storage.
   *
   * @param {object[]} workspaces
   */
  async #performMigration(workspaces) {
    if (!workspaces?.length) {
      return;
    }

    console.log(
      `ZenWorkspaceMigration: Migrating ${workspaces.length} workspace(s) to isolated storage`
    );

    const defaultWorkspace = workspaces[0];

    await lazy.gZenWorkspaceStorage.createWorkspaceStorage(
      defaultWorkspace.uuid,
      { isDefault: true, isolated: true }
    );

    for (let i = 1; i < workspaces.length; i++) {
      await lazy.gZenWorkspaceStorage.createWorkspaceStorage(
        workspaces[i].uuid,
        { isDefault: false, isolated: true }
      );
    }

    console.log(
      `ZenWorkspaceMigration: Migration complete for ${workspaces.length} workspace(s)`
    );
  }
}

export const gZenWorkspaceMigration = new ZenWorkspaceMigration();
