/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { MigrationUtils } from "moz-src:///browser/components/migration/MigrationUtils.sys.mjs";
import {
  ArcProfileMigrator as FirefoxArcProfileMigrator,
  ChromeProfileMigrator,
} from "moz-src:///browser/components/migration/ChromeProfileMigrator.sys.mjs";

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
 * Firefox's Arc migrator finds Arc's data, asks for access to the folder
 * holding it and imports the Chromium data. It turns the sidebar
 * (StorableSidebar.json, shared by every Arc profile) into bookmark folders;
 * Zen replaces that resource with one that turns the chosen profile's spaces,
 * pinned tabs, folders and favorites into Zen spaces and essentials. Profiles
 * other than the main one get a container of their own.
 */
export class ArcProfileMigrator extends withAllProfiles(
  FirefoxArcProfileMigrator
) {
  async getResources(aProfile) {
    const resources = (await super.getResources(aProfile)).filter(
      resource => resource.type !== MigrationUtils.resourceTypes.BOOKMARKS
    );
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
