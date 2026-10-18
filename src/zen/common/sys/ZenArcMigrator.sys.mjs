/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const ARC_ICON_MAP = {
  planet: "🪐",
  airplane: "✈️",
  book: "📚",
  construction: "🛠️",
  heart: "❤️",
  star: "⭐",
  briefcase: "💼",
  home: "🏠",
  music: "🎵",
  code: "💻",
  sparkles: "✨",
  shopping: "🛍️",
  smile: "😊",
  coffee: "☕",
  gamepad: "🎮",
  camera: "📷",
  palette: "🎨",
  sun: "☀️",
  moon: "🌙",
  flag: "🚩",
  fire: "🔥",
  lightning: "⚡",
  tree: "🌳",
  globe: "🌍",
  gift: "🎁",
  folder: "📁",
};

/**
 * Handles deep data migration from The Browser Company's Arc browser into Zen.
 * Extracts spaces, themes (gradients, textures), icons, folders, pinned tabs,
 * and standard open tabs from Arc's StorableSidebar.json.
 */
export class ZenArcMigrator {
  /**
   * Resolves the Arc configuration / user data directory across operating systems.
   *
   * @returns {Promise<string|null>} The directory path or null if not found.
   */
  static async getArcDataDir() {
    const isMac = Services.appinfo.OS === "Darwin";
    const isWin = Services.appinfo.OS === "WINNT";

    if (isMac) {
      const home = Services.dirsvc.get("Home", Ci.nsIFile).path;
      const arcPath = PathUtils.join(home, "Library", "Application Support", "Arc");
      if (await IOUtils.exists(arcPath)) {
        return arcPath;
      }
    } else if (isWin) {
      const localAppData = Services.dirsvc.get("LocalAppData", Ci.nsIFile).path;
      const candidates = [
        PathUtils.join(localAppData, "Arc"),
        PathUtils.join(localAppData, "TheBrowserCompany", "Arc"),
      ];
      for (const cand of candidates) {
        if (await IOUtils.exists(cand)) {
          return cand;
        }
      }
    }
    return null;
  }

  /**
   * Checks whether an Arc installation exists on the current device.
   *
   * @returns {Promise<boolean>}
   */
  static async hasArcData() {
    const dataDir = await this.getArcDataDir();
    if (!dataDir) {
      return false;
    }
    const sidebarFile = PathUtils.join(dataDir, "StorableSidebar.json");
    if (await IOUtils.exists(sidebarFile)) {
      return true;
    }
    const userData = PathUtils.join(dataDir, "User Data");
    return await IOUtils.exists(userData);
  }

  /**
   * Reads and parses the Arc sidebar data (from primary file or recent backup).
   *
   * @param {string} arcDir - Path to the Arc application support directory.
   * @returns {Promise<object|null>} Parsed JSON data or null.
   */
  static async readSidebarData(arcDir) {
    const primaryPath = PathUtils.join(arcDir, "StorableSidebar.json");
    if (await IOUtils.exists(primaryPath)) {
      try {
        const text = await IOUtils.readUTF8(primaryPath);
        return JSON.parse(text);
      } catch (e) {
        console.warn("ZenArcMigrator: failed reading primary sidebar file, trying backup:", e);
      }
    }

    // Try finding the newest timestamped backup
    try {
      const children = await IOUtils.getChildren(arcDir);
      const backups = children
        .filter(path => {
          const name = PathUtils.filename(path);
          return name.startsWith("StorableSidebar.") && name.endsWith(".json");
        });

      if (backups.length > 0) {
        const withStats = await Promise.all(
          backups.map(async p => ({
            path: p,
            mtime: (await IOUtils.stat(p).catch(() => null))?.lastModified || 0,
          }))
        );
        withStats.sort((a, b) => b.mtime - a.mtime);
        const text = await IOUtils.readUTF8(withStats[0].path);
        return JSON.parse(text);
      }
    } catch (e) {
      console.warn("ZenArcMigrator: error reading backup files:", e);
    }
    return null;
  }

