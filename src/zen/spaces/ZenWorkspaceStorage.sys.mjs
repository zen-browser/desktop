/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const WORKSPACES_DIR_NAME = "zen-workspaces";

/**
 * Files/directories that each workspace gets its own copy of.
 * These are the data files that provide per-workspace isolation.
 */
const WORKSPACE_DATA_FILES = [
  "logins.json",
  "key4.db",
  "cookies.sqlite",
  "storage.sqlite",
  "extension-preferences.json",
];

const WORKSPACE_DATA_DIRS = ["browser-extension-data"];

/**
 * Manages per-workspace profile directories for isolated data storage.
 *
 * Each workspace (when isolation is enabled) gets a subdirectory under
 * `<profile>/zen-workspaces/<uuid>/` containing its own logins.json,
 * cookies.sqlite, extension storage, etc.
 *
 * The Places database (places.sqlite) is shared and uses workspace-scoping
 * columns rather than per-workspace copies.
 */
export class ZenWorkspaceStorage {
  /** @type {string|null} Currently active workspace UUID for storage routing */
  #activeWorkspaceUuid = null;

  /** @type {Map<string, object>} Cached opened database connections keyed by workspace UUID */
  #connections = new Map();

  /** @type {nsIFile} Profile directory */
  #profileDir = null;

  /** @type {boolean} */
  #initialized = false;

  init() {
    if (this.#initialized) {
      return;
    }
    this.#initialized = true;
    this.#profileDir = Services.dirsvc.get("ProfD", Ci.nsIFile);
  }

