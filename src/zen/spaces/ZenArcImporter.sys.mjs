/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { AppConstants } from "resource://gre/modules/AppConstants.sys.mjs";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  ContextualIdentityService: "moz-src:///toolkit/components/contextualidentity/ContextualIdentityService.sys.mjs",
  MigrationUtils: "resource:///modules/MigrationUtils.sys.mjs",
});

const ARC_ICON_ALIASES = {
  airplane: "airplane", plane: "airplane", airtravel: "airplane",
  car: "navigate", automobile: "navigate", globe: "globe", planet: "planet",
  map: "map", briefcase: "briefcase", folder: "folder", book: "book",
  graduationcap: "school", pencil: "brush", hammer: "build", wrench: "build",
  construction: "construct", headphones: "call", music: "music", film: "video",
  camera: "image", gamecontroller: "game-controller", heart: "heart", star: "star",
  flame: "flame", coffee: "cafe", cup: "cafe", cart: "basket", bag: "basket",
  creditcard: "card", terminal: "terminal", code: "code", palette: "palette",
  colorpallete: "palette", colorpalette: "palette", favorite: "star", bookmark: "bookmark",
  rocket: "rocket", moon: "moon", sun: "sun", leaf: "leaf", paw: "paw",
};

function zenIconForArcSymbol(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\.svg$/i, "")
    .replace(/[^a-z0-9]/g, "");
  const icon = ARC_ICON_ALIASES[normalized];
  return icon
    ? `chrome://browser/skin/zen-icons/selectable/${icon}.svg`
    : "";
}

/**
 * Efficient and resilient parser and importer for Arc Browser spaces, themes,
 * folders, tabs, favorites, and container profiles.
 */
export class ZenArcImporter {
  static #lastImportTime = 0;

  /**
   * Check if Arc data is available on the current machine.
   * @returns {Promise<boolean>}
   */
  static async isArcAvailable() {
    const path = this.getSidebarFilePath();
    if (!path) {
      return false;
    }
    return IOUtils.exists(path);
  }

  static #sidebarFilePath = null;

  /**
   * Get the default path to Arc's StorableSidebar.json.
   * Supports macOS and Windows.
   * @returns {string|null}
   */
  static getSidebarFilePath() {
    if (this.#sidebarFilePath) {
      try {
        const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
        file.initWithPath(this.#sidebarFilePath);
        if (file.exists()) {
          return this.#sidebarFilePath;
        }
      } catch (e) {}
      this.#sidebarFilePath = null;
    }

    if (AppConstants.platform === "macosx") {
      try {
        const uLibDir = Services.dirsvc.get("ULibDir", Ci.nsIFile).path;
        const p = PathUtils.join(uLibDir, "Application Support", "Arc", "StorableSidebar.json");
        const f = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
        f.initWithPath(p);
        if (f.exists()) {
          this.#sidebarFilePath = p;
          return p;
        }
      } catch (e) {
        console.error("[ZenArcImporter]: Failed to locate StorableSidebar.json on macOS:", e);
      }
      return null;
    }

    if (AppConstants.platform === "win") {
      try {
        let localAppData;
        try {
          localAppData = Services.dirsvc.get("LocalAppData", Ci.nsIFile).path;
        } catch {
          localAppData = Services.env.get("LOCALAPPDATA");
        }
        if (!localAppData) {
          return null;
        }

        const packagesDir = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
        packagesDir.initWithPath(PathUtils.join(localAppData, "Packages"));
        if (packagesDir.exists() && packagesDir.isDirectory()) {
          const entries = packagesDir.directoryEntries;
          while (entries.hasMoreElements()) {
            const entry = entries.nextFile;
            if (entry.leafName.startsWith("TheBrowserCompany.Arc_")) {
              const target = PathUtils.join(
                entry.path,
                "LocalCache",
                "Local",
                "Arc",
                "StorableSidebar.json"
              );
              const targetFile = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
              targetFile.initWithPath(target);
              if (targetFile.exists()) {
                this.#sidebarFilePath = target;
                return target;
              }
            }
          }
        }
      } catch (e) {
        console.error("[ZenArcImporter]: Failed to locate StorableSidebar.json on Windows:", e);
      }
      return null;
    }

    return null;
  }

  /**
   * Main entry point to import data from Arc.
   * @param {Window|Object|null} win - Target browser window or options object.
   * @param {string} targetProfile - Profile ID to import, or "all".
   * @returns {Promise<{spacesImported: number, tabsImported: number, essentialsImported?: number, pinnedImported?: number, normalImported?: number, totalTabs?: number}>}
   */
  static async importFromArc(win = null, targetProfile = "all") {
    // Support options object for testing or programmatic usage:
    let env = null;
    let sidebarData = null;
    let localStateData = null;
    let window = win;

    if (win && typeof win === "object" && (win.env || win.sidebarData)) {
      env = win.env || null;
      sidebarData = win.sidebarData || null;
      localStateData = win.localStateData || null;
      targetProfile = win.targetProfile || targetProfile || "all";
      window = env?.window || null;
    }

    const now = Date.now();
    // Only debounce if not passing explicit test fixture
    if (!sidebarData && now - this.#lastImportTime < 2000) {
      console.log("[ZenArcImporter]: Import already performed recently, skipping duplicate.");
      return { spacesImported: 0, tabsImported: 0 };
    }
    this.#lastImportTime = now;

    if (!window || !window.gZenWorkspaces) {
      window = Services.wm.getMostRecentWindow("navigator:browser");
    }
    if (!window || !window.gZenWorkspaces) {
      console.warn("[ZenArcImporter]: No active browser window with workspaces found.");
      return { spacesImported: 0, tabsImported: 0 };
    }

    let parsed = sidebarData;
    if (!parsed) {
      const filePath = this.getSidebarFilePath();
      if (!filePath || !(await IOUtils.exists(filePath))) {
        console.warn("[ZenArcImporter]: StorableSidebar.json not found.");
        return { spacesImported: 0, tabsImported: 0 };
      }

      try {
        const rawText = await IOUtils.readUTF8(filePath);
        parsed = JSON.parse(rawText);
      } catch (e) {
        console.error("[ZenArcImporter]: Error reading or parsing StorableSidebar.json:", e);
        return { spacesImported: 0, tabsImported: 0 };
      }
    }

    const container = parsed?.sidebar?.containers?.[1];
    if (!container) {
      console.warn("[ZenArcImporter]: Invalid sidebar container format.");
      return { spacesImported: 0, tabsImported: 0 };
    }

    // Capture initial active workspace snapshot before any workspace operations
    const initialActiveWorkspace =
      window.gZenWorkspaces.getActiveWorkspace?.() ||
      window.gZenWorkspaces.getActiveWorkspaceFromCache?.() ||
      window.gZenWorkspaces.getWorkspaces?.()?.[0] ||
      null;

    // Arc spaces can be dictionaries in container.spaces
    const spaces = Array.isArray(container.spaces)
      ? container.spaces
      : Object.values(container.spaces || {});
    const allSpaces = spaces.filter(
      s => typeof s === "object" && s !== null
    );

    // Arc items can be a list alternating [id, itemObj, id, itemObj] or [{id: ...}]
    const rawItems = container.items || [];
    const itemsById = new Map();
    for (let i = 0; i < rawItems.length; i++) {
      const item = rawItems[i];
      if (typeof item === "string" && i + 1 < rawItems.length && typeof rawItems[i + 1] === "object") {
        itemsById.set(item, rawItems[i + 1]);
        i++;
      } else if (typeof item === "object" && item !== null && item.id) {
        itemsById.set(item.id, item);
      }
    }

    // STAGE 1 (Containers): Arc profiles -> Firefox ContextualIdentityService
    const spaceToUserContextId = new Map();
    const profileToUserContextId = new Map();
    await this.#setupContainers(
      allSpaces,
      spaceToUserContextId,
      profileToUserContextId,
      localStateData,
      env?.cis || null
    );

    // Enable separate essentials preference and instance property
    try {
      const prefs = env?.Services?.prefs || Services.prefs;
      prefs.setBoolPref("zen.workspaces.separate-essentials", true);
      if (window.gZenWorkspaces) {
        window.gZenWorkspaces.containerSpecificEssentials = true;
      }
    } catch (e) {}

    // STAGE 2 (Workspaces & DOM): createAndSaveWorkspace with dontChange=true, DOM instantiation, off-screen layout
    const createdWorkspaces = await this.#stage2_createWorkspacesAndDOM(
      window,
      allSpaces,
      spaceToUserContextId,
      initialActiveWorkspace
    );

