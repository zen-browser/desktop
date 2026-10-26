/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { XPCOMUtils } from "resource://gre/modules/XPCOMUtils.sys.mjs";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  PlacesUtils: "resource://gre/modules/PlacesUtils.sys.mjs",
});

XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "gBookmarksAsPinnedFolders",
  "zen.migration.bookmarks-as-pinned-folders",
  true
);

XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "gMaxPinnedTabsPerRoot",
  "zen.migration.bookmarks-as-pinned-folders.max-tabs",
  250
);

XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "gMaxSubfolders",
  "zen.folders.max-subfolders",
  5
);

XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "gImportArcUnpinnedTabs",
  "zen.migration.arc.import-unpinned-tabs",
  false
);

const kImportableSchemes = new Set(["http:", "https:", "file:", "ftp:"]);

const kArcDefaultSpaceId = "thebrowser.company.defaultPersonalSpaceID";
const kArcDefaultProfileId = "Default";

// Remembers which Zen space each Arc space was imported into, as a JSON map
// of Arc space id to Zen space uuid, so importing again updates those spaces
// instead of creating copies.
const kArcImportedSpacesPref = "zen.migration.arc.imported-spaces";

const kMaxTreeDepth = 32;
const kMaxSpaceColors = 3;

/**
 * Arc stores Swift dictionaries as flat arrays alternating key and value, for
 * example `[id, item, id, item]` or `["pinned", containerId, "unpinned", id]`.
 *
 * @param {Array} list
 * @returns {Array<[*, *]>}
 */
function pairs(list) {
  const result = [];
  if (!Array.isArray(list)) {
    return result;
  }
  for (let i = 0; i + 1 < list.length; i += 2) {
    result.push([list[i], list[i + 1]]);
  }
  return result;
}

/**
 * @param {string|URL} url
 * @returns {string|null} The normalized href, or null when the URL cannot be
 *   loaded as a pinned tab.
 */
