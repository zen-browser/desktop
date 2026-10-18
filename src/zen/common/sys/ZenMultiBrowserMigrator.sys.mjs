/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { ZenArcMigrator } from "resource:///modules/ZenArcMigrator.sys.mjs";
import { ZenChromiumSessionReader } from "resource:///modules/ZenChromiumSessionReader.sys.mjs";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  MigrationUtils: "resource:///modules/MigrationUtils.sys.mjs",
});

/**
 * Orchestrates cross-browser data import for Arc, Chrome, Brave, Opera, Edge,
 * Vivaldi, and Firefox. Handles open tabs and workspace restoration.
 */
export class ZenMultiBrowserMigrator {
  /**
   * Browser definition metadata and profile paths across operating systems.
   */
  static BROWSERS = {
    arc: {
      key: "arc",
      name: "Arc",
      isChromium: true,
      hasSpaces: true,
    },
    chrome: {
      key: "chrome",
      name: "Google Chrome",
      isChromium: true,
      dataDirMac: ["Library", "Application Support", "Google", "Chrome"],
      dataDirWin: ["Google", "Chrome", "User Data"],
    },
    brave: {
      key: "brave",
      name: "Brave",
      isChromium: true,
      dataDirMac: ["Library", "Application Support", "BraveSoftware", "Brave-Browser"],
      dataDirWin: ["BraveSoftware", "Brave-Browser", "User Data"],
    },
    edge: {
      key: "chromium-edge",
      name: "Microsoft Edge",
      isChromium: true,
      dataDirMac: ["Library", "Application Support", "Microsoft Edge"],
      dataDirWin: ["Microsoft", "Edge", "User Data"],
    },
    opera: {
      key: "opera",
      name: "Opera",
      isChromium: true,
      dataDirMac: ["Library", "Application Support", "com.operasoftware.Opera"],
      dataDirWin: ["Opera Software", "Opera Stable"],
    },
    "opera-gx": {
      key: "opera-gx",
      name: "Opera GX",
      isChromium: true,
      dataDirMac: ["Library", "Application Support", "com.operasoftware.OperaGX"],
      dataDirWin: ["Opera Software", "Opera GX Stable"],
    },
    vivaldi: {
      key: "vivaldi",
      name: "Vivaldi",
      isChromium: true,
      dataDirMac: ["Library", "Application Support", "Vivaldi"],
      dataDirWin: ["Vivaldi", "User Data"],
    },
    firefox: {
      key: "firefox",
      name: "Firefox",
      isChromium: false,
    },
  };

  /**
   * Returns a list of installed browsers detected on the current system.
   *
   * @returns {Promise<Array<{ key: string, name: string }>>}
   */
  static async getInstalledBrowsers() {
    const installed = [];
    if (await ZenArcMigrator.hasArcData()) {
      installed.push(this.BROWSERS.arc);
    }
    for (const [id, def] of Object.entries(this.BROWSERS)) {
      if (id === "arc" || id === "firefox") {
        continue;
      }
      const dataDir = await this.#getChromiumDataDir(def);
      if (dataDir && (await IOUtils.exists(dataDir))) {
        installed.push(def);
      }
    }
    return installed;
  }

  /**
   * Post-migration hydration hook called when user finishes the migration wizard.
   * Restores spaces, gradient themes, and tabs into the current Zen window.
   *
   * @param {Window} aWindow - The active browser window.
   */
  static async onPostMigration(aWindow = window) {
    try {
      // 1. If Arc exists, import its spaces, themes, folders, and tabs
      const hasArc = await ZenArcMigrator.hasArcData();
      if (hasArc) {
        const arcDir = await ZenArcMigrator.getArcDataDir();
        if (arcDir) {
          const sidebarData = await ZenArcMigrator.readSidebarData(arcDir);
          if (sidebarData) {
            const spaces = ZenArcMigrator.parseSidebar(sidebarData);
            if (spaces.length > 0) {
              await ZenArcMigrator.importSpacesIntoZen(spaces, aWindow);
            }
          }
        }
      }

      // 2. Hydrate open tabs from Chromium sessions (Chrome, Brave, Edge, Opera, Vivaldi)
      const installed = await this.getInstalledBrowsers();
      for (const browser of installed) {
        if (browser.key === "arc") {
          continue;
        }
        const dataDir = await this.#getChromiumDataDir(browser);
        if (dataDir) {
          const defaultProfile = PathUtils.join(dataDir, "Default");
          const targetProfile = (await IOUtils.exists(defaultProfile)) ? defaultProfile : dataDir;
          const openTabs = await ZenChromiumSessionReader.getOpenTabs(targetProfile);
          if (openTabs.length > 0) {
            this.#restoreChromiumTabs(openTabs, browser.name, aWindow);
            break;
          }
        }
      }
    } catch (e) {
      console.warn("ZenMultiBrowserMigrator: error during post-migration hydration:", e);
    }
  }

  /**
   * Restores an array of open tabs from a Chromium browser into a Zen workspace.
   */
  static #restoreChromiumTabs(tabs, browserName, aWindow) {
    const { gZenWorkspaces, gBrowser } = aWindow;
    if (!gZenWorkspaces || !gBrowser || !tabs.length) {
      return;
    }

    const activeWorkspace = gZenWorkspaces.activeWorkspace;
    for (const tabItem of tabs) {
      const tab = gBrowser.addTrustedTab(tabItem.url, {
        createLazyBrowser: true,
        inBackground: true,
        skipAnimation: true,
        skipBackgroundNotify: true,
        lazyTabTitle: tabItem.title || undefined,
        skipRoute: true,
      });
      if (activeWorkspace) {
        tab.setAttribute("zen-workspace-id", activeWorkspace);
      }
      if (tabItem.pinned) {
        gBrowser.pinTab(tab);
      }
    }
  }

  /**
   * Resolves the profile/data directory for a Chromium browser definition.
   */
  static async #getChromiumDataDir(browserDef) {
    const isMac = Services.appinfo.OS === "Darwin";
    const isWin = Services.appinfo.OS === "WINNT";
    if (isMac && browserDef.dataDirMac) {
      const home = Services.dirsvc.get("Home", Ci.nsIFile).path;
      return PathUtils.join(home, ...browserDef.dataDirMac);
    }
    if (isWin && browserDef.dataDirWin) {
      const localAppData = Services.dirsvc.get("LocalAppData", Ci.nsIFile).path;
      return PathUtils.join(localAppData, ...browserDef.dataDirWin);
    }
    return null;
  }
}