  /**
   * Clamps color floats in extendedSRGB space to 0-255 RGB integers.
   */
  static #clampColor(val) {
    if (typeof val !== "number" || isNaN(val)) {
      return 0;
    }
    return Math.min(255, Math.max(0, Math.round(val * 255)));
  }

  /**
   * Maps an Arc iconType object or string to a Zen workspace icon.
   *
   * @param {object|string} iconType - Arc iconType structure.
   * @returns {string} Icon character or emoji.
   */
  static mapArcIcon(iconType) {
    if (!iconType) {
      return "";
    }
    if (typeof iconType === "string") {
      return ARC_ICON_MAP[iconType] || iconType;
    }
    const iconName = iconType.icon || iconType.emoji || "";
    if (typeof iconName === "string" && iconName.length > 0) {
      return ARC_ICON_MAP[iconName] || iconName;
    }
    return "";
  }

  /**
   * Converts Arc theme data into Zen's native gradient theme format.
   *
   * @param {object} customInfo - Arc space customInfo object.
   * @returns {object} Zen theme object compatible with nsZenThemePicker.
   */
  static convertTheme(customInfo) {
    const { nsZenThemePicker } = ChromeUtils.importESModule(
      "resource:///modules/zen/ZenGradientGenerator.mjs"
    );

    const windowTheme = customInfo?.windowTheme || {};
    const blended =
      windowTheme?.background?.single?._0?.style?.color?._0?.blendedGradient?._0;

    let convertedColors = [];
    let noiseFactor = 0;

    if (blended) {
      const baseColors = blended.baseColors || [];
      for (const col of baseColors) {
        const r = this.#clampColor(col.red);
        const g = this.#clampColor(col.green);
        const b = this.#clampColor(col.blue);
        convertedColors.push({
          c: [r, g, b],
          type: "custom",
          isCustom: true,
        });
      }
      noiseFactor = blended.modifiers?.noiseFactor ?? 0;
    } else {
      // Fallback to primaryColorPalette or semanticColorPalette
      const palette =
        customInfo?.primaryColorPalette ||
        customInfo?.semanticColorPalette?.appearanceBased?.dark ||
        {};
      const samples = [palette.shaded, palette.midTone, palette.tintedLight].filter(Boolean);
      for (const col of samples) {
        convertedColors.push({
          c: [this.#clampColor(col.red), this.#clampColor(col.green), this.#clampColor(col.blue)],
          type: "custom",
          isCustom: true,
        });
      }
    }

    if (convertedColors.length === 0) {
      return nsZenThemePicker.getTheme([]);
    }

    // Map noise factor into Zen texture attribute (0..1)
    const texture = Math.min(1, Math.max(0, noiseFactor));
    return nsZenThemePicker.getTheme(convertedColors, 0.5, texture);
  }

  /**
   * Parses Arc sidebar container into structured spaces, folders, and tabs.
   *
   * @param {object} sidebarData - Root JSON object from StorableSidebar.json.
   * @returns {Array<object>} List of spaces ready for Zen import.
   */
  static parseSidebar(sidebarData) {
    const containers = sidebarData?.sidebar?.containers || [];
    let targetContainer = null;
    for (const c of containers) {
      if (Array.isArray(c?.spaces)) {
        targetContainer = c;
        break;
      }
    }

    if (!targetContainer) {
      return [];
    }

    const rawSpaces = (targetContainer.spaces || []).filter(s => typeof s === "object" && s !== null);
    const rawItems = (targetContainer.items || []).filter(it => typeof it === "object" && it !== null);
    const itemsById = new Map();
    for (const it of rawItems) {
      if (it.id) {
        itemsById.set(it.id, it);
      }
    }

    const parsedSpaces = [];

    for (const space of rawSpaces) {
      const spaceTitle = space.title || "Imported Space";
      const icon = this.mapArcIcon(space.customInfo?.iconType);
      const theme = this.convertTheme(space.customInfo);

      // Locate container IDs (pinned and unpinned)
      let pinnedContainerId = null;
      let unpinnedContainerId = null;

      const containerIDs = space.containerIDs || [];
      for (let i = 0; i < containerIDs.length; i++) {
        if (containerIDs[i] === "pinned" && i + 1 < containerIDs.length) {
          pinnedContainerId = containerIDs[i + 1];
        } else if (containerIDs[i] === "unpinned" && i + 1 < containerIDs.length) {
          unpinnedContainerId = containerIDs[i + 1];
        }
      }

      // If newContainerIDs array format is used
      if (!pinnedContainerId || !unpinnedContainerId) {
        const newContainerIDs = space.newContainerIDs || [];
        for (let i = 0; i < newContainerIDs.length; i++) {
          const entry = newContainerIDs[i];
          if (entry?.pinned && i + 1 < newContainerIDs.length) {
            pinnedContainerId = newContainerIDs[i + 1];
          } else if (entry?.unpinned && i + 1 < newContainerIDs.length) {
            unpinnedContainerId = newContainerIDs[i + 1];
          }
        }
      }

      // Helper to build hierarchy
      const parseItemNode = itemId => {
        const it = itemsById.get(itemId);
        if (!it) {
          return null;
        }

        const isFolder = !!it.data?.list || Array.isArray(it.childrenIds);
        if (isFolder) {
          const childNodes = (it.childrenIds || [])
            .map(cid => parseItemNode(cid))
            .filter(Boolean);
          return {
            type: "folder",
            title: it.title || "Folder",
            children: childNodes,
          };
        }

        const tabData = it.data?.tab;
        const url = tabData?.savedURL || it.url;
        if (!url || !url.startsWith("http")) {
          return null;
        }

        return {
          type: "tab",
          title: tabData?.savedTitle || it.title || url,
          url,
        };
      };

      // Top-level pinned items
      const pinnedItems = [];
      if (pinnedContainerId) {
        const containerObj = itemsById.get(pinnedContainerId);
        const childIds = containerObj?.childrenIds || rawItems.filter(it => it.parentID === pinnedContainerId).map(it => it.id);
        for (const cid of childIds) {
          const node = parseItemNode(cid);
          if (node) {
            pinnedItems.push(node);
          }
        }
      }

      // Top-level unpinned items (regular tabs)
      const unpinnedItems = [];
      if (unpinnedContainerId) {
        const containerObj = itemsById.get(unpinnedContainerId);
        const childIds = containerObj?.childrenIds || rawItems.filter(it => it.parentID === unpinnedContainerId).map(it => it.id);
        for (const cid of childIds) {
          const node = parseItemNode(cid);
          if (node) {
            unpinnedItems.push(node);
          }
        }
      }

      parsedSpaces.push({
        id: space.id,
        name: spaceTitle,
        icon,
        theme,
        pinnedItems,
        unpinnedItems,
      });
    }

    return parsedSpaces;
  }

  /**
   * Imports parsed Arc spaces and tabs into Zen browser window.
   *
   * @param {Array<object>} spaces - List of parsed spaces.
   * @param {Window} aWindow - The target browser window.
   */
  static async importSpacesIntoZen(spaces, aWindow = window) {
    if (!spaces || !spaces.length) {
      return;
    }

    const { gZenWorkspaces, gZenFolders, gZenThemePicker, gBrowser } = aWindow;
    if (!gZenWorkspaces || !gBrowser) {
      return;
    }

    for (const spaceData of spaces) {
      const workspace = await gZenWorkspaces.createAndSaveWorkspace(
        spaceData.name,
        spaceData.icon || undefined,
        false,
        0,
        {
          beforeChangeCallback: async newWorkspace => {
            const workspaceId = newWorkspace.uuid;

            // 1. Pinned tabs & folders
            for (const item of spaceData.pinnedItems) {
              if (item.type === "tab") {
                const tab = this.#addTab(aWindow, item.url, item.title, workspaceId);
                gBrowser.pinTab(tab);
                this.#placeTab(aWindow, tab, workspaceId, true);
              } else if (item.type === "folder" && gZenFolders) {
                const folder = gZenFolders.createFolder([], {
                  label: item.title,
                  collapsed: true,
                  workspaceId,
                });
                for (const child of item.children) {
                  if (child.type === "tab") {
                    const tab = this.#addTab(aWindow, child.url, child.title, workspaceId);
                    gBrowser.pinTab(tab);
                    folder.addTabs([tab]);
                  }
                }
              }
            }

            // 2. Normal tabs
            for (const item of spaceData.unpinnedItems) {
              if (item.type === "tab") {
                const tab = this.#addTab(aWindow, item.url, item.title, workspaceId);
                this.#placeTab(aWindow, tab, workspaceId, false);
              }
            }
          },
        }
      );

      if (workspace) {
        workspace.name = spaceData.name;
        if (spaceData.icon) {
          workspace.icon = spaceData.icon;
        }
        if (spaceData.theme) {
          workspace.theme = spaceData.theme;
        }
        gZenWorkspaces.saveWorkspace(workspace);
        gZenThemePicker?.onWorkspaceChange(workspace);
      }
    }
  }

  /**
   * Helper to create a background tab in Zen.
   */
  static #addTab(aWindow, url, title, workspaceId) {
    const tab = aWindow.gBrowser.addTrustedTab(url, {
      createLazyBrowser: true,
      inBackground: true,
      skipAnimation: true,
      skipBackgroundNotify: true,
      lazyTabTitle: title || undefined,
      skipRoute: true,
    });
    if (workspaceId) {
      tab.setAttribute("zen-workspace-id", workspaceId);
    }
    return tab;
  }

  /**
   * Helper to position an imported tab inside the workspace containers.
   */
  static #placeTab(aWindow, tab, workspaceId, pinned) {
    const element = aWindow.gZenWorkspaces.workspaceElement(workspaceId);
    if (!element) {
      return;
    }
    const container = pinned
      ? element.pinnedTabsContainer
      : element.tabsContainer;
    const anchor = pinned
      ? container.querySelector(".pinned-tabs-container-separator")
      : container.querySelector("#tabbrowser-arrowscrollbox-periphery");
    aWindow.gBrowser.zenHandleTabMove(tab, () => {
      tab.setAttribute("zen-workspace-id", workspaceId);
      container.insertBefore(tab, anchor);
    });
  }
}
