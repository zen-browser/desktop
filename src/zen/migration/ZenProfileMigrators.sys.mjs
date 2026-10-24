/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { MigrationUtils } from "resource:///modules/MigrationUtils.sys.mjs";
import { ChromeProfileMigrator } from "resource:///modules/ChromeProfileMigrator.sys.mjs";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  ZenMigrationUtils: "resource:///modules/zen/ZenMigrationUtils.sys.mjs",
});

/**
 * Arc keeps its web data in a regular Chromium "User Data" directory, so the
 * Chrome migrator handles bookmarks, history, passwords and form data. Its
 * sidebar (spaces, pinned tabs, folders and favorites) lives next to it in
 * StorableSidebar.json, which this migrator turns into Zen spaces.
 */
export class ArcProfileMigrator extends ChromeProfileMigrator {
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

  /**
   * The sidebar is shared by every Arc profile, so it is offered once, with
   * the default profile.
   *
   * @param {object} aProfile
   * @returns {Promise<object[]>}
   */
  async getResources(aProfile) {
    const resources = await super.getResources(aProfile);
    if (!aProfile || aProfile.id == "Default") {
      const sidebar = await this._getSidebarResource();
      if (sidebar) {
        resources.push(sidebar);
      }
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

  async _readSidebarPlan() {
    const sidebarPath = await this._getSidebarPath();
    if (!sidebarPath || !(await IOUtils.exists(sidebarPath))) {
      return null;
    }
    const plan = lazy.ZenMigrationUtils.parseArcSidebar(
      await IOUtils.readJSON(sidebarPath)
    );
    if (!plan.spaces.length && !plan.favorites.length) {
      return null;
    }
    return plan;
  }

  async _getSidebarResource() {
    let plan;
    try {
      plan = await this._readSidebarPlan();
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
          const latest = await migrator._readSidebarPlan().catch(() => null);
          await lazy.ZenMigrationUtils.applyArcSidebar(latest ?? plan);
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
export class DiaProfileMigrator extends ChromeProfileMigrator {
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
