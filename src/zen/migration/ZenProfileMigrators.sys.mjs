/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { AppConstants } from "resource://gre/modules/AppConstants.sys.mjs";
import { MigrationUtils } from "moz-src:///browser/components/migration/MigrationUtils.sys.mjs";
import { ChromeProfileMigrator } from "moz-src:///browser/components/migration/ChromeProfileMigrator.sys.mjs";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  ZenMigrationUtils: "resource:///modules/zen/ZenMigrationUtils.sys.mjs",
});

ChromeUtils.defineLazyGetter(
  lazy,
  "l10n",
  () => new Localization(["browser/zen-migration.ftl"])
);

const kAllProfilesId = "zen-all-profiles";

/**
 * Adds an "All profiles" entry to a Chromium migrator's profile list.
 *
 * @param {typeof ChromeProfileMigrator} Base
 */
function withAllProfiles(Base) {
  return class extends Base {
    async getSourceProfiles() {
      const profiles = await super.getSourceProfiles();
      if (!Array.isArray(profiles) || profiles.length < 2) {
        return profiles;
      }
      const name = await lazy.l10n
        .formatValue("migration-zen-all-profiles-label")
        .catch(() => null);
      return [
        { id: kAllProfilesId, name: name || "All profiles" },
        ...profiles,
      ];
    }

    async getResources(aProfile) {
      if (aProfile?.id !== kAllProfilesId) {
        return super.getResources(aProfile);
      }
      const byType = new Map();
      for (const profile of await super.getSourceProfiles()) {
        for (const resource of await this.getResources(profile)) {
          if (!byType.has(resource.type)) {
            byType.set(resource.type, []);
          }
          byType.get(resource.type).push(resource);
        }
      }
      return [...byType].map(([type, resources]) => ({
        type,
        migrate(aCallback) {
          (async () => {
            let success = true;
            let spaces = 0;
            for (const resource of resources) {
              const ok = await new Promise(resolve =>
                resource.migrate(resolve)
              );
              success &&= !!ok;
              if (type === MigrationUtils.resourceTypes.ZEN_SPACES) {
                spaces += lazy.ZenMigrationUtils.lastImportedSpaceCount;
              }
            }
            if (type === MigrationUtils.resourceTypes.ZEN_SPACES) {
              lazy.ZenMigrationUtils.lastImportedSpaceCount = spaces;
            }
            return success;
          })().then(aCallback, ex => {
            console.error(ex);
            aCallback(false);
          });
        },
      }));
    }
  };
}

/**
 * Arc keeps its web data in a regular Chromium "User Data" directory, so the
 * Chrome migrator handles bookmarks, history, passwords and form data. Its
 * sidebar (spaces, pinned tabs, folders and favorites) lives next to it in
 * StorableSidebar.json, shared by every Arc profile, which this migrator
 * turns into Zen spaces. Each space is tagged with its Arc profile, so only
 * the chosen profile's spaces are imported, and profiles other than the main
 * one get a container of their own.
 */
export class ArcProfileMigrator extends withAllProfiles(ChromeProfileMigrator) {
  static get key() {
    return "arc";
  }

  static get displayNameL10nID() {
    return "migration-wizard-migrator-display-name-arc";
  }

  static get brandImage() {
    return "chrome://browser/content/zen-images/migration/arc.png";
  }

  _chromeUserDataPathSuffix = "Arc";
  _keychainServiceName = "Arc Safe Storage";
  _keychainAccountName = "Arc";

  #packagedDataPath = null;

  /**
   * On Windows Arc is an MSIX package, so when none of the fixed locations
   * exist its data is looked for under whichever package folder it got.
   *
   * @param {boolean} [noRemapping=false]
   * @returns {Promise<string|null>}
   */
  async _getChromeUserDataPathIfExists(noRemapping = false) {
    const path = await super._getChromeUserDataPathIfExists(noRemapping);
    if (path || AppConstants.platform != "win") {
      return path;
    }
    this.#packagedDataPath ??= lazy.ZenMigrationUtils.findPackagedUserDataPath(
      PathUtils.join(
        Services.dirsvc.get("LocalAppData", Ci.nsIFile).path,
        "Packages"
      ),
      "TheBrowserCompany.Arc",
      this._chromeUserDataPathSuffix
    );
    this._chromeUserDataPath = await this.#packagedDataPath;
    return this._chromeUserDataPath;
  }

  async getResources(aProfile) {
    const resources = await super.getResources(aProfile);
    const sidebar = await this._getSidebarResource(aProfile);
    if (sidebar) {
      resources.push(sidebar);
    }
    return resources;
  }

  async getLastUsedDate() {
    const dates = [await super.getLastUsedDate()];
    const sidebarPath = await this._getSidebarPath();
    if (sidebarPath) {
      const info = await IOUtils.stat(sidebarPath).catch(() => null);
      if (info) {
        dates.push(new Date(info.lastModified));
      }
    }
    return new Date(Math.max(...dates.map(date => date.getTime())));
  }

  async _getSidebarPath() {
    const dataPath = await this._getChromeUserDataPathIfExists();
    if (!dataPath) {
      return null;
    }
    return PathUtils.join(PathUtils.parent(dataPath), "StorableSidebar.json");
  }

  async _readSidebarPlan(aProfile) {
    const sidebarPath = await this._getSidebarPath();
    if (!sidebarPath || !(await IOUtils.exists(sidebarPath))) {
      return null;
    }
    const plan = lazy.ZenMigrationUtils.filterArcPlan(
      lazy.ZenMigrationUtils.parseArcSidebar(
        await IOUtils.readJSON(sidebarPath)
      ),
      aProfile?.id
    );
    if (!plan.spaces.length && !plan.favorites.length) {
      return null;
    }
    return plan;
  }

  async _getSidebarResource(aProfile) {
    let plan;
    try {
      plan = await this._readSidebarPlan(aProfile);
    } catch (ex) {
      console.error("Could not read the Arc sidebar", ex);
      return null;
    }
    if (!plan) {
      return null;
    }
    const migrator = this;
    return {
      type: MigrationUtils.resourceTypes.ZEN_SPACES,

      migrate(aCallback) {
        (async () => {
          // Re-read so that changes made in Arc since the wizard listed its
          // data are picked up too.
          const latest = await migrator
            ._readSidebarPlan(aProfile)
            .catch(() => null);
          await lazy.ZenMigrationUtils.applyArcSidebar(
            latest ?? plan,
            undefined,
            {
              containerTabId:
                lazy.ZenMigrationUtils.containerIdForArcProfile(aProfile),
            }
          );
        })().then(
          () => aCallback(true),
          ex => {
            console.error(ex);
            aCallback(false);
          }
        );
      },
    };
  }
}

/**
 * Dia is Chromium based, so everything in its profile directory imports
 * through the Chrome migrator. Its pinned tabs are kept in an encrypted
 * database and cannot be imported.
 */
export class DiaProfileMigrator extends withAllProfiles(ChromeProfileMigrator) {
  static get key() {
    return "dia";
  }

  static get displayNameL10nID() {
    return "migration-wizard-migrator-display-name-dia";
  }

  static get brandImage() {
    return "chrome://browser/content/zen-images/migration/dia.png";
  }

  _chromeUserDataPathSuffix = "Dia";
  _keychainServiceName = "Dia Safe Storage";
  _keychainAccountName = "Dia";
}
