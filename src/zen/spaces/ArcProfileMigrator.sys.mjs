/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { AppConstants } from "resource://gre/modules/AppConstants.sys.mjs";
import { ChromeProfileMigrator } from "resource:///modules/ChromeProfileMigrator.sys.mjs";
import { ZenArcImporter } from "resource:///modules/zen/ZenArcImporter.sys.mjs";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  MigrationUtils: "resource:///modules/MigrationUtils.sys.mjs",
  ChromeMigrationUtils: "resource:///modules/ChromeMigrationUtils.sys.mjs",
  NetUtil: "resource://gre/modules/NetUtil.sys.mjs",
});

/**
 * Arc browser profile migrator.
 * Seamlessly integrates Arc into Zen's migration system.
 */
export class ArcProfileMigrator extends ChromeProfileMigrator {
  static get key() {
    return "arc";
  }

  static get displayName() {
    return "Arc";
  }

  static get displayNameL10nID() {
    // No Arc-specific migration string ships in Firefox's migrationWizard.ftl.
    // Let MigrationUtils use displayName instead of rendering an unknown ID.
    return null;
  }

  static get brandImage() {
    return "chrome://browser/content/zen-images/favicons/arc.png";
  }

  get enabled() {
    return Services.prefs.getBoolPref("browser.migrate.arc.enabled", true);
  }

  async hasPermissions() {
    return true;
  }

  async canGetPermissions() {
    return true;
  }

  _chromeUserDataPathSuffix = "Arc";
  _keychainServiceName = "Arc Safe Storage";
  _keychainAccountName = "Arc";

  async isSourceAvailable() {
    if (await ZenArcImporter.isArcAvailable()) {
      return true;
    }
    const folders = await this.#getAllProfileFolders();
    return folders.length > 0;
  }

  async getLastUsedDate() {
    try {
      const sidebarPath = ZenArcImporter.getSidebarFilePath();
      if (sidebarPath && (await IOUtils.exists(sidebarPath))) {
        const info = await IOUtils.stat(sidebarPath);
        return new Date(info.lastModified);
      }
    } catch (e) {}
    return new Date();
  }

  async _getChromeUserDataPathIfExists(noRemapping = false) {
    if (this._chromeUserDataPath) {
      return this._chromeUserDataPath;
    }

    const candidates = [];
    try {
      const sidebarPath = ZenArcImporter.getSidebarFilePath();
      if (sidebarPath) {
        const arcDir = PathUtils.parent(sidebarPath);
        candidates.push(PathUtils.join(arcDir, "User Data"));
        candidates.push(arcDir);
        const parentDir = PathUtils.parent(arcDir);
        if (parentDir) {
          candidates.push(PathUtils.join(parentDir, "User Data"));
          candidates.push(PathUtils.join(parentDir, "Arc", "User Data"));
        }
      }
    } catch (e) {}

    if (AppConstants.platform === "win") {
      try {
        let localAppData;
        try {
          localAppData = Services.dirsvc.get("LocalAppData", Ci.nsIFile).path;
        } catch {
          localAppData = Services.env.get("LOCALAPPDATA");
        }
        if (localAppData) {
          candidates.push(PathUtils.join(localAppData, "Arc", "User Data"));
          candidates.push(PathUtils.join(localAppData, "TheBrowserCompany", "Arc", "User Data"));
        }
      } catch (e) {}
    } else if (AppConstants.platform === "macosx") {
      try {
        const uLibDir = Services.dirsvc.get("ULibDir", Ci.nsIFile).path;
        candidates.push(PathUtils.join(uLibDir, "Application Support", "Arc", "User Data"));
        candidates.push(PathUtils.join(uLibDir, "Application Support", "Arc"));
      } catch (e) {}
    }

    for (const candidate of candidates) {
      try {
        if (
          (await IOUtils.exists(PathUtils.join(candidate, "Default"))) ||
          (await IOUtils.exists(PathUtils.join(candidate, "Local State")))
        ) {
          this._chromeUserDataPath = candidate;
          return candidate;
        }
      } catch (e) {}
    }

    try {
      return await super._getChromeUserDataPathIfExists(noRemapping);
    } catch (e) {
      return null;
    }
  }

  async getSourceProfiles() {
    // Returning null skips profile selection so all profiles/spaces are imported together.
    return null;
  }

  async #getAllProfileFolders() {
    const dataPath = await this._getChromeUserDataPathIfExists();
    if (!dataPath || !(await IOUtils.exists(dataPath))) {
      return [];
    }
    const folders = new Set();
    const defaultFolder = PathUtils.join(dataPath, "Default");
    if (await IOUtils.exists(defaultFolder)) {
      folders.add(defaultFolder);
    }