  /**
   * Absolute path to the root workspace storage directory.
   * @returns {string}
   */
  get rootPath() {
    return PathUtils.join(this.#profileDir.path, WORKSPACES_DIR_NAME);
  }

  /**
   * Absolute path to a workspace's storage directory.
   * @param {string} workspaceUuid
   * @returns {string}
   */
  workspacePath(workspaceUuid) {
    return PathUtils.join(this.rootPath, workspaceUuid);
  }

  /**
   * Absolute path to a specific data file within a workspace directory.
   * @param {string} workspaceUuid
   * @param {string} filename - e.g. "cookies.sqlite", "logins.json"
   * @returns {string}
   */
  workspaceFilePath(workspaceUuid, filename) {
    return PathUtils.join(this.workspacePath(workspaceUuid), filename);
  }

  /**
   * Gets the active workspace UUID for data routing.
   * @returns {string|null}
   */
  get activeWorkspaceUuid() {
    return this.#activeWorkspaceUuid;
  }

  /**
   * Creates the workspace storage directory and initializes data files.
   *
   * For the default workspace: copies existing global data
   * (logins.json, cookies.sqlite, etc.) from the profile root.
   * For new workspaces: initializes empty data files.
   *
   * @param {string} workspaceUuid
   * @param {object}  [opts]
   * @param {boolean} [opts.isDefault=false] - True if this is the first/default workspace
   * @param {boolean} [opts.isolated=true]   - Whether storage isolation is enabled
   * @returns {Promise<void>}
   */
  async createWorkspaceStorage(
    workspaceUuid,
    { isDefault = false, isolated = true } = {}
  ) {
    if (!isolated) {
      return;
    }

    const wsPath = this.workspacePath(workspaceUuid);
    await IOUtils.makeDirectory(wsPath, { createAncestors: true });

    for (const dataFile of WORKSPACE_DATA_FILES) {
      const targetPath = PathUtils.join(wsPath, dataFile);
      const sourcePath = PathUtils.join(this.#profileDir.path, dataFile);

      if (isDefault && (await IOUtils.exists(sourcePath))) {
        await IOUtils.copy(sourcePath, targetPath);
      } else if (dataFile === "extension-preferences.json") {
        await IOUtils.writeJSON(targetPath, {});
      }
    }

    for (const dataDir of WORKSPACE_DATA_DIRS) {
      const wsDirPath = PathUtils.join(wsPath, dataDir);
      await IOUtils.makeDirectory(wsDirPath, { createAncestors: true });

      if (isDefault) {
        const sourceDir = PathUtils.join(this.#profileDir.path, dataDir);
        if (await IOUtils.exists(sourceDir)) {
          await this.#copyDirectoryContents(sourceDir, wsDirPath);
        }
      }
    }
  }

  /**
   * Deletes a workspace's storage directory and all its data.
   * @param {string} workspaceUuid
   * @returns {Promise<void>}
   */
  async deleteWorkspaceStorage(workspaceUuid) {
    await this.#closeWorkspaceConnections(workspaceUuid);

    const wsPath = this.workspacePath(workspaceUuid);
    if (await IOUtils.exists(wsPath)) {
      await IOUtils.remove(wsPath, { recursive: true });
    }
  }

  /**
   * Switches the active workspace for data routing.
   *
   * Called when the user changes workspaces. All subsequent data operations
   * (logins, cookies, extension storage) will be routed to the new workspace's
   * files.
   *
   * @param {string} newWorkspaceUuid
   * @param {object}  [opts]
   * @param {boolean} [opts.isolated=true]
   * @returns {Promise<void>}
   */
  async switchActiveWorkspace(
    newWorkspaceUuid,
    { isolated = true } = {}
  ) {
    if (this.#activeWorkspaceUuid === newWorkspaceUuid) {
      return;
    }

    const previousUuid = this.#activeWorkspaceUuid;

    if (isolated) {
      const wsPath = this.workspacePath(newWorkspaceUuid);
      if (!(await IOUtils.exists(wsPath))) {
        await this.createWorkspaceStorage(newWorkspaceUuid, {
          isDefault: false,
          isolated: true,
        });
      }
    }

    this.#activeWorkspaceUuid = newWorkspaceUuid;

    Services.obs.notifyObservers(
      { previousUuid, newUuid: newWorkspaceUuid, isolated },
      "zen-workspace-storage-changed"
    );
  }

  /**
   * Opens and caches a Sqlite.jsm connection for a workspace-specific database.
   *
   * @param {string} workspaceUuid - The workspace UUID
   * @param {string} filename      - Database filename (e.g. "cookies.sqlite")
   * @param {object} [opts]        - Options passed to Sqlite.openConnection
   * @returns {Promise<object>}
   */
  async openWorkspaceDB(workspaceUuid, filename, opts = {}) {
    const cacheKey = `${workspaceUuid}:${filename}`;
    if (this.#connections.has(cacheKey)) {
      return this.#connections.get(cacheKey);
    }

    const filePath = this.workspaceFilePath(workspaceUuid, filename);
    const { Sqlite } = ChromeUtils.importESModule(
      "resource://gre/modules/Sqlite.sys.mjs"
    );

    const conn = await Sqlite.openConnection({
      path: filePath,
      ...opts,
    });

    await conn.execute("PRAGMA journal_mode=WAL");
    await conn.execute("PRAGMA foreign_keys=ON");

    this.#connections.set(cacheKey, conn);
    return conn;
  }

  /**
   * Reads a JSON file from a workspace directory.
   * @param {string} workspaceUuid
   * @param {string} filename
   * @returns {Promise<object|null>}
   */
  async readWorkspaceJSON(workspaceUuid, filename) {
    const filePath = this.workspaceFilePath(workspaceUuid, filename);
    if (!(await IOUtils.exists(filePath))) {
      return null;
    }
    try {
      return await IOUtils.readJSON(filePath);
    } catch (e) {
      console.error(`ZenWorkspaceStorage: Error reading ${filePath}:`, e);
      return null;
    }
  }

  /**
   * Writes a JSON file to a workspace directory.
   * @param {string} workspaceUuid
   * @param {string} filename
   * @param {object} data
   * @returns {Promise<void>}
   */
  async writeWorkspaceJSON(workspaceUuid, filename, data) {
    const filePath = this.workspaceFilePath(workspaceUuid, filename);
    const wsPath = this.workspacePath(workspaceUuid);
    await IOUtils.makeDirectory(wsPath, { createAncestors: true });
    await IOUtils.writeJSON(filePath, data);
  }

  /**
   * Lists all workspace UUIDs that have storage directories.
   * @returns {Promise<string[]>}
   */
  async listWorkspaceStorages() {
    const rootPath = this.rootPath;
    if (!(await IOUtils.exists(rootPath))) {
      return [];
    }
    const children = await IOUtils.getChildren(rootPath);
    return children
      .filter(child => {
        try {
          const stat = IOUtils.stat(child);
          return stat.type === "directory";
        } catch {
          return false;
        }
      })
      .map(path => PathUtils.filename(path));
  }

  /**
   * Closes all database connections for a workspace.
   * @param {string} workspaceUuid
   */
  async #closeWorkspaceConnections(workspaceUuid) {
    const prefix = `${workspaceUuid}:`;
    for (const [key, conn] of this.#connections) {
      if (key.startsWith(prefix)) {
        try {
          await conn.close();
        } catch (e) {
          console.error("Error closing workspace DB:", e);
        }
        this.#connections.delete(key);
      }
    }
  }

  /**
   * Recursively copies directory contents.
   */
  async #copyDirectoryContents(source, dest) {
    await IOUtils.makeDirectory(dest, { createAncestors: true });
    const children = await IOUtils.getChildren(source);
    for (const child of children) {
      const childName = PathUtils.filename(child);
      const destChild = PathUtils.join(dest, childName);
      const stat = await IOUtils.stat(child);
      if (stat.type === "directory") {
        await this.#copyDirectoryContents(child, destChild);
      } else {
        await IOUtils.copy(child, destChild);
      }
    }
  }

  /**
   * Shuts down all workspace storage connections. Called during browser shutdown.
   */
  async shutdown() {
    for (const [, conn] of this.#connections) {
      try {
        await conn.close();
      } catch (e) {
        console.error(
          "ZenWorkspaceStorage: Error closing DB during shutdown:",
          e
        );
      }
    }
    this.#connections.clear();
  }
}

export const gZenWorkspaceStorage = new ZenWorkspaceStorage();