function normalizeUrl(url) {
  if (URL.isInstance(url)) {
    url = url.href;
  }
  if (typeof url !== "string") {
    return null;
  }
  try {
    const parsed = new URL(url.trim());
    return kImportableSchemes.has(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}

/**
 * @param {object} profile An Arc profile key, `{default: ...}` or
 *   `{custom: {_0: {directoryBasename}}}`.
 * @returns {string|null} The Chromium profile directory it belongs to. Files
 *   written before Arc had profiles carry no key and belong to the default one.
 */
function arcProfileId(profile) {
  if (!profile || typeof profile !== "object" || profile.default) {
    return kArcDefaultProfileId;
  }
  const basename = profile.custom?._0?.directoryBasename;
  return typeof basename === "string" && basename ? basename : null;
}

/**
 * @param {Array<{space: object}>} entries Arc spaces with their context.
 * @param {*} orderedIds Arc's space order, as shown in its sidebar.
 * @returns {Array<{space: object}>} A copy in sidebar order. Spaces missing
 *   from the order keep their stored position after the ordered ones.
 */
function sortArcSpaces(entries, orderedIds) {
  if (!Array.isArray(orderedIds)) {
    return entries;
  }
  const rank = ({ space }) => {
    const index = orderedIds.indexOf(space.id);
    return index === -1 ? orderedIds.length : index;
  };
  // Array.prototype.sort is stable, so unranked spaces keep their order.
  return [...entries].sort((a, b) => rank(a) - rank(b));
}

/**
 * @param {MozTabbrowserTab} tab
 * @returns {string|null} The url a pinned tab is pinned to, or the url an
 *   unloaded tab will load. A tab opened lazily with a url only knows it as
 *   its registered open url until it loads.
 */
function urlOfTab(tab) {
  const browser = tab.linkedBrowser;
  return (
    tab._zenPinnedInitialState?.entry?.url ||
    browser?.registeredOpenURI?.spec ||
    browser?.currentURI?.spec ||
    null
  );
}

function arcSpaceTitle(space, index) {
  if (typeof space.title === "string" && space.title.trim()) {
    return space.title.trim();
  }
  return space.id === kArcDefaultSpaceId ? "Personal" : `Space ${index + 1}`;
}

function arcSpaceIcon(space) {
  const iconType = space.customInfo?.iconType;
  if (typeof iconType?.emoji_v2 === "string" && iconType.emoji_v2) {
    return iconType.emoji_v2;
  }
  if (Number.isInteger(iconType?.emoji)) {
    try {
      return String.fromCodePoint(iconType.emoji);
    } catch {}
  }
  return undefined;
}

/**
 * @param {object} color An Arc color.
 * @returns {number[]|null} 8-bit `[r, g, b]`, or null for a missing or fully
 *   transparent color.
 */
function arcColor(color) {
  if (!color || typeof color !== "object") {
    return null;
  }
  const channels = [color.red, color.green, color.blue];
  if (!channels.every(value => typeof value === "number")) {
    return null;
  }
  if (typeof color.alpha === "number" && color.alpha <= 0) {
    return null;
  }
  return channels.map(value =>
    Math.round(Math.min(1, Math.max(0, value)) * 255)
  );
}

/**
 * Reads an Arc space's window theme
 *
 * @param {object} space
 * @returns {{colors: number[][], intensity: number|null, noise: number|null}}
 *   Up to kMaxSpaceColors `[r, g, b]` colors in 0-255 plus Arc's intensity
 *   and noise factors when present.
 */
function arcSpaceTheme(space) {
  const result = { colors: [], intensity: null, noise: null };
  const style =
    space.customInfo?.windowTheme?.background?.single?._0?.style?.color?._0;
  if (!style || typeof style !== "object") {
    return result;
  }
  let candidates = [];
  let modifiers;
  if (style.blendedSingleColor) {
    const info = style.blendedSingleColor._0;
    candidates = [info?.color];
    modifiers = info?.modifiers;
  } else if (style.blendedGradient) {
    const info = style.blendedGradient._0;
    candidates = [...(info?.baseColors ?? []), ...(info?.overlayColors ?? [])];
    modifiers = info?.modifiers;
  } else {
    const visit = (node, depth) => {
      if (!node || typeof node !== "object" || depth > kMaxTreeDepth) {
        return;
      }
      if ("red" in node && "green" in node && "blue" in node) {
        candidates.push(node);
        return;
      }
      for (const value of Array.isArray(node) ? node : Object.values(node)) {
        visit(value, depth + 1);
      }
    };
    visit(style, 0);
  }
  const seen = new Set();
  for (const candidate of candidates) {
    const color = arcColor(candidate);
    const key = color?.join(",");
    if (color && !seen.has(key) && result.colors.length < kMaxSpaceColors) {
      seen.add(key);
      result.colors.push(color);
    }
  }
  if (typeof modifiers?.intensityFactor === "number") {
    result.intensity = modifiers.intensityFactor;
  }
  if (typeof modifiers?.noiseFactor === "number") {
    result.noise = modifiers.noiseFactor;
  }
  return result;
}

function colorLightness([r, g, b]) {
  return Math.round(((Math.max(r, g, b) + Math.min(r, g, b)) / 2 / 255) * 100);
}

/**
 * @param {{colors: number[][], intensity: number|null, noise: number|null}} arcTheme
 *   The colors (first one primary) and modifiers read from Arc.
 * @returns {object} A Zen space theme, as nsZenThemePicker.getTheme builds it
 */
function spaceThemeFromArc({ colors, intensity, noise }) {
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const lightness = colorLightness(colors[0]);
  return {
    type: "gradient",
    gradientColors: colors.map((c, index) => ({
      c,
      isCustom: false,
      algorithm: "",
      isPrimary: index === 0,
      lightness,
      type: "explicit-lightness",
    })),
    opacity: intensity === null ? 0.5 : clamp(intensity, 0.3, 0.8),
    texture:
      noise === null
        ? 0
        : Math.min(15 / 16, Math.round(clamp(noise, 0, 1) * 16) / 16),
  };
}

/**
 * Helpers shared by the browser migrators to turn other browsers' sidebars
 * and bookmark trees into Zen spaces, folders, pinned tabs and essentials.
 */
class ZenMigrationUtilsClass {
  /**
   * Number of spaces created by the last Arc import, shown by the wizard.
   *
   * @type {number}
   */
  lastImportedSpaceCount = 0;

  get browserWindow() {
    const candidates = [Services.wm.getMostRecentBrowserWindow()];
    for (const win of Services.wm.getEnumerator("navigator:browser")) {
      candidates.push(win);
    }
    return (
      candidates.find(
        win =>
          win &&
          !win.closed &&
          win.gZenWorkspaces?.workspaceEnabled &&
          !win.gZenWorkspaces.privateWindowOrDisabled
      ) ?? null
    );
  }

  /**
   * Converts Arc's StorableSidebar.json into an import plan.
   *
   * @param {object} sidebar The parsed JSON file.
   * @param {object} [options]
   * @param {string|null} [options.profileId] Keep only the spaces and
   *   favorites of this Chromium profile directory, e.g. "Profile 1". All
   *   profiles are kept when null.
   * @returns {{favorites: object[], spaces: object[]}}
   *   `favorites` holds Arc's top apps (Zen essentials) and each space its Arc
   *   id, title, optional emoji icon, theme colors, pinned items tree and its
   *   unpinned tabs, in Arc's sidebar order.
   */
  parseArcSidebar(sidebar, { profileId = null } = {}) {
    const plan = { favorites: [], spaces: [] };
    const containers = sidebar?.sidebar?.containers;
    if (!Array.isArray(containers)) {
      return plan;
    }
    const inProfile = profile =>
      profileId === null || arcProfileId(profile) === profileId;
    const spaces = [];
    const favoriteUrls = new Set();
    for (const container of containers) {
      if (
        !container ||
        typeof container !== "object" ||
        !Array.isArray(container.items)
      ) {
        continue;
      }
      const items = new Map();
      for (const [, item] of pairs(container.items)) {
        if (item && typeof item === "object" && typeof item.id === "string") {
          items.set(item.id, item);
        }
      }
      const childrenOf = parentId => {
        const parent = items.get(parentId);
        let children = parent?.childrenIds
          ?.map(id => items.get(id))
          .filter(Boolean);
        if (!children?.length) {
          children = [...items.values()].filter(
            item => item.parentID === parentId
          );
        }
        return children;
      };
      const convert = (parentId, depth) => {
        const result = [];
        if (depth > kMaxTreeDepth) {
          return result;
        }
        for (const item of childrenOf(parentId)) {
          const data = item.data ?? {};
          if (data.tab) {
            const url = normalizeUrl(data.tab.savedURL);
            if (url) {
              result.push({
                type: "tab",
                url,
                title: data.tab.savedTitle || item.title || "",
              });
            }
          } else if (data.list) {
            const folderItems = convert(item.id, depth + 1);
            if (folderItems.length) {
              result.push({
                type: "folder",
                title: item.title || "",
                items: folderItems,
              });
            }
          } else if (data.splitView) {
            result.push(...convert(item.id, depth + 1));
          }
        }
        return result;
      };
      const convertRoot = rootId =>
        typeof rootId === "string" ? convert(rootId, 0) : [];
      // A synced profile has one favorites root per machine, which usually
      // hold the same sites.
      for (const [profile, containerId] of pairs(
        container.topAppsContainerIDs
      )) {
        if (!inProfile(profile)) {
          continue;
        }
        for (const favorite of this.#flattenTabs(convertRoot(containerId))) {
          if (!favoriteUrls.has(favorite.url)) {
            favoriteUrls.add(favorite.url);
            plan.favorites.push(favorite);
          }
        }
      }
      for (const [, space] of pairs(container.spaces)) {
        if (space && typeof space === "object" && inProfile(space.profile)) {
          spaces.push({ space, convertRoot });
        }
      }
    }
    const orderedIds =
      sidebar.sidebarSyncState?.container?.value?.orderedSpaceIDs;
    for (const { space, convertRoot } of sortArcSpaces(spaces, orderedIds)) {
      const roots = new Map(pairs(space.containerIDs));
      plan.spaces.push({
        id: space.id,
        title: arcSpaceTitle(space, plan.spaces.length),
        icon: arcSpaceIcon(space),
        theme: arcSpaceTheme(space),
        items: convertRoot(roots.get("pinned")),
        unpinned: this.#flattenTabs(convertRoot(roots.get("unpinned"))),
      });
    }
    return plan;
  }

  /**
   * Creates the spaces, essentials, pinned tabs, folders and unpinned tabs of
   * an Arc plan. Spaces imported before are updated in place: only the tabs
   * and folders they do not have yet are added.
   *
   * @param {{favorites: object[], spaces: object[]}} plan
   * @param {Window} [win]
   * @returns {Promise<number>} The number of spaces imported or updated.
   */
  async applyArcSidebar(plan, win = this.browserWindow) {
    if (!win) {
      throw new Error("ZenMigrationUtils: no window to import spaces into");
    }
    const { gZenWorkspaces, gZenPinnedTabManager, gBrowser } = win;
    await gZenWorkspaces.promiseInitialized;

    const essentialUrls = new Set(
      gBrowser.tabs
        .filter(tab => tab.hasAttribute("zen-essential"))
        .map(urlOfTab)
    );
    // Favorites that do not fit in the essentials are pinned in the first
    // space instead, merged like any other pinned item so that importing again
    // does not pin them twice.
    const leftovers = [];
    for (const favorite of plan.favorites) {
      if (essentialUrls.has(favorite.url)) {
        continue;
      }
      const tab = this.#createLazyTab(win, favorite);
      if (
        !gZenPinnedTabManager.canEssentialBeAdded(tab) ||
        !gZenPinnedTabManager.addToEssentials(tab)
      ) {
        gBrowser.removeTab(tab, { animate: false });
        leftovers.push(favorite);
      }
    }

    const imported = this.#readImportedArcSpaces();
    // A space an earlier import already fills is never taken over by another
    // Arc space, even when it has no pinned tabs.
    let canReuseActive = !Object.values(imported).includes(
      gZenWorkspaces.activeWorkspace
    );
    let count = 0;
    for (const space of plan.spaces) {
      let uuid = imported[space.id];
      if (!uuid || !gZenWorkspaces.getWorkspaceFromId(uuid)) {
        uuid = await this.#ensureSpace(win, space, canReuseActive);
        canReuseActive = false;
      }
      if (typeof space.id === "string" && imported[space.id] !== uuid) {
        imported[space.id] = uuid;
        // Saved right away so that a later space failing does not make the
        // next import create this space again.
        Services.prefs.setStringPref(
          kArcImportedSpacesPref,
          JSON.stringify(imported)
        );
      }
      if (count === 0) {
        this.#applyItems(win, leftovers.splice(0), uuid, null, 0, null, true);
      }
      this.#applyItems(win, space.items, uuid, null, 0, null, true);
      if (lazy.gImportArcUnpinnedTabs) {
        this.#openUnpinnedTabs(win, space.unpinned ?? [], uuid);
      }
      count++;
    }
    this.#applyItems(
      win,
      leftovers,
      gZenWorkspaces.activeWorkspace,
      null,
      0,
      null,
      true
    );

    this.lastImportedSpaceCount = count;
    return count;
  }

  #readImportedArcSpaces() {
    try {
      const map = JSON.parse(
        Services.prefs.getStringPref(kArcImportedSpacesPref, "{}")
      );
      return map && typeof map === "object" && !Array.isArray(map) ? map : {};
    } catch {
      return {};
    }
  }

  // Opens Arc's unpinned ("today") tabs as regular, unloaded tabs at the end
  // of the space, skipping the ones the space already has open.
  #openUnpinnedTabs(win, items, workspaceId) {
    const { gBrowser, gZenWorkspaces } = win;
    const openUrls = new Set(
      gBrowser.tabs
        .filter(
          tab =>
            !tab.pinned && tab.getAttribute("zen-workspace-id") === workspaceId
        )
        .map(urlOfTab)
    );
    const tabs = [];
    for (const item of items) {
      if (openUrls.has(item.url)) {
        continue;
      }
      openUrls.add(item.url);
      const tab = this.#addLazyTab(win, item);
      tab.setAttribute("zen-workspace-id", workspaceId);
      tabs.push(tab);
    }
    if (tabs.length) {
      gZenWorkspaces.moveTabsToWorkspace(tabs, workspaceId);
    }
  }

  /**
   * Called by MigrationUtils once a bookmarks tree has been inserted.
   *
   * @param {object[]} bookmarks The tree given to insertTree.
   * @returns {Promise<void>}
   */
  async onBookmarksImported(bookmarks) {
    if (!lazy.gBookmarksAsPinnedFolders) {
      return;
    }
    const items = this.bookmarkTreeToItems(bookmarks);
    if (!items.length) {
      return;
    }
    const win = this.browserWindow;
    if (!win) {
      return;
    }
    try {
      await this.importItems(items, win);
    } catch (ex) {
      console.error("ZenMigrationUtils: failed to pin bookmark folders", ex);
    }
  }

  /**
   * Keeps only the folders of a bookmarks tree, as an import plan. Loose
   * bookmarks stay bookmarks.
   *
   * @param {object[]} children A `PlacesUtils.bookmarks.insertTree` tree.
   * @returns {object[]}
   */
  bookmarkTreeToItems(children) {
    const result = [];
    for (const child of Array.isArray(children) ? children : []) {
      if (child?.type !== lazy.PlacesUtils.bookmarks.TYPE_FOLDER) {
        continue;
      }
      const items = this.#bookmarkChildrenToItems(child.children, 0);
      if (items.length) {
        result.push({ type: "folder", title: child.title || "", items });
      }
    }
    return result;
  }

  #bookmarkChildrenToItems(children, depth) {
    const result = [];
    if (depth > kMaxTreeDepth) {
      return result;
    }
    for (const child of Array.isArray(children) ? children : []) {
      if (!child) {
        continue;
      }
      if (child.type === lazy.PlacesUtils.bookmarks.TYPE_FOLDER) {
        const items = this.#bookmarkChildrenToItems(child.children, depth + 1);
        if (items.length) {
          result.push({ type: "folder", title: child.title || "", items });
        }
      } else if (
        child.type === undefined ||
        child.type === lazy.PlacesUtils.bookmarks.TYPE_BOOKMARK
      ) {
        const url = normalizeUrl(child.url);
        if (url) {
          result.push({ type: "tab", url, title: child.title || "" });
        }
      }
    }
    return result;
  }

  /**
   * Creates the pinned tabs and folders of a plan inside a space.
   *
   * @param {object[]} items
   * @param {Window} [win]
   * @param {object} [options]
   * @param {string} [options.workspaceId] Defaults to the active space.
   * @param {number} [options.maxTabs] Pinned tab budget, 0 for unlimited.
   */
  async importItems(
    items,
    win = this.browserWindow,
    { workspaceId, maxTabs = lazy.gMaxPinnedTabsPerRoot } = {}
  ) {
    if (!win) {
      throw new Error("ZenMigrationUtils: no window to import items into");
    }
    await win.gZenWorkspaces.promiseInitialized;
    const uuid = workspaceId ?? win.gZenWorkspaces.activeWorkspace;
    const budget = maxTabs > 0 ? { remaining: maxTabs } : null;
    this.#applyItems(win, items, uuid, null, 0, budget);
  }

  #flattenTabs(items) {
    return items.flatMap(item =>
      item.type === "folder" ? this.#flattenTabs(item.items) : [item]
    );
  }

  // Finds or creates the Zen space an Arc space maps to and resolves to its
  // uuid. A fresh profile's untouched active space is reused for the first
  // import instead of being left behind empty.
  async #ensureSpace(win, space, canReuseActive) {
    const { gZenWorkspaces, gBrowser } = win;
    if (canReuseActive) {
      const active = gZenWorkspaces.getActiveWorkspaceFromCache();
      const element = gZenWorkspaces.activeWorkspaceElement;
      const hasPins =
        !element ||
        [...element.pinnedTabsContainer.children].some(
          child =>
            (gBrowser.isTab(child) && !child.hasAttribute("zen-empty-tab")) ||
            gBrowser.isTabGroup(child)
        );
      if (active && !hasPins) {
        active.name = space.title;
        if (space.icon) {
          active.icon = space.icon;
        }
        if (space.theme?.colors.length) {
          active.theme = spaceThemeFromArc(space.theme);
        }
        gZenWorkspaces.saveWorkspace(active);
        gZenWorkspaces.updateWorkspaceIndicator(active, element.indicator);
        if (space.theme?.colors.length) {
          win.gZenThemePicker?.onWorkspaceChange(active);
        }
        return active.uuid;
      }
    }
    const data = await gZenWorkspaces.createAndSaveWorkspace(
      space.title,
      space.icon,
      /* dontChange */ true
    );
    if (!data) {
      throw new Error("ZenMigrationUtils: spaces are disabled in this window");
    }
    if (space.theme?.colors.length) {
      data.theme = spaceThemeFromArc(space.theme);
      gZenWorkspaces.saveWorkspace(data);
      win.gZenThemePicker?.invalidateGradientCache(data.uuid);
    }
    if (!gZenWorkspaces.workspaceElement(data.uuid)) {
      await gZenWorkspaces.propagateWorkspaces(gZenWorkspaces.getWorkspaces());
    }
    return data.uuid;
  }

  // Walks a plan, creating pinned tabs and folders in order. Folders deeper
  // than Zen allows are flattened into their parent. `budget` is an optional
  // `{ remaining }` counter decremented per pinned tab. With `merge`, tabs the
  // parent already pins are skipped and folders with the same name are
  // reused, so a repeated import only adds what is new.
  #applyItems(win, items, workspaceId, parentFolder, depth, budget, merge) {
    const existing = merge
      ? this.#pinnedChildrenOf(win, workspaceId, parentFolder)
      : [];
    const pinnedUrls = new Set(
      existing.filter(child => !child.isZenFolder).map(urlOfTab)
    );
    // Same-named sibling folders each merge into their own counterpart.
    const unmatchedFolders = existing.filter(child => child.isZenFolder);
    for (const item of items) {
      if (budget && budget.remaining <= 0) {
        return;
      }
      if (item.type === "tab") {
        if (pinnedUrls.has(item.url)) {
          continue;
        }
        if (budget) {
          budget.remaining--;
        }
        const tab = this.#createLazyTab(win, item);
        this.#pinTabInto(win, tab, workspaceId, parentFolder);
      } else if (item.type === "folder") {
        if (depth >= lazy.gMaxSubfolders) {
          this.#applyItems(
            win,
            item.items,
            workspaceId,
            parentFolder,
            depth,
            budget,
            merge
          );
          continue;
        }
        const label = item.title || "Folder";
        const matchIndex = unmatchedFolders.findIndex(
          child => child.label === label
        );
        const [match] =
          matchIndex === -1 ? [] : unmatchedFolders.splice(matchIndex, 1);
        const folder =
          match ??
          win.gZenFolders.createFolder([], {
            label,
            workspaceId,
            renameFolder: false,
            insertAfter: parentFolder?.groupContainer.lastElementChild,
          });
        this.#applyItems(
          win,
          item.items,
          workspaceId,
          folder,
          depth + 1,
          budget,
          merge
        );
        if (!match) {
          folder.collapsed = true;
        }
      }
    }
  }

  // The tabs and folders directly inside a folder, or at the top of a space's
  // pinned section when `parentFolder` is null.
  #pinnedChildrenOf(win, workspaceId, parentFolder) {
    const { gBrowser, gZenWorkspaces } = win;
    const children = parentFolder
      ? parentFolder.allItems
      : [
          ...(gZenWorkspaces.workspaceElement(workspaceId)?.pinnedTabsContainer
            .children ?? []),
        ];
    return children.filter(
      child =>
        (gBrowser.isTab(child) && !child.hasAttribute("zen-empty-tab")) ||
        child.isZenFolder
    );
  }

  // Opens an unloaded tab that already knows its url and title, so it shows
  // up right away without loading anything.
  #addLazyTab(win, item) {
    return win.gBrowser.addTrustedTab(item.url, {
      createLazyBrowser: true,
      inBackground: true,
      skipAnimation: true,
      skipBackgroundNotify: true,
      noInitialLabel: true,
      lazyTabTitle: item.title || undefined,
      skipRoute: true,
    });
  }

  // A lazy tab that also remembers the url and title it is pinned to.
  #createLazyTab(win, item) {
    const tab = this.#addLazyTab(win, item);
    tab._zenPinnedInitialState = {
      entry: { url: item.url, title: item.title || "" },
    };
    return tab;
  }

  #pinTabInto(win, tab, workspaceId, parentFolder) {
    tab.setAttribute("zen-workspace-id", workspaceId);
    win.gBrowser.pinTab(tab);
    win.gZenWorkspaces.moveTabToWorkspace(tab, workspaceId);
    if (parentFolder) {
      parentFolder.addTabs([tab]);
    }
  }
}

export const ZenMigrationUtils = new ZenMigrationUtilsClass();