    // STAGE 3 (Essentials / Top Apps): Container favorites into .zen-essentials-container
    const essentialsCount = await this.#stage3_importEssentials(
      window,
      container.topAppsContainerIDs || [],
      itemsById,
      profileToUserContextId,
      targetProfile,
      initialActiveWorkspace
    );

    // STAGE 4 (Pinned Tabs & Folders): Pinned tabs & folders into workspaceEl.pinnedTabsContainer
    const { pinnedCount, firstPinnedTabByWorkspace } = await this.#stage4_importPinnedTabs(
      window,
      createdWorkspaces,
      itemsById
    );

    // STAGE 5 (Normal Tabs): Normal tabs directly into workspaceEl.tabsContainer
    const normalCount = await this.#stage5_importNormalTabs(
      window,
      createdWorkspaces,
      itemsById,
      firstPinnedTabByWorkspace
    );

    // FINALIZATION: Live Finalization without restart (R3)
    await this.#stageFinalizeLive(
      window,
      createdWorkspaces,
      initialActiveWorkspace
    );

    const tabsCount = pinnedCount + normalCount;
    return {
      spacesImported: createdWorkspaces.length,
      tabsImported: tabsCount + essentialsCount,
      essentialsImported: essentialsCount,
      pinnedImported: pinnedCount,
      normalImported: normalCount,
      totalTabs: essentialsCount + tabsCount,
      createdWorkspaces,
    };
  }

  /**
   * Resolve directoryBasename for Arc profile.
   */
  static #resolveProfileDirName(profile) {
    if (!profile) {
      return "Default";
    }
    if (typeof profile === "string") {
      return profile;
    }
    if (profile.default) {
      return "Default";
    }
    if (profile.custom) {
      if (typeof profile.custom === "string") {
        return profile.custom;
      }
      if (profile.custom._0?.directoryBasename) {
        return profile.custom._0.directoryBasename;
      }
    }
    return "Default";
  }

  /**
   * Set up Firefox contextual identity containers for Arc profiles,
   * matching existing user containers or creating new ones per Arc Profile.
   */
  static async #setupContainers(
    spacesList,
    spaceToUserContextId,
    profileToUserContextId,
    localStateData = null,
    cisInstance = null
  ) {
    const cis = cisInstance || lazy.ContextualIdentityService;
    if (!cis) {
      return;
    }

    try {
      Services.prefs.setBoolPref("privacy.userContext.enabled", true);
      Services.prefs.setBoolPref("privacy.userContext.ui.enabled", true);
    } catch (e) {}

    if (typeof cis.ensureDataReady === "function") {
      try {
        // Some Zen builds expose ensureDataReady() but never settle it while
        // the contextual identities store is being initialized. Waiting on it
        // indefinitely blocks the whole Arc migration before any workspace
        // is created. Give the store a bounded opportunity to initialize and
        // continue with the synchronous identity API afterwards.
        await Promise.race([
          Promise.resolve(cis.ensureDataReady()),
          new Promise(resolve => setTimeout(resolve, 1500)),
        ]);
      } catch (e) {}
    }

    // Load human-readable names from Arc's Local State
    const profileNamesMap = new Map();
    if (localStateData?.profile?.info_cache) {
      for (const [dirName, pInfo] of Object.entries(localStateData.profile.info_cache)) {
        if (pInfo?.name && !pInfo.name.startsWith("__ARC_")) {
          profileNamesMap.set(dirName, pInfo.name);
        }
      }
    } else {
      try {
        const sidebarPath = this.getSidebarFilePath();
        const arcDir = sidebarPath ? PathUtils.parent(sidebarPath) : null;
        const candidates = [];
        if (arcDir) {
          candidates.push(
            PathUtils.join(arcDir, "User Data", "Local State"),
            PathUtils.join(arcDir, "Local State")
          );
          const parentDir = PathUtils.parent(arcDir);
          if (parentDir) {
            candidates.push(
              PathUtils.join(parentDir, "User Data", "Local State"),
              PathUtils.join(parentDir, "Arc", "User Data", "Local State")
            );
          }
        }
        for (const candidate of candidates) {
          if (await IOUtils.exists(candidate)) {
            const raw = await IOUtils.readUTF8(candidate);
            const ls = JSON.parse(raw);
            const infoCache = ls?.profile?.info_cache || {};
            for (const [dirName, pInfo] of Object.entries(infoCache)) {
              if (pInfo?.name && !pInfo.name.startsWith("__ARC_")) {
                profileNamesMap.set(dirName, pInfo.name);
              }
            }
            break;
          }
        }
      } catch (e) {
        console.error("[ZenArcImporter]: Could not read Arc Local State profile names:", e);
      }
    }

    // Index all existing containers in Zen
    const existingIdentities = cis.getPublicIdentities() || [];
    const existingByName = new Map();
    for (const ident of existingIdentities) {
      const label = cis.getUserContextLabel
        ? cis.getUserContextLabel(ident.userContextId)
        : ident.name || "";
      if (label) {
        existingByName.set(label.trim().toLowerCase(), ident.userContextId);
      }
      if (ident?.name) {
        existingByName.set(ident.name.trim().toLowerCase(), ident.userContextId);
      }
    }

    // Common localized synonyms for standard Firefox containers
    if (existingIdentities.some(i => i.userContextId === 1)) {
      for (const alias of ["personal", "personnel", "perso", "default", "par défaut"]) {
        if (!existingByName.has(alias)) {
          existingByName.set(alias, 1);
        }
      }
    }
    if (existingIdentities.some(i => i.userContextId === 2)) {
      for (const alias of ["work", "professionnel", "travail", "pro", "cours", "ecole", "école"]) {
        if (!existingByName.has(alias)) {
          existingByName.set(alias, 2);
        }
      }
    }
    if (existingIdentities.some(i => i.userContextId === 3)) {
      for (const alias of ["banking", "banque"]) {
        if (!existingByName.has(alias)) {
          existingByName.set(alias, 3);
        }
      }
    }
    if (existingIdentities.some(i => i.userContextId === 4)) {
      for (const alias of ["shopping", "achats", "courses"]) {
        if (!existingByName.has(alias)) {
          existingByName.set(alias, 4);
        }
      }
    }

    const colors = ["blue", "turquoise", "green", "yellow", "orange", "red", "pink", "purple"];
    const icons = ["fingerprint", "briefcase", "dollar", "cart", "circle", "gift", "vacation", "food"];
    let colorIdx = 0;

    for (const space of spacesList) {
      const dirName = this.#resolveProfileDirName(space.profile);
      const pName = profileNamesMap.get(dirName) || (dirName === "Default" ? "Personal" : dirName);
      const spaceTitle = space.title || "";

      // If this Arc profile was already mapped to a container during this import, reuse it!
      if (profileToUserContextId.has(dirName)) {
        const existingId = profileToUserContextId.get(dirName);
        spaceToUserContextId.set(space, existingId);
        continue;
      }

      // Candidate search order:
      // 1. Profile display name from Local State (e.g. "Work", "ESIEE", "Perso")
      // 2. Space title if profile is generic (e.g. "Profile 1")
      // 3. Fallback aliases for Default profile ("perso", "personal", "personnel")
      const candidates = [];
      if (pName && !pName.startsWith("Profile ")) {
        candidates.push(pName);
      }
      if (spaceTitle) {
        candidates.push(spaceTitle);
      }
      if (dirName === "Default") {
        candidates.push("perso", "personal", "personnel");
      }

      let matchedUserContextId = null;
      for (const cand of candidates) {
        const key = cand.trim().toLowerCase();
        if (existingByName.has(key)) {
          matchedUserContextId = existingByName.get(key);
          break;
        }
      }

      // If no existing container matches, create a new one
      if (matchedUserContextId === null) {
        let targetName =
          pName && pName !== "Default" && pName !== "Personal" && !pName.startsWith("Profile ")
            ? pName
            : spaceTitle || pName || "Container";

        const color = colors[colorIdx % colors.length];
        const icon = icons[colorIdx % icons.length];
        colorIdx++;

        try {
          const newIdentity = cis.create(targetName, icon, color);
          if (newIdentity) {
            matchedUserContextId = Number(newIdentity.userContextId) || 0;
            existingByName.set(targetName.trim().toLowerCase(), matchedUserContextId);
          }
        } catch (cisEx) {
          console.error("[ZenArcImporter]: Failed to create container identity:", targetName, cisEx);
          matchedUserContextId = 0;
        }
      }

      const finalContextId = Number(matchedUserContextId) || 0;
      spaceToUserContextId.set(space, finalContextId);
      if (dirName) {
        profileToUserContextId.set(dirName, finalContextId);
      }
      if (pName) {
        profileToUserContextId.set(pName, finalContextId);
      }
    }
  }

  /**
   * Parse Arc topAppsContainerIDs into { profile, containerId } pairs.
   */
  static #parseTopAppsPairs(topAppsContainerIDs, itemsById) {
    const pairs = [];
    if (!Array.isArray(topAppsContainerIDs)) {
      return pairs;
    }
    for (let i = 0; i < topAppsContainerIDs.length; i++) {
      const entry = topAppsContainerIDs[i];
      if (typeof entry === "object" && entry !== null && i + 1 < topAppsContainerIDs.length) {
        pairs.push({ profile: entry, containerId: topAppsContainerIDs[i + 1] });
        i++;
      } else if (typeof entry === "string" && i + 1 < topAppsContainerIDs.length) {
        const next = topAppsContainerIDs[i + 1];
        if (itemsById?.has?.(next) || typeof next === "string") {
          pairs.push({ profile: entry, containerId: next });
          i++;
        } else {
          pairs.push({ profile: null, containerId: entry });
        }
      } else if (typeof entry === "string") {
        pairs.push({ profile: null, containerId: entry });
      }
    }
    return pairs;
  }

  /**
   * Stage 3 (Essentials / Top Apps): Extract Arc container favorites from
   * topAppsContainerIDs and inject into .zen-essentials-container[container="${id}"].
   */
  static async #stage3_importEssentials(
    window,
    topAppsContainerIDs,
    itemsById,
    profileToUserContextId,
    targetProfile,
    activeWorkspace
  ) {
    let count = 0;
    const pairs = this.#parseTopAppsPairs(topAppsContainerIDs, itemsById);

    for (const { profile, containerId } of pairs) {
      const dirName = this.#resolveProfileDirName(profile);
      if (targetProfile !== "all" && dirName !== targetProfile && profile !== targetProfile) {
        continue;
      }

      const userContextId =
        profileToUserContextId.get(dirName) ||
        profileToUserContextId.get(profile) ||
        0;

      const containerItem = itemsById.get(containerId);
      if (!containerItem?.childrenIds) {
        continue;
      }

      const section = window.gZenWorkspaces?.getEssentialsSection?.(userContextId);
      const importedUrls = new Set();

      for (const childId of containerItem.childrenIds) {
        const item = itemsById.get(childId);
        const url = item?.data?.tab?.savedURL;
        if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
          try {
            const normalizedUrl = url.replace(/\/$/, "");
            if (importedUrls.has(normalizedUrl)) {
              continue;
            }
            importedUrls.add(normalizedUrl);
            const existingEssential = section
              ? Array.from(section.children).find(
                  child =>
                    window.gBrowser.isTab(child) &&
                    child.hasAttribute("zen-essential") &&
                    child.getAttribute("usercontextid") === String(userContextId) &&
                    (child.linkedBrowser?.currentURI?.spec || "").replace(/\/$/, "") === normalizedUrl
                )
              : null;
            if (existingEssential) {
              existingEssential.label = item.title || existingEssential.label;
              continue;
            }
            const tab = window.gBrowser.addTrustedTab(url, {
              createLazyBrowser: true,
              inBackground: true,
              skipAnimation: true,
              skipBackgroundNotify: true,
              noInitialLabel: true,
              lazyTabTitle: item.title || undefined,
              userContextId,
              skipRoute: true,
            });

            if (window.gZenPinnedTabManager?.addToEssentials) {
              window.gZenPinnedTabManager.addToEssentials(tab, { replicating: true });
            } else {
              window.gBrowser.pinTab(tab);
            }

            // Must be set AFTER addToEssentials / pinTab because TabBrowserInserted sets zen-workspace-id
            tab.setAttribute("usercontextid", userContextId.toString());
            tab.setAttribute("container", userContextId.toString());
            tab.setAttribute("zenDefaultUserContextId", "true");
            tab.removeAttribute("zen-workspace-id");
            tab.setAttribute("zen-essential", "true");

            if (section && tab.parentElement !== section) {
              this.#moveTabOrElement(window, tab, () => {
                section.appendChild(tab);
              });
            }

            count++;
          } catch (e) {
            console.error("[ZenArcImporter]: Failed to import Top App:", url, e);
          }
        }
      }

      // Hide if not belonging to currently active workspace's container
      if (section) {
        const activeContainer = activeWorkspace?.containerTabId ?? 0;
        if (activeContainer !== userContextId) {
          section.setAttribute("hidden", "true");
        } else {
          section.removeAttribute("hidden");
        }
      }
    }
    return count;
  }


  /**
   * Ensures that the DOM <zen-workspace> element is created, attached, and its internal
   * sections (.zen-workspace-normal-tabs-section and .zen-workspace-pinned-tabs-section)
   * are fully initialized immediately, bypassing any XUL delayConnectedCallback lag.
   */
  static #ensureWorkspaceElement(window, workspace) {
    let el = window.gZenWorkspaces.workspaceElement(workspace.uuid);
    if (!el) {
      if (window.document?.createXULElement) {
        el = window.document.createXULElement("zen-workspace");
      } else if (window.document?.createElement) {
        el = window.document.createElement("zen-workspace");
      } else if (window.arrowScrollbox?.constructor) {
        el = new window.arrowScrollbox.constructor("zen-workspace");
        el.pinnedTabsContainer = new window.arrowScrollbox.constructor("div");
        el.pinnedTabsContainer.className = "zen-workspace-pinned-tabs-section";
        el.tabsContainer = new window.arrowScrollbox.constructor("div");
        el.tabsContainer.className = "zen-workspace-normal-tabs-section";
        el.appendChild(el.pinnedTabsContainer);
        el.appendChild(el.tabsContainer);
        el.checkPinsExistence = function() {
          if (this.pinnedTabsContainer.children.length > 0) {
            this.setAttribute("haspinnedtabs", "true");
          } else {
            this.removeAttribute("haspinnedtabs");
          }
        };
      }
      if (el) {
        el.id = workspace.uuid;
        if (el.setAttribute) {
          el.setAttribute("workspace-id", workspace.uuid);
        }
        const arrowScrollbox = window.arrowScrollbox ||
          (window.document?.getElementById ? window.document.getElementById("tabbrowser-arrowscrollbox") : null);
        if (arrowScrollbox?.appendChild) {
          arrowScrollbox.appendChild(el);
        }
        if (window.gZenWorkspaces?.workspaceElements?.set) {
          window.gZenWorkspaces.workspaceElements.set(workspace.uuid, el);
        }
      }
    }

    if (!el) {
      return null;
    }

    if (!el.tabsContainer || !el.pinnedTabsContainer) {
      if (!el.querySelector || !el.querySelector(".zen-workspace-normal-tabs-section")) {
        const frag = el.constructor?.fragment ||
          window.MozXULElement?.parseXULToFragment?.(el.constructor?.markup);
        if (frag) {
          el.appendChild(frag.cloneNode(true));
        }
      }
      if (el.querySelector) {
        el.tabsContainer = el.querySelector(".zen-workspace-normal-tabs-section");
        el.indicator = el.querySelector(".zen-current-workspace-indicator");
        el.pinnedTabsContainer = el.querySelector(".zen-workspace-pinned-tabs-section");
        if (el.pinnedTabsContainer) {
          el.pinnedTabsContainer.separatorElement = el.pinnedTabsContainer.querySelector(
            ".pinned-tabs-container-separator"
          );
        }
        el.scrollbox = el.querySelector("arrowscrollbox");
      }
      if (!el.pinnedTabsContainer) {
        const createSec = (cls) => {
          if (window.document?.createXULElement) {
            const s = window.document.createXULElement("div");
            s.className = cls;
            return s;
          } else if (window.arrowScrollbox?.constructor) {
            const s = new window.arrowScrollbox.constructor("div");
            s.className = cls;
            return s;
          }
          return null;
        };
        el.pinnedTabsContainer = createSec("zen-workspace-pinned-tabs-section");
        if (el.pinnedTabsContainer) {
          el.appendChild(el.pinnedTabsContainer);
        }
      }
      if (!el.tabsContainer) {
        const createSec = (cls) => {
          if (window.document?.createXULElement) {
            const s = window.document.createXULElement("div");
            s.className = cls;
            return s;
          } else if (window.arrowScrollbox?.constructor) {
            const s = new window.arrowScrollbox.constructor("div");
            s.className = cls;
            return s;
          }
          return null;
        };
        el.tabsContainer = createSec("zen-workspace-normal-tabs-section");
        if (el.tabsContainer) {
          el.appendChild(el.tabsContainer);
        }
      }
      if (!el.checkPinsExistence) {
        el.checkPinsExistence = function() {
          if (this.pinnedTabsContainer?.children?.length > 0) {
            this.setAttribute("haspinnedtabs", "true");
          } else {
            this.removeAttribute("haspinnedtabs");
          }
        };
      }
      if (el.tabsContainer?.setAttribute) {
        el.tabsContainer.setAttribute("zen-workspace-id", el.id);
      }
      if (el.pinnedTabsContainer?.setAttribute) {
        el.pinnedTabsContainer.setAttribute("zen-workspace-id", el.id);
      }
      if (typeof el.initializeAttributeInheritance === "function") {
        try {
          el.initializeAttributeInheritance();
        } catch (e) {}
      }
    }
    return el;
  }

  /**
   * Helper to safely move a DOM element (tab or folder) into a target container
   * whether or not gBrowser.zenHandleTabMove is available.
   */
  static #moveTabOrElement(window, element, moveCallback) {
    // The callback is responsible for the exact destination (workspace root,
    // folder, or essentials section). moveTabToWorkspace only knows the
    // workspace root and would pull folder tabs out of their group.
    if (
      window.gBrowser?.isTab?.(element) &&
      typeof window.gBrowser?.zenHandleTabMove === "function"
    ) {
      window.gBrowser.zenHandleTabMove(element, moveCallback);
    } else {
      moveCallback();
    }
    window.gBrowser?.tabContainer?._invalidateCachedTabs?.();
  }

  /**
   * Imports a standalone pinned tab directly into the workspace's pinned section.
   */
  static #importPinnedTab(window, childItem, workspace, workspaceEl) {
    const url = childItem.data?.tab?.savedURL;
    if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) {
      return null;
    }
    const sep =
      workspaceEl.pinnedTabsContainer?.separatorElement ||
      workspaceEl.pinnedTabsContainer?.querySelector?.(".pinned-tabs-container-separator");
    const containerId = Number(workspace.containerTabId) || 0;

    try {
      // Create unpinned first so pinTab() doesn't early-return!
      const tab = window.gBrowser.addTrustedTab(url, {
        createLazyBrowser: true,
        inBackground: true,
        skipAnimation: true,
        skipBackgroundNotify: true,
        noInitialLabel: true,
        lazyTabTitle: childItem.title || undefined,
        userContextId: containerId,
        zenWorkspaceId: workspace.uuid,
        skipRoute: true,
      });

      // Pin the tab (Zen's fixTabInsertLocation will initially place it in activeWorkspace)
      window.gBrowser.pinTab(tab);

      // Now assign workspace attributes and move it into the target workspace's pinnedTabsContainer
      tab.setAttribute("zen-workspace-id", workspace.uuid);
      tab.setAttribute("pinned", "true");
      if (containerId) {
        tab.setAttribute("usercontextid", containerId.toString());
        tab.setAttribute("zenDefaultUserContextId", "true");
      }

      this.#moveTabOrElement(window, tab, () => {
        tab.setAttribute("zen-workspace-id", workspace.uuid);
        if (sep && sep.parentElement === workspaceEl.pinnedTabsContainer) {
          workspaceEl.pinnedTabsContainer.insertBefore(tab, sep);
        } else {
          workspaceEl.pinnedTabsContainer.appendChild(tab);
        }
      });
      return tab;
    } catch (e) {
      console.error("[ZenArcImporter]: Failed to add pinned tab:", url, e);
      return null;
    }
  }

  /**
   * Imports an unpinned (normal) tab directly into the workspace's normal tabs section.
   */
  static #importNormalTab(window, childItem, workspace, workspaceEl) {
    const url = childItem.data?.tab?.savedURL;
    if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) {
      return null;
    }
    const periphery = workspaceEl.tabsContainer?.querySelector?.(
      "#tabbrowser-arrowscrollbox-periphery"
    );
    const containerId = Number(workspace.containerTabId) || 0;

    try {
      const tab = window.gBrowser.addTrustedTab(url, {
        createLazyBrowser: true,
        inBackground: true,
        skipAnimation: true,
        skipBackgroundNotify: true,
        noInitialLabel: true,
        lazyTabTitle: childItem.title || undefined,
        userContextId: containerId,
        zenWorkspaceId: workspace.uuid,
        skipRoute: true,
      });

      tab.setAttribute("zen-workspace-id", workspace.uuid);
      if (containerId) {
        tab.setAttribute("usercontextid", containerId.toString());
        tab.setAttribute("zenDefaultUserContextId", "true");
      }

      this.#moveTabOrElement(window, tab, () => {
        tab.setAttribute("zen-workspace-id", workspace.uuid);
        if (periphery && periphery.parentElement === workspaceEl.tabsContainer) {
          workspaceEl.tabsContainer.insertBefore(tab, periphery);
        } else {
          workspaceEl.tabsContainer.appendChild(tab);
        }
      });
      return tab;
    } catch (e) {
      console.error("[ZenArcImporter]: Failed to add normal tab:", url, e);
      return null;
    }
  }

  /**
   * Imports a folder and its children into a workspace's pinned section in exact sequential order.
   */
  static #importFolder(window, item, itemsById, workspace, workspaceEl, parentFolder = null) {
    const sep =
      workspaceEl.pinnedTabsContainer?.separatorElement ||
      workspaceEl.pinnedTabsContainer?.querySelector?.(".pinned-tabs-container-separator");
    const containerId = Number(workspace.containerTabId) || 0;

    let folder = null;
    if (window.gZenFolders) {
      try {
        folder = window.gZenFolders.createFolder([], {
          label: item.title || "Folder",
          workspaceId: workspace.uuid,
          collapsed: true,
          insertAfter: parentFolder ? parentFolder.groupContainer?.lastElementChild : null,
          insertBefore: parentFolder ? null : sep,
        });
      } catch (e) {
        console.error("[ZenArcImporter]: Failed to create folder:", item.title, e);
      }
    }

    const folderEl =
      folder?.folder || (folder?.isZenFolder ? folder : folder?.tagName ? folder : null);
    if (folderEl) {
      folderEl.setAttribute?.("zen-workspace-id", workspace.uuid);
      if (
        workspaceEl.pinnedTabsContainer &&
        folderEl.parentElement !== workspaceEl.pinnedTabsContainer &&
        !parentFolder
      ) {
        this.#moveTabOrElement(window, folderEl, () => {
          if (sep && sep.parentElement === workspaceEl.pinnedTabsContainer) {
            workspaceEl.pinnedTabsContainer.insertBefore(folderEl, sep);
          } else {
            workspaceEl.pinnedTabsContainer.appendChild(folderEl);
          }
        });
      }
    }

    let count = 0;
    let firstTab = null;
    const subIds = item.childrenIds || [];
    for (const subId of subIds) {
      const subItem = itemsById.get(subId);
      if (!subItem) {
        continue;
      }
      if (subItem.data?.list) {
        const res = this.#importFolder(window, subItem, itemsById, workspace, workspaceEl, folder);
        count += res.count;
        if (!firstTab && res.firstTab) {
          firstTab = res.firstTab;
        }
        continue;
      }
      const subUrl = subItem.data?.tab?.savedURL;
      if (subUrl && (subUrl.startsWith("http://") || subUrl.startsWith("https://"))) {
        try {
          const childTab = window.gBrowser.addTrustedTab(subUrl, {
            createLazyBrowser: true,
            inBackground: true,
            skipAnimation: true,
            skipBackgroundNotify: true,
            noInitialLabel: true,
            lazyTabTitle: subItem.title || undefined,
            userContextId: containerId,
            zenWorkspaceId: workspace.uuid,
            skipRoute: true,
          });

          window.gBrowser.pinTab(childTab);

          childTab.setAttribute("zen-workspace-id", workspace.uuid);
          childTab.setAttribute("pinned", "true");
          if (containerId) {
            childTab.setAttribute("usercontextid", containerId.toString());
            childTab.setAttribute("zenDefaultUserContextId", "true");
          }

          if (folder?.isZenFolder && typeof folder.addTabs === "function") {
            this.#moveTabOrElement(window, childTab, () => {
              folder.addTabs([childTab]);
            });
            childTab.setAttribute("zen-workspace-id", workspace.uuid);
            folder.setAttribute("zen-workspace-id", workspace.uuid);
          } else if (folderEl?.appendChild) {
            folderEl.appendChild(childTab);
            childTab.setAttribute("zen-workspace-id", workspace.uuid);
          } else {
            this.#moveTabOrElement(window, childTab, () => {
              childTab.setAttribute("zen-workspace-id", workspace.uuid);
              if (sep && sep.parentElement === workspaceEl.pinnedTabsContainer) {
                workspaceEl.pinnedTabsContainer.insertBefore(childTab, sep);
              } else {
                workspaceEl.pinnedTabsContainer.appendChild(childTab);
              }
            });
          }

          // Ensure the folder itself didn't get moved back to activeWorkspace by addTabs()
          if (
            folderEl &&
            !parentFolder &&
            workspaceEl.pinnedTabsContainer &&
            folderEl.parentElement !== workspaceEl.pinnedTabsContainer
          ) {
            this.#moveTabOrElement(window, folderEl, () => {
              if (sep && sep.parentElement === workspaceEl.pinnedTabsContainer) {
                workspaceEl.pinnedTabsContainer.insertBefore(folderEl, sep);
              } else {
                workspaceEl.pinnedTabsContainer.appendChild(folderEl);
              }
            });
          }

          if (!firstTab) {
            firstTab = childTab;
          }
          count++;
        } catch (e) {
          console.error("[ZenArcImporter]: Failed to add folder child tab:", subUrl, e);
        }
      }
    }
    return { count, firstTab };
  }

  /**
   * Stage 2 (Workspaces & DOM): Creates Zen workspaces with container mappings,
   * instantiates <zen-workspace> DOM components, positions them off-screen,
   * and applies gradient themes without activating workspaces.
   */
  static async #stage2_createWorkspacesAndDOM(
    window,
    spacesList,
    spaceToUserContextId,
    activeWorkspace
  ) {
    const createdWorkspaces = [];

    for (const space of spacesList) {
      const name = space.title || "Arc Space";

      // Icon mapping
      let icon = "";
      const rawIcon = space.iconType || space.customInfo?.iconType;
      if (rawIcon?.emoji) {
        icon = rawIcon.emoji;
      } else if (rawIcon?.symbol || rawIcon?.icon) {
        icon = zenIconForArcSymbol(rawIcon.symbol || rawIcon.icon);
      }

      const containerTabId = Number(spaceToUserContextId.get(space)) || 0;
      const theme = this.#extractTheme(space.customInfo);

      // Call createAndSaveWorkspace with dontChange = true
      let workspace = null;
      if (window.gZenWorkspaces?.createAndSaveWorkspace) {
        workspace = await window.gZenWorkspaces.createAndSaveWorkspace(
          name,
          icon,
          true, /* dontChange = true: do not activate workspace */
          containerTabId
        );
      }

      if (!workspace) {
        const uuid =
          window.gZenUIManager?.generateUuidv4?.() ||
          Services.uuid?.generateUUID?.().toString().replace(/[{}]/g, "") ||
          `zen-ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        workspace = {
          uuid,
          name,
          icon,
          containerTabId,
        };
      }

      // Guard against property overwrite by ensuring properties are explicitly preserved
      workspace.name = name;
      workspace.icon = icon;
      workspace.containerTabId = containerTabId;
      if (theme) {
        workspace.theme = theme;
      } else if (!workspace.theme) {
        workspace.theme = {
          type: "gradient",
          gradientColors: [],
          opacity: 0.5,
          texture: 0,
        };
      }

      window.gZenWorkspaces.saveWorkspace(workspace);

      // Propagate immediately so ZenSpaceManager creates the real <zen-workspace> XUL element
      try {
        await window.gZenWorkspaces.propagateWorkspaces?.(window.gZenWorkspaces.getWorkspaces());
      } catch (e) {}

      // Instantiate / ensure DOM element immediately
      const workspaceEl = this.#ensureWorkspaceElement(window, workspace);

      // Invalidate gradient cache for new workspace theme
      if (window.gZenThemePicker?.invalidateGradientCache) {
        window.gZenThemePicker.invalidateGradientCache(workspace.uuid);
      }

      createdWorkspaces.push({ workspace, space, workspaceEl });
    }

    // Position all newly created workspaces off-screen relative to activeWorkspace
    if (activeWorkspace && window.gZenWorkspaces?._organizeWorkspaceStripLocations) {
      window.gZenWorkspaces._organizeWorkspaceStripLocations(activeWorkspace, true);
    }

    // Synchronize to all windows if multi-window sync active
    try {
      const allWorkspaces = window.gZenWorkspaces.getWorkspaces();
      if (window.gZenWindowSync?.propagateWorkspacesToAllWindows) {
        window.gZenWindowSync.propagateWorkspacesToAllWindows(allWorkspaces);
      }
    } catch (e) {}

    return createdWorkspaces;
  }

  /**
   * Stage 4 (Pinned Tabs & Folders): Injects pinned tabs and folders directly into
   * workspaceEl.pinnedTabsContainer before .pinned-tabs-container-separator.
   */
  static async #stage4_importPinnedTabs(window, createdWorkspaces, itemsById) {
    let pinnedCount = 0;
    const firstPinnedTabByWorkspace = new Map();

    if (window.gZenFolders) {
      window.gZenFolders._sessionRestoring = true;
    }

    try {
      for (const { workspace, space, workspaceEl } of createdWorkspaces) {
        let pinnedContainerId = null;
        const cIDs = space.containerIDs || [];
        for (let i = 0; i < cIDs.length; i += 2) {
          if (cIDs[i] === "pinned") {
            pinnedContainerId = cIDs[i + 1];
            break;
          }
        }

        if (pinnedContainerId && workspaceEl?.pinnedTabsContainer) {
          const rootItem = itemsById.get(pinnedContainerId);
          const children = rootItem?.childrenIds || [];
          for (const childId of children) {
            const childItem = itemsById.get(childId);
            if (!childItem) {
              continue;
            }

            if (childItem.data?.list) {
              // Folder
              const res = this.#importFolder(window, childItem, itemsById, workspace, workspaceEl, null);
              pinnedCount += res.count;
              if (!firstPinnedTabByWorkspace.has(workspace.uuid) && res.firstTab) {
                firstPinnedTabByWorkspace.set(workspace.uuid, res.firstTab);
              }
            } else {
              // Standalone pinned tab
              const tab = this.#importPinnedTab(window, childItem, workspace, workspaceEl);
              if (tab) {
                pinnedCount++;
                if (!firstPinnedTabByWorkspace.has(workspace.uuid)) {
                  firstPinnedTabByWorkspace.set(workspace.uuid, tab);
                }
              }
            }
          }
        }
        workspaceEl?.checkPinsExistence?.();
      }
    } finally {
      if (window.gZenFolders) {
        delete window.gZenFolders._sessionRestoring;
      }
    }

    return { pinnedCount, firstPinnedTabByWorkspace };
  }

  /**
   * Stage 5 (Normal Tabs): Injects unpinned tabs directly into workspaceEl.tabsContainer
   * before #tabbrowser-arrowscrollbox-periphery and registers the first tab for workspace switching.
   */
  static async #stage5_importNormalTabs(
    window,
    createdWorkspaces,
    itemsById,
    firstPinnedTabByWorkspace
  ) {
    let normalCount = 0;
    for (const { workspace, space, workspaceEl } of createdWorkspaces) {
      let firstNormalTab = null;
      let unpinnedContainerId = null;
      const cIDs = space.containerIDs || [];
      for (let i = 0; i < cIDs.length; i += 2) {
        if (cIDs[i] === "unpinned") {
          unpinnedContainerId = cIDs[i + 1];
          break;
        }
      }

      if (unpinnedContainerId && workspaceEl?.tabsContainer) {
        const rootItem = itemsById.get(unpinnedContainerId);
        const children = rootItem?.childrenIds || [];
        for (const childId of children) {
          const childItem = itemsById.get(childId);
          if (childItem) {
            const tab = this.#importNormalTab(window, childItem, workspace, workspaceEl);
            if (tab) {
              normalCount++;
              if (!firstNormalTab) {
                firstNormalTab = tab;
              }
            }
          }
        }
      }

      const selectedTab = firstNormalTab || firstPinnedTabByWorkspace?.get(workspace.uuid) || null;
      if (selectedTab && window.gZenWorkspaces?.lastSelectedWorkspaceTabs) {
        window.gZenWorkspaces.lastSelectedWorkspaceTabs[workspace.uuid] = selectedTab;
      }
    }
    return normalCount;
  }

  /**
   * Live Finalization Without Restart (R3):
   * 1. Check pins existence on all workspaces.
   * 2. Invalidate gBrowser tab caches.
   * 3. Refresh workspace indicators and container layouts.
   * 4. Active workspace cleanliness guard: relocate any stray tabs into target workspace.
   * 5. Smooth live transition to first imported space without browser restart.
   */
  static async #stageFinalizeLive(window, createdWorkspaces, initialActiveWorkspace) {
    if (!createdWorkspaces.length) {
      return;
    }

    // 1. Instantiate and bind real <zen-workspace> DOM components across all windows
    const allWorkspaces = window.gZenWorkspaces.getWorkspaces();
    try {
      await window.gZenWorkspaces.propagateWorkspaces?.(allWorkspaces);
    } catch (e) {
      console.error("[ZenArcImporter]: Error propagating workspaces:", e);
    }

    // 2. Refresh indicators and containers
    try {
      window.gZenWorkspaces._fixIndicatorsNames?.(allWorkspaces);
      window.gZenWorkspaces.updateTabsContainers?.();
    } catch (e) {}

    // 3. Invalidate tab caches
    window.gBrowser?.tabContainer?._invalidateCachedTabs?.();
    window.gBrowser?.tabContainer?._invalidateCachedVisibleTabs?.();

    // 4. Verify pins existence on each created workspace
    for (const { workspace, workspaceEl } of createdWorkspaces) {
      const el = workspaceEl || window.gZenWorkspaces.workspaceElement(workspace.uuid);
      el?.checkPinsExistence?.();
    }

    // 5. Active workspace cleanliness guard
    if (initialActiveWorkspace) {
      const initialEl = window.gZenWorkspaces.workspaceElement(initialActiveWorkspace.uuid);
      if (initialEl) {
        const strayTabs = Array.from(initialEl.tabsContainer?.children || []).filter(
          child => window.gBrowser.isTab(child) &&
            child.getAttribute("zen-workspace-id") &&
            child.getAttribute("zen-workspace-id") !== initialActiveWorkspace.uuid
        );
        for (const stray of strayTabs) {
          const targetWsId = stray.getAttribute("zen-workspace-id");
          const targetEl = targetWsId ? window.gZenWorkspaces.workspaceElement(targetWsId) : null;
          if (targetEl?.tabsContainer) {
            const periphery = targetEl.tabsContainer.querySelector?.("#tabbrowser-arrowscrollbox-periphery");
            window.gBrowser.zenHandleTabMove(stray, () => {
              if (periphery && periphery.parentElement === targetEl.tabsContainer) {
                targetEl.tabsContainer.insertBefore(stray, periphery);
              } else {
                targetEl.tabsContainer.appendChild(stray);
              }
            });
          }
        }

        const strayPins = Array.from(initialEl.pinnedTabsContainer?.children || []).filter(
          child => window.gBrowser.isTab(child) &&
            child.getAttribute("zen-workspace-id") &&
            child.getAttribute("zen-workspace-id") !== initialActiveWorkspace.uuid
        );
        for (const stray of strayPins) {
          const targetWsId = stray.getAttribute("zen-workspace-id");
          const targetEl = targetWsId ? window.gZenWorkspaces.workspaceElement(targetWsId) : null;
          if (targetEl?.pinnedTabsContainer) {
            const sep = targetEl.pinnedTabsContainer.separatorElement ||
              targetEl.pinnedTabsContainer.querySelector?.(".pinned-tabs-container-separator");
            window.gBrowser.zenHandleTabMove(stray, () => {
              if (sep && sep.parentElement === targetEl.pinnedTabsContainer) {
                targetEl.pinnedTabsContainer.insertBefore(stray, sep);
              } else {
                targetEl.pinnedTabsContainer.appendChild(stray);
              }
            });
          }
        }
      }
    }

    // 6. Seamless live transition to first imported space
    const firstSpace = createdWorkspaces[0]?.workspace;
    if (firstSpace) {
      await window.gZenWorkspaces.changeWorkspace(firstSpace);
      window.gZenWorkspaces._organizeWorkspaceStripLocations(firstSpace, true);
      // Let workspace visibility and pinned-container observers settle before
      // exposing the imported tabs. A restart used to be the first time these
      // lists and sections were rebuilt after bulk DOM moves.
      await new Promise(resolve => window.requestAnimationFrame(resolve));
      window.gZenWorkspaces.updateTabsContainers?.({
        target: window.gZenWorkspaces.workspaceElement(firstSpace.uuid)?.pinnedTabsContainer,
      });
      window.gBrowser?.tabContainer?._invalidateCachedTabs?.();
      if (window.gZenThemePicker?.invalidateGradientCache) {
        window.gZenThemePicker.invalidateGradientCache(firstSpace.uuid);
      }
      if (window.gZenThemePicker?.onWorkspaceChange) {
        window.gZenThemePicker.onWorkspaceChange(firstSpace);
      }
    }
  }

  /**
   * Extract theme colors and texture from Arc windowTheme.
   */
  static #extractTheme(customInfo) {
    if (!customInfo?.windowTheme) {
      return null;
    }

    const wt = customInfo.windowTheme;
    if (wt.backgroundGradient) {
      return wt.backgroundGradient;
    }

    const bg = wt.background?.single?._0;
    const styleColor = bg?.style?.color?._0;
    const blended = styleColor?.blendedGradient?._0;

    let rawColors = [];
    let noiseTexture = 0;

    if (blended) {
      const base = blended.baseColors || [];
      const overlay = (blended.overlayColors || []).filter(
        c => c && (c.alpha === undefined || c.alpha > 0.05)
      );
      rawColors = [...base, ...overlay];
      if (blended.modifiers?.noiseFactor !== undefined) {
        noiseTexture = Number(blended.modifiers.noiseFactor) || 0;
      }
    } else if (wt.primaryColorPalette) {
      const palette = wt.primaryColorPalette;
      rawColors = [palette.tintedLight, palette.shadedDark, palette.midTone].filter(Boolean);
    }

    if (!rawColors.length) {
      return null;
    }

    const gradientDots = [];
    for (let i = 0; i < rawColors.length; i++) {
      const c = rawColors[i];
      if (typeof c !== "object" || c === null) {
        continue;
      }
      const r = Math.max(0, Math.min(255, Math.round((c.red ?? 0) * 255)));
      const g = Math.max(0, Math.min(255, Math.round((c.green ?? 0) * 255)));
      const b = Math.max(0, Math.min(255, Math.round((c.blue ?? 0) * 255)));

      // Avoid duplicate dots with identical color
      if (gradientDots.some(dot => dot.c[0] === r && dot.c[1] === g && dot.c[2] === b)) {
        continue;
      }

      gradientDots.push({
        c: [r, g, b],
        isCustom: false,
        isPrimary: gradientDots.length === 0,
        algorithm: "",
        lightness: 50,
        position: { x: (gradientDots.length + 1) * 25, y: 50 },
        type: "linear",
      });

      if (gradientDots.length >= 3) {
        break;
      }
    }

    if (!gradientDots.length) {
      return null;
    }

    return {
      type: "gradient",
      gradientColors: gradientDots,
      opacity: 0.5,
      texture: noiseTexture,
    };
  }
}