    // 1. Discover profiles listed in Arc's Local State
    try {
      const localStatePath = PathUtils.join(dataPath, "Local State");
      if (await IOUtils.exists(localStatePath)) {
        const raw = await IOUtils.readUTF8(localStatePath);
        const ls = JSON.parse(raw);
        const infoCache = ls?.profile?.info_cache || {};
        for (const dirName of Object.keys(infoCache)) {
          const folderPath = PathUtils.join(dataPath, dirName);
          if (await IOUtils.exists(folderPath)) {
            folders.add(folderPath);
          }
        }
      }
    } catch (e) {}

    // 2. Discover any Profile * or subfolder containing History / Login Data
    try {
      const children = await IOUtils.getChildren(dataPath);
      for (const child of children) {
        const leaf = PathUtils.filename(child);
        if (
          leaf.startsWith("Profile ") ||
          (await IOUtils.exists(PathUtils.join(child, "History"))) ||
          (await IOUtils.exists(PathUtils.join(child, "Login Data"))) ||
          (await IOUtils.exists(PathUtils.join(child, "Login Data For Account")))
        ) {
          folders.add(child);
        }
      }
    } catch (e) {}

    return Array.from(folders);
  }

  async #getPasswordsResource() {
    const profileFolders = await this.#getAllProfileFolders();
    const validLoginPaths = [];
    for (const folder of profileFolders) {
      for (const dbName of ["Login Data", "Login Data For Account"]) {
        const p = PathUtils.join(folder, dbName);
        if (await IOUtils.exists(p)) {
          validLoginPaths.push(p);
        }
      }
    }
    if (!validLoginPaths.length) {
      return null;
    }

    const dataPath = await this._getChromeUserDataPathIfExists();
    const localStatePath = dataPath ? PathUtils.join(dataPath, "Local State") : null;

    return {
      type: lazy.MigrationUtils.resourceTypes.PASSWORDS,
      async migrate(aCallback) {
        let allLogins = [];
        let loginCrypto = null;
        try {
          if (AppConstants.platform === "win") {
            const { ChromeWindowsLoginCrypto } = ChromeUtils.importESModule(
              "resource:///modules/ChromeWindowsLoginCrypto.sys.mjs"
            );
            // Pass localStatePath so v10 AES-GCM master key decryption works for Arc!
            loginCrypto = new ChromeWindowsLoginCrypto(localStatePath || "Arc");
          } else if (AppConstants.platform === "macosx") {
            const { ChromeMacOSLoginCrypto } = ChromeUtils.importESModule(
              "resource:///modules/ChromeMacOSLoginCrypto.sys.mjs"
            );
            loginCrypto = new ChromeMacOSLoginCrypto(
              "Arc Safe Storage",
              "Arc",
              null
            );
          } else {
            aCallback(false);
            return;
          }
        } catch (ex) {
          console.error("[ArcProfileMigrator]: Error initializing login crypto:", ex);
          aCallback(false);
          return;
        }

        const kValidSchemes = new Set(["https", "http", "ftp"]);
        const fallbackCreationDate = new Date();

        for (const loginPath of validLoginPaths) {
          let tempFilePath = null;
          try {
            tempFilePath = await IOUtils.createUniqueFile(PathUtils.tempDir, "ArcLoginData.tmp");
            await IOUtils.copy(loginPath, tempFilePath);
            const query = `SELECT origin_url, action_url, username_element, username_value,
              password_element, password_value, signon_realm, scheme, date_created,
              times_used FROM logins WHERE blacklisted_by_user = 0`;
            const rows = await lazy.MigrationUtils.getRowsFromDBWithoutLocks(
              tempFilePath,
              "Arc passwords",
              query
            );
            if (rows) {
              for (const row of rows) {
                try {
                  const originUrlStr = row.getResultByName("origin_url");
                  const originUri = lazy.NetUtil.newURI(originUrlStr);
                  if (!kValidSchemes.has(originUri.scheme)) {
                    continue;
                  }
                  const encryptedVal = row.getResultByName("password_value");
                  const password = await loginCrypto.decryptData(encryptedVal, null);
                  if (!password) {
                    continue;
                  }
                  const loginInfo = {
                    username: row.getResultByName("username_value") || "",
                    password: password || "",
                    origin: originUri.prePath,
                    formActionOrigin: row.getResultByName("action_url") || "",
                    httpRealm: null,
                    usernameElement: row.getResultByName("username_element") || "",
                    passwordElement: row.getResultByName("password_element") || "",
                    timeCreated: lazy.ChromeMigrationUtils.chromeTimeToDate(
                      row.getResultByName("date_created") + 0,
                      fallbackCreationDate
                    ).getTime(),
                    timesUsed: row.getResultByName("times_used") + 0,
                  };
                  allLogins.push(loginInfo);
                } catch (rowEx) {}
              }
            }
          } catch (e) {
            console.error("[ArcProfileMigrator]: Error reading logins from", loginPath, e);
          } finally {
            if (tempFilePath) {
              try {
                await IOUtils.remove(tempFilePath);
              } catch (e) {}
            }
          }
        }

        try {
          if (loginCrypto?.finalize) {
            loginCrypto.finalize();
          }
          if (allLogins.length) {
            await lazy.MigrationUtils.insertLoginsWrapper(allLogins);
          }
          aCallback(true);
        } catch (e) {
          console.error("[ArcProfileMigrator]: Error inserting logins:", e);
          aCallback(false);
        }
      },
    };
  }

  async #getHistoryResource() {
    const profileFolders = await this.#getAllProfileFolders();
    const validHistoryPaths = [];
    for (const folder of profileFolders) {
      const p = PathUtils.join(folder, "History");
      if (await IOUtils.exists(p)) {
        validHistoryPaths.push(p);
      }
    }
    if (!validHistoryPaths.length) {
      return null;
    }

    return {
      type: lazy.MigrationUtils.resourceTypes.HISTORY,
      async migrate(aCallback) {
        let allVisits = [];
        const maxAge = lazy.ChromeMigrationUtils.dateToChromeTime(
          Date.now() - lazy.MigrationUtils.HISTORY_MAX_AGE_IN_MILLISECONDS
        );
        const query = `SELECT url, title, last_visit_time, typed_count FROM urls WHERE hidden = 0 AND last_visit_time > ${maxAge} ORDER BY last_visit_time DESC LIMIT 10000`;

        for (const historyPath of validHistoryPaths) {
          let tempFilePath = null;
          try {
            tempFilePath = await IOUtils.createUniqueFile(PathUtils.tempDir, "ArcHistory.tmp");
            await IOUtils.copy(historyPath, tempFilePath);
            const rows = await lazy.MigrationUtils.getRowsFromDBWithoutLocks(
              tempFilePath,
              "Arc history",
              query
            );
            if (rows) {
              for (const row of rows) {
                try {
                  const url = row.getResultByName("url");
                  const title = row.getResultByName("title") || "";
                  const lastVisit = row.getResultByName("last_visit_time") + 0;
                  const date = lazy.ChromeMigrationUtils.chromeTimeToDate(lastVisit);
                  allVisits.push({
                    url,
                    title,
                    visits: [
                      {
                        transitionType: Ci.nsINavHistoryService.TRANSITION_LINK,
                        date: date.getTime() * 1000,
                      },
                    ],
                  });
                } catch (e) {}
              }
            }
          } catch (e) {
            console.error("[ArcProfileMigrator]: Error reading history from", historyPath, e);
          } finally {
            if (tempFilePath) {
              try {
                await IOUtils.remove(tempFilePath);
              } catch (e) {}
            }
          }
        }

        try {
          if (allVisits.length) {
            await lazy.MigrationUtils.insertVisitsWrapper(allVisits);
          }
          aCallback(true);
        } catch (e) {
          console.error("[ArcProfileMigrator]: Error inserting visits:", e);
          aCallback(false);
        }
      },
    };
  }

  async getResources(aProfile) {
    let resources = [];

    // 1. Arc Spaces, Themes, Folders & Tabs (as BOOKMARKS)
    if (await ZenArcImporter.isArcAvailable()) {
      resources.push({
        type: lazy.MigrationUtils.resourceTypes.BOOKMARKS,
        async migrate(aCallback) {
          try {
            await ZenArcImporter.importFromArc(null, "all");
            aCallback(true);
          } catch (e) {
            console.error("[ArcProfileMigrator]: Error migrating Arc spaces:", e);
            aCallback(false);
          }
        },
      });
    }

    // 2. Arc Passwords
    try {
      const passwordsResource = await this.#getPasswordsResource();
      if (passwordsResource) {
        resources.push(passwordsResource);
      }
    } catch (e) {
      console.error("[ArcProfileMigrator]: Error querying passwords resource:", e);
    }

    // 3. Arc History
    try {
      const historyResource = await this.#getHistoryResource();
      if (historyResource) {
        resources.push(historyResource);
      }
    } catch (e) {
      console.error("[ArcProfileMigrator]: Error querying history resource:", e);
    }

    return resources;
  }
}
