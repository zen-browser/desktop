/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Native tree connectors for Zen folders and regular (unpinned) tabs.
 * Architecture adapted from Zen Folder Tree Connectors by JustAdumbPrsn
 * https://github.com/JustAdumbPrsn/ZenFolderTreeConnectors (GPL-3.0)
 */

import { nsZenDOMOperatedFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";

const SVG_NS = "http://www.w3.org/2000/svg";
const PREF_ENABLED = "zen.tree-connectors.enabled";
const PREF_FOLDERS = "zen.tree-connectors.folders.enabled";
const PREF_REGULAR = "zen.tree-connectors.regular-tabs.enabled";
const PREF_INTERACTIVE = "zen.tree-connectors.interactive";
const PREF_HIGHLIGHT_HOVER = "zen.tree-connectors.highlight-hover";
const PREF_OWNED_TABS = "zen.folders.owned-tabs-in-folder";
const PREF_WORKSPACE_ANIM = "zen.workspaces.switch-animation-duration";

const GEO = Object.freeze({
  LINE_X: 6,
  STROKE_WIDTH: 1.5,
  BRANCH_RADIUS: 8,
  OPACITY: 0.3,
});

const LINEAGE_EVENTS = new Set([
  "TabGrouped",
  "TabUngrouped",
  "FolderGrouped",
  "FolderUngrouped",
  "TabMove",
  "TabOpen",
  "TabClose",
  "TabGroupCreate",
  "TabGroupRemoved",
]);

const REPAINT_EVENTS = new Set([
  "TabSelect",
  "TabPinned",
  "TabUnpinned",
  "ZenFolderRenamed",
  "ZenFolderChangedWorkspace",
  "TabAddedToEssentials",
  "TabRemovedFromEssentials",
  "ZenTabRemovedFromSplit",
  "ZenTabIconChanged",
  "ZenTabLabelChanged",
]);

const ANIMATED_EVENTS = new Set([
  "TabGroupExpand",
  "TabGroupCollapse",
  "ZenSplitViewTabsSplit",
  "ZenWorkspacesUIUpdate",
  "ZenWorkspaceDataChanged",
]);

const DND_EVENTS = new Set(["dragstart", "dragover", "dragend", "drop"]);
const DND_ANIMATED_EVENTS = new Set(["dragstart", "dragover"]);

class nsZenTreeConnectors extends nsZenDOMOperatedFeature {
  #initialized = false;
  #needsCleanUp = true;
  #relationshipClassesDirty = true;
  #resizeTargetsDirty = true;

  #rafId = null;
  #isAnimating = false;
  #animationTimeout = null;
  #animationEndTime = 0;

  #resizeObserver = null;
  #mutationObserver = null;
  #attrObserver = null;

  #observedElements = new Set();
  #lastPaths = new WeakMap();
  #connectors = new WeakMap();

  #activeChildren = new Set();
  #activeParents = new Set();
  #lineageMap = new Map();
  #regularTabs = new Set();
  #regularHost = null;

  #pendingWrites = [];
  #openerMap = new WeakMap();

  QueryInterface = ChromeUtils.generateQI(["nsIObserver"]);

  async init() {
    if (this.#initialized) {
      return;
    }

    if (gZenWorkspaces?.promiseInitialized) {
      await gZenWorkspaces.promiseInitialized;
    }

    if (!this.#enabled) {
      return;
    }

    this.#resizeObserver = new ResizeObserver(() => this.scheduleUpdate(true, 150));

    this.#mutationObserver = new MutationObserver(aMutations => {
      let needsLineageUpdate = false;
      for (const m of aMutations) {
        if (m.type === "childList") {
          needsLineageUpdate = true;
          break;
        }
      }
      if (needsLineageUpdate) {
        this.#relationshipClassesDirty = true;
        this.#resizeTargetsDirty = true;
      }
      this.scheduleUpdate(true, 150);
    });

    this.#attrObserver = new MutationObserver(aMutations => {
      let isWorkspaceSwitch = false;
      for (const m of aMutations) {
        if (
          m.attributeName === "active" ||
          m.attributeName === "collapsedpinnedtabs"
        ) {
          isWorkspaceSwitch = true;
          break;
        }
      }
      this.#relationshipClassesDirty = true;
      this.#resizeTargetsDirty = true;
      const duration = isWorkspaceSwitch
        ? Services.prefs.getIntPref(PREF_WORKSPACE_ANIM, 250) + 20
        : 150;
      this.scheduleUpdate(true, duration);
    });

    this.#bindEventListeners();
    this.#bindPrefObserver();
    this.#syncRootAttrs();
    this.#seedOpenersFromTabs();

    this.#initialized = true;
    this.#relationshipClassesDirty = true;
    this.#resizeTargetsDirty = true;
    this.#needsCleanUp = true;
    this.scheduleUpdate(true, 150);
  }

  uninit() {
    if (!this.#initialized) {
      return;
    }

    this.#stopAnimation();
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = null;
    this.#mutationObserver?.disconnect();
    this.#mutationObserver = null;
    this.#attrObserver?.disconnect();
    this.#attrObserver = null;
    this.#unbindEventListeners();

    try {
      Services.prefs.removeObserver(PREF_ENABLED, this);
      Services.prefs.removeObserver(PREF_FOLDERS, this);
      Services.prefs.removeObserver(PREF_REGULAR, this);
      Services.prefs.removeObserver(PREF_INTERACTIVE, this);
      Services.prefs.removeObserver(PREF_HIGHLIGHT_HOVER, this);
      Services.prefs.removeObserver(PREF_OWNED_TABS, this);
    } catch {}

    document.documentElement.removeAttribute("zen-tree-connectors");
    document.documentElement.removeAttribute("zen-tree-connectors-folders");
    document.documentElement.removeAttribute("zen-tree-connectors-regular");
    document.documentElement.removeAttribute("zen-tree-connectors-interactive");
    document.documentElement.removeAttribute("zen-tree-connectors-highlight-hover");

    this.#removeAllRelationshipClasses();
    this.#clearRegularTabClasses();

    for (const el of document.querySelectorAll(".zen-tree-connector")) {
      el.remove();
    }

    this.#observedElements.clear();
    this.#lastPaths = new WeakMap();
    this.#connectors = new WeakMap();
    this.#lineageMap.clear();
    this.#pendingWrites.length = 0;
    this.#initialized = false;
  }

  scheduleUpdate(aIsContinuous = false, aDuration = 0) {
    if (aDuration > 0) {
      this.#animationEndTime = Math.max(
        this.#animationEndTime,
        Date.now() + aDuration
      );
    }
    if (aIsContinuous || Date.now() < this.#animationEndTime) {
      this.#startAnimation();
    } else {
      this.#scheduleSingleFrame();
    }
  }

  get #enabled() {
    return Services.prefs.getBoolPref(PREF_ENABLED, true);
  }

  get #foldersEnabled() {
    return Services.prefs.getBoolPref(PREF_FOLDERS, true);
  }

  get #regularEnabled() {
    return Services.prefs.getBoolPref(PREF_REGULAR, true);
  }

  get #ownedTabsInFolder() {
    return Services.prefs.getBoolPref(PREF_OWNED_TABS, false);
  }

  #scheduleSingleFrame() {
    if (this.#isAnimating || this.#rafId !== null) {
      return;
    }
    this.#rafId = requestAnimationFrame(() => {
      this.#rafId = null;
      this.#repaint();
    });
  }

  #startAnimation() {
    if (this.#isAnimating) {
      if (this.#animationTimeout) {
        clearTimeout(this.#animationTimeout);
      }
      const delay = Math.max(50, this.#animationEndTime - Date.now());
      this.#animationTimeout = setTimeout(() => this.#stopAnimation(), delay);
      return;
    }

    this.#isAnimating = true;
    if (this.#rafId !== null) {
      cancelAnimationFrame(this.#rafId);
    }

    const loop = () => {
      if (!this.#isAnimating) {
        return;
      }
      this.#repaint();
      if (Date.now() < this.#animationEndTime) {
        this.#rafId = requestAnimationFrame(loop);
      } else {
        this.#stopAnimation();
      }
    };
    this.#rafId = requestAnimationFrame(loop);

    const delay = Math.max(50, this.#animationEndTime - Date.now());
    this.#animationTimeout = setTimeout(() => this.#stopAnimation(), delay);
  }

  #stopAnimation() {
    this.#isAnimating = false;
    if (this.#rafId !== null) {
      cancelAnimationFrame(this.#rafId);
      this.#rafId = null;
    }
    if (this.#animationTimeout) {
      clearTimeout(this.#animationTimeout);
      this.#animationTimeout = null;
    }
  }

  #syncRootAttrs() {
    document.documentElement.setAttribute("zen-tree-connectors", "true");
    if (this.#foldersEnabled) {
      document.documentElement.setAttribute("zen-tree-connectors-folders", "true");
    } else {
      document.documentElement.removeAttribute("zen-tree-connectors-folders");
    }
    if (this.#regularEnabled) {
      document.documentElement.setAttribute("zen-tree-connectors-regular", "true");
    } else {
      document.documentElement.removeAttribute("zen-tree-connectors-regular");
    }

    const interactive = Services.prefs.getBoolPref(PREF_INTERACTIVE, false);
    if (interactive) {
      document.documentElement.setAttribute(
        "zen-tree-connectors-interactive",
        "true"
      );
    } else {
      document.documentElement.removeAttribute("zen-tree-connectors-interactive");
    }

    const highlight = Services.prefs.getBoolPref(PREF_HIGHLIGHT_HOVER, true);
    if (highlight) {
      document.documentElement.setAttribute(
        "zen-tree-connectors-highlight-hover",
        "true"
      );
    } else {
      document.documentElement.removeAttribute(
        "zen-tree-connectors-highlight-hover"
      );
    }
  }

  #getBoundsWithoutFlushing(aElement) {
    if (!aElement) {
      return null;
    }
    try {
      return window.windowUtils.getBoundsWithoutFlushing(aElement);
    } catch {
      return null;
    }
  }

  #repaint() {
    if (!window.gBrowser || !this.#enabled) {
      return;
    }

    this.#syncRootAttrs();

    const sidebarExpanded =
      document.documentElement.getAttribute("zen-sidebar-expanded") === "true";

    if (!sidebarExpanded) {
      if (this.#needsCleanUp) {
        this.#removeAllRelationshipClasses();
        this.#clearRegularTabClasses();
        for (const el of document.querySelectorAll(".zen-tree-connector")) {
          el.hidden = true;
        }
        this.#lastPaths = new WeakMap();
        this.#needsCleanUp = false;
      }
      return;
    }
    this.#needsCleanUp = true;

    if (this.#relationshipClassesDirty) {
      this.#updateRelationshipClasses();
      this.#relationshipClassesDirty = false;
    }

    const regularTabs = this.#regularEnabled
      ? this.#collectVisibleRegularTabs()
      : [];
    const regularHost = this.#regularEnabled
      ? this.#syncRegularTabClasses(regularTabs)
      : (this.#clearRegularTabClasses(), null);

    if (this.#resizeTargetsDirty) {
      this.#ensureResizeTargetsObserved();
    }

    const activeWorkspaceId = gZenWorkspaces?.activeWorkspace;
    if (!activeWorkspaceId) {
      return;
    }

    const isRTL = document.documentElement.matches(":-moz-locale-dir(rtl)");
    this.#pendingWrites.length = 0;
    const rootActiveTabsCache = new Map();

    // Regular unpinned tabs: same semantics as folder children.
    if (regularHost && regularTabs.length) {
      this.#pendingWrites.push({
        host: regularHost,
        pathData: this.#buildPath(regularHost, regularTabs, false, null, isRTL),
        kind: "regular",
      });
    } else if (this.#regularHost) {
      this.#pendingWrites.push({
        host: this.#regularHost,
        hide: true,
        kind: "regular",
      });
    }

    if (this.#foldersEnabled) {
      for (const folder of gBrowser.tabGroups) {
        if (!folder.isZenFolder) {
          continue;
        }
        if (folder.tagName.toLowerCase() === "zen-workspace-collapsible-pins") {
          continue;
        }

        const container =
          folder.groupContainer ||
          folder.querySelector(":scope > .tab-group-container");
        if (!container) {
          continue;
        }

        if (this.#isFolderHidden(folder, activeWorkspaceId)) {
          this.#pendingWrites.push({ host: container, hide: true, kind: "folder" });
          continue;
        }

        const visibleChildren = this.#collectVisibleChildren(folder);
        if (visibleChildren.length === 0) {
          this.#pendingWrites.push({ host: container, hide: true, kind: "folder" });
        } else {
          this.#pendingWrites.push({
            host: container,
            pathData: this.#buildPath(
              container,
              visibleChildren,
              false,
              null,
              isRTL
            ),
            kind: "folder",
          });
        }
      }
    }

    for (const [parentTab, children] of this.#lineageMap.entries()) {
      if (parentTab.hidden || parentTab.hasAttribute("zen-empty-tab")) {
        this.#pendingWrites.push({
          host: parentTab,
          hide: true,
          kind: "related",
        });
        continue;
      }

      const folder = this.#getTabFolder(parentTab);
      if (folder) {
        const rootMost = folder.rootMostCollapsedFolder;
        if (rootMost) {
          let activeSet = rootActiveTabsCache.get(rootMost);
          if (!activeSet) {
            activeSet = new Set(rootMost.activeTabs ?? []);
            rootActiveTabsCache.set(rootMost, activeSet);
          }
          if (!activeSet.has(parentTab)) {
            this.#pendingWrites.push({
              host: parentTab,
              hide: true,
              kind: "related",
            });
            continue;
          }
        }
      }

      if (children.length === 0) {
        this.#pendingWrites.push({
          host: parentTab,
          hide: true,
          kind: "related",
        });
      } else {
        this.#pendingWrites.push({
          host: parentTab,
          pathData: this.#buildPath(
            parentTab,
            children,
            true,
            this.#getBoundsWithoutFlushing(parentTab),
            isRTL
          ),
          kind: "related",
        });
      }
    }

    for (const entry of this.#pendingWrites) {
      if (entry.hide) {
        this.#hideConnector(entry.host, entry.kind);
      } else {
        this.#applyConnector(entry.host, entry.pathData, entry.kind);
      }
    }
  }

  #collectVisibleRegularTabs() {
    return Array.from(gBrowser.visibleTabs).filter(
      tab =>
        !tab.hidden &&
        !tab.pinned &&
        !tab.hasAttribute("zen-essential") &&
        !tab.hasAttribute("zen-empty-tab") &&
        !this.#getTabFolder(tab)
    );
  }

  #getRegularTabsHost() {
    const active =
      gZenWorkspaces?.activeWorkspaceElement ||
      gZenWorkspaces?.workspaceElement?.(gZenWorkspaces?.activeWorkspace);
    const fromActive = active?.querySelector?.(
      ".zen-workspace-normal-tabs-section"
    );
    if (fromActive) {
      return fromActive;
    }
    for (const tab of gBrowser.visibleTabs || []) {
      if (tab.pinned || tab.hasAttribute("zen-essential")) {
        continue;
      }
      const section = tab.closest?.(".zen-workspace-normal-tabs-section");
      if (section) {
        return section;
      }
    }
    return (
      document.querySelector(
        "zen-workspace[active] .zen-workspace-normal-tabs-section"
      ) ||
      document.querySelector(".zen-workspace-normal-tabs-section") ||
      null
    );
  }

  #syncRegularTabClasses(tabs) {
    const next = new Set(tabs);
    for (const tab of this.#regularTabs) {
      if (!next.has(tab)) {
        tab.classList.remove("zen-tree-regular-tab");
      }
    }
    for (const tab of next) {
      tab.classList.add("zen-tree-regular-tab");
    }
    this.#regularTabs = next;

    const host = this.#getRegularTabsHost();
    if (this.#regularHost && this.#regularHost !== host) {
      this.#regularHost.classList.remove("zen-tree-regular-host");
      this.#hideConnector(this.#regularHost, "regular");
    }
    this.#regularHost = host;
    host?.classList.add("zen-tree-regular-host");
    return host;
  }

  #clearRegularTabClasses() {
    for (const tab of this.#regularTabs) {
      tab.classList.remove("zen-tree-regular-tab");
    }
    this.#regularTabs.clear();
    this.#regularHost?.classList.remove("zen-tree-regular-host");
    if (this.#regularHost) {
      this.#hideConnector(this.#regularHost, "regular");
    }
    this.#regularHost = null;
  }

  #isFolderHidden(aFolder, aActiveWorkspaceId) {
    const isSwitching = gZenWorkspaces?.isChangingWorkspace;
    if (
      !isSwitching &&
      aFolder.getAttribute("zen-workspace-id") !== aActiveWorkspaceId
    ) {
      return true;
    }

    const rootMost = aFolder.rootMostCollapsedFolder;
    if (rootMost && rootMost !== aFolder) {
      return true;
    }

    const isPinned = aFolder.pinned || aFolder.hasAttribute("pinned");
    if (
      isPinned &&
      gZenWorkspaces?.activeWorkspaceElement?.hasCollapsedPinnedTabs
    ) {
      return true;
    }

    return false;
  }

  #collectVisibleChildren(aFolder) {
    if (aFolder.collapsed) {
      const activeNodes = new Set();
      for (const tab of aFolder.activeTabs || []) {
        if (tab.hidden || tab.hasAttribute("zen-empty-tab")) {
          continue;
        }
        if (tab.group?.hasAttribute("split-view-group")) {
          activeNodes.add(tab.group);
        } else {
          activeNodes.add(tab);
        }
      }
      return Array.from(activeNodes);
    }

    const result = [];
    for (const item of aFolder.allItems || []) {
      if (gBrowser.isTab?.(item)) {
        if (!item.hidden && !item.hasAttribute("zen-empty-tab")) {
          result.push(item);
        }
      } else if (gBrowser.isTabGroup?.(item)) {
        if (item.hasAttribute("split-view-group")) {
          const hasVisible = (item.tabs || []).some(
            t => !t.hidden && !t.hasAttribute("zen-empty-tab")
          );
          if (hasVisible) {
            result.push(item);
          }
        } else if (item.isZenFolder) {
          result.push(item);
        }
      }
    }
    return result;
  }

  #buildPath(aHost, aTargets, aIsRelated, aContextRect, aIsRTL) {
    const { LINE_X, BRANCH_RADIUS } = GEO;
    const hostRect = this.#getBoundsWithoutFlushing(aHost);
    if (!hostRect || hostRect.width === 0) {
      return "";
    }

    const points = [];
    for (const target of aTargets) {
      const measuredEl = aIsRelated
        ? (target.querySelector(".tab-stack") ?? target)
        : target;
      const targetRect = this.#getBoundsWithoutFlushing(measuredEl);
      if (!targetRect || targetRect.width === 0) {
        continue;
      }

      const x = aIsRTL
        ? hostRect.right - targetRect.right
        : targetRect.left - hostRect.left;
      const branchMidY = this.#branchMidY(target, targetRect, aIsRelated);
      const y = targetRect.top - hostRect.top + branchMidY;
      if (y <= 1) {
        continue;
      }
      points.push({
        x,
        y,
        r: Math.min(BRANCH_RADIUS, Math.max(0, x - LINE_X)),
      });
    }

    if (!points.length) {
      return "";
    }
    points.sort((a, b) => a.y - b.y);

    const last = points[points.length - 1];
    const trunkEndY = last.y - last.r;
    if (trunkEndY < 0) {
      return "";
    }

    const trunkStartY = aContextRect ? aContextRect.height / 2 : 0;
    let d = `M ${LINE_X} ${trunkStartY} L ${LINE_X} ${trunkEndY}`;
    for (const { x, y, r } of points) {
      d += ` M ${LINE_X} ${y - r} A ${r} ${r} 0 0 0 ${LINE_X + r} ${y} L ${x} ${y}`;
    }
    return d;
  }

  #branchMidY(aItem, aTargetRect, aIsRelated) {
    if (aIsRelated) {
      return aTargetRect.height / 2;
    }
    if (aItem.isZenFolder) {
      const label =
        aItem.labelElement?.parentElement ||
        aItem.querySelector(":scope > .tab-group-label-container");
      if (label) {
        const labelRect = this.#getBoundsWithoutFlushing(label);
        return labelRect ? labelRect.height / 2 : 0;
      }
      return 0;
    }
    if (gBrowser.isTabGroup?.(aItem)) {
      const firstTab = aItem.tabs?.[0];
      if (firstTab) {
        const tabRect = this.#getBoundsWithoutFlushing(firstTab);
        return tabRect
          ? tabRect.top - aTargetRect.top + tabRect.height / 2
          : aTargetRect.height / 2;
      }
    }
    return aTargetRect.height / 2;
  }

  #kindClass(aKind) {
    if (aKind === "related") {
      return "related-connector";
    }
    if (aKind === "regular") {
      return "regular-connector";
    }
    return "folder-connector";
  }

  #applyConnector(aHost, aPathData, aKind) {
    if (!aPathData) {
      this.#hideConnector(aHost, aKind);
      return;
    }

    if (this.#lastPaths.get(aHost) === aPathData) {
      return;
    }
    this.#lastPaths.set(aHost, aPathData);

    const kindClass = this.#kindClass(aKind);
    let connector = this.#connectors.get(aHost);
    if (!connector || !connector.isConnected || connector.parentNode !== aHost) {
      connector = aHost.querySelector(
        `:scope > .zen-tree-connector.${kindClass}`
      );
      if (!connector) {
        connector = document.createElement("div");
        connector.className = `zen-tree-connector ${kindClass}`;
        if (aKind === "related") {
          aHost.append(connector);
        } else {
          aHost.prepend(connector);
        }
      }
      this.#connectors.set(aHost, connector);
    }

    connector.hidden = false;
    let svg = connector.querySelector("svg");
    if (!svg) {
      svg = this.#createConnectorSVG(aKind);
      connector.replaceChildren(svg);

      if (aKind === "folder") {
        svg.addEventListener("click", e => {
          if (e.button !== 0) {
            return;
          }
          if (!Services.prefs.getBoolPref(PREF_INTERACTIVE, false)) {
            return;
          }
          if (e.target.closest(".folder-connector-group")) {
            const folder = aHost.closest("zen-folder");
            if (folder) {
              folder.collapsed = !folder.collapsed;
              e.stopPropagation();
              e.preventDefault();
            }
          }
        });
      }
    }

    for (const path of svg.querySelectorAll("path")) {
      if (path.getAttribute("d") !== aPathData) {
        path.setAttribute("d", aPathData);
      }
    }
  }

  #hideConnector(aHost, aKind) {
    const lastPath = this.#lastPaths.get(aHost);
    if (lastPath === null || lastPath === undefined) {
      return;
    }
    this.#lastPaths.set(aHost, null);

    const connector = this.#connectors.get(aHost);
    if (connector) {
      connector.hidden = true;
      return;
    }
    const kindClass = this.#kindClass(aKind);
    for (const c of aHost.querySelectorAll(
      `:scope > .zen-tree-connector.${kindClass}`
    )) {
      c.hidden = true;
    }
  }

  #createConnectorSVG(aKind) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.classList.add("zen-tree-connector-svg");
    svg.style.cssText =
      "position:absolute;top:0;inset-inline-start:0;overflow:visible;pointer-events:none;";

    const g = document.createElementNS(SVG_NS, "g");
    g.classList.add("connector-group");
    if (aKind === "folder") {
      g.classList.add("folder-connector-group");
    }

    const hitPath = document.createElementNS(SVG_NS, "path");
    hitPath.classList.add("connector-hitbox");

    const visPath = document.createElementNS(SVG_NS, "path");
    visPath.classList.add("connector-visible");
    visPath.style.opacity = String(GEO.OPACITY);
    visPath.style.stroke = "currentColor";
    visPath.style.strokeWidth = `${GEO.STROKE_WIDTH}px`;
    visPath.style.fill = "none";
    visPath.style.strokeLinecap = "round";
    visPath.style.strokeLinejoin = "round";

    g.appendChild(hitPath);
    g.appendChild(visPath);
    svg.appendChild(g);
    return svg;
  }

  #getOpener(tab) {
    if (!tab) {
      return null;
    }
    const cached = this.#openerMap.get(tab);
    if (cached && this.#isUsableOpener(cached, tab)) {
      return cached;
    }
    const opener = tab.openerTab || tab.owner || tab.ownerTab || null;
    if (this.#isUsableOpener(opener, tab)) {
      this.#openerMap.set(tab, opener);
      return opener;
    }
    return null;
  }

  #isUsableOpener(opener, tab) {
    return !!(
      opener &&
      opener !== tab &&
      !opener.closing &&
      opener.isConnected !== false &&
      Array.prototype.includes.call(gBrowser.tabs, opener)
    );
  }

  #rememberOpener(tab) {
    const opener = tab?.openerTab || tab?.owner || tab?.ownerTab || null;
    if (this.#isUsableOpener(opener, tab)) {
      this.#openerMap.set(tab, opener);
    }
  }

  #seedOpenersFromTabs() {
    for (const tab of gBrowser.tabs || []) {
      this.#rememberOpener(tab);
    }
  }

  #updateRelationshipClasses() {
    if (!gBrowser?.tabs) {
      return;
    }

    const isSwitching = gZenWorkspaces?.isChangingWorkspace;
    const parentToChildren = this.#ownedTabsInFolder
      ? new Map()
      : this.#computeLineage();

    const newParents = new Set(parentToChildren.keys());
    const newChildren = new Set();
    for (const children of parentToChildren.values()) {
      for (const child of children) {
        newChildren.add(child);
      }
    }

    for (const tab of this.#activeChildren) {
      if (!newChildren.has(tab)) {
        if (isSwitching) {
          newChildren.add(tab);
        } else {
          tab.classList.remove("zen-is-related-child");
        }
      }
    }
    for (const tab of this.#activeParents) {
      if (!newParents.has(tab)) {
        if (isSwitching) {
          newParents.add(tab);
        } else {
          tab.classList.remove("zen-is-related-parent");
          this.#hideConnector(tab, "related");
        }
      }
    }

    for (const tab of newChildren) {
      if (!this.#activeChildren.has(tab)) {
        tab.classList.add("zen-is-related-child");
      }
    }
    for (const tab of newParents) {
      if (!this.#activeParents.has(tab)) {
        tab.classList.add("zen-is-related-parent");
      }
    }

    this.#activeChildren = newChildren;
    this.#activeParents = newParents;
    this.#lineageMap = parentToChildren;
    this.#resizeTargetsDirty = true;
  }

  #getTabFolder(aTab) {
    if (!aTab) {
      return null;
    }
    let group = aTab.group;
    if (group?.hasAttribute("split-view-group")) {
      group = group.group;
    }
    return group?.isZenFolder ? group : null;
  }

  #computeLineage() {
    const parentToChildren = new Map();
    const activeWorkspaceId = gZenWorkspaces?.activeWorkspace;
    if (!activeWorkspaceId) {
      return parentToChildren;
    }

    let activeParent = null;
    let lineageSet = new Set();

    for (const tab of gBrowser.visibleTabs) {
      if (tab.hasAttribute("zen-essential")) {
        continue;
      }

      const folder = this.#getTabFolder(tab);
      if (!folder || tab.classList.contains("zen-tab-group-start")) {
        activeParent = null;
        lineageSet.clear();
        continue;
      }

      const owner = this.#getOpener(tab);
      const isDescendant =
        owner &&
        activeParent &&
        this.#getTabFolder(owner) === folder &&
        (owner === activeParent || lineageSet.has(owner));

      if (isDescendant) {
        if (!parentToChildren.has(activeParent)) {
          parentToChildren.set(activeParent, []);
        }
        parentToChildren.get(activeParent).push(tab);
        lineageSet.add(tab);
      } else {
        activeParent = tab;
        lineageSet.clear();
        lineageSet.add(tab);
      }
    }

    return parentToChildren;
  }

  #removeAllRelationshipClasses() {
    for (const node of document.querySelectorAll(
      ".zen-is-related-child, .zen-is-related-parent"
    )) {
      node.classList.remove("zen-is-related-child", "zen-is-related-parent");
      this.#hideConnector(node, "related");
    }
    this.#activeChildren.clear();
    this.#activeParents.clear();
  }

  #ensureResizeTargetsObserved() {
    if (!this.#resizeTargetsDirty) {
      return;
    }
    this.#resizeTargetsDirty = false;

    const currentTargets = new Set();

    if (this.#foldersEnabled) {
      for (const folder of gBrowser.tabGroups) {
        if (
          folder.isZenFolder &&
          folder.tagName.toLowerCase() !== "zen-workspace-collapsible-pins"
        ) {
          const container = folder.groupContainer;
          if (container) {
            currentTargets.add(container);
          }
        }
      }
    }

    for (const el of document.querySelectorAll(
      ".zen-workspace-pinned-tabs-section, .zen-essentials-container, .zen-workspace-normal-tabs-section"
    )) {
      currentTargets.add(el);
    }

    if (gBrowser?.tabContainer) {
      currentTargets.add(gBrowser.tabContainer);
    }
    for (const id of ["zen-tabs-wrapper", "tabbrowser-arrowscrollbox"]) {
      const el = document.getElementById(id);
      if (el) {
        currentTargets.add(el);
      }
    }

    for (const tab of this.#activeChildren) {
      currentTargets.add(tab);
    }
    for (const tab of this.#activeParents) {
      currentTargets.add(tab);
    }
    if (this.#regularHost) {
      currentTargets.add(this.#regularHost);
    }
    for (const tab of this.#regularTabs) {
      currentTargets.add(tab);
    }

    for (const el of this.#observedElements) {
      if (!currentTargets.has(el)) {
        this.#resizeObserver?.unobserve(el);
        this.#observedElements.delete(el);
      }
    }
    for (const el of currentTargets) {
      if (!this.#observedElements.has(el)) {
        this.#resizeObserver?.observe(el);
        this.#observedElements.add(el);
      }
    }
  }

  #bindEventListeners() {
    for (const eventName of LINEAGE_EVENTS) {
      window.addEventListener(eventName, this);
    }
    for (const eventName of REPAINT_EVENTS) {
      window.addEventListener(eventName, this);
    }
    for (const eventName of ANIMATED_EVENTS) {
      window.addEventListener(eventName, this);
    }
    for (const eventName of DND_EVENTS) {
      window.addEventListener(eventName, this);
    }

    this.#mutationObserver?.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["zen-sidebar-expanded"],
    });

    const scrollbox = document.getElementById("tabbrowser-arrowscrollbox");
    if (scrollbox) {
      this.#mutationObserver?.observe(scrollbox, { childList: true });
      this.#attrObserver?.observe(scrollbox, {
        attributes: true,
        attributeFilter: ["active", "collapsedpinnedtabs"],
        subtree: true,
      });
    }
  }

  #unbindEventListeners() {
    for (const eventName of LINEAGE_EVENTS) {
      window.removeEventListener(eventName, this);
    }
    for (const eventName of REPAINT_EVENTS) {
      window.removeEventListener(eventName, this);
    }
    for (const eventName of ANIMATED_EVENTS) {
      window.removeEventListener(eventName, this);
    }
    for (const eventName of DND_EVENTS) {
      window.removeEventListener(eventName, this);
    }
  }

  #bindPrefObserver() {
    try {
      Services.prefs.addObserver(PREF_ENABLED, this);
      Services.prefs.addObserver(PREF_FOLDERS, this);
      Services.prefs.addObserver(PREF_REGULAR, this);
      Services.prefs.addObserver(PREF_INTERACTIVE, this);
      Services.prefs.addObserver(PREF_HIGHLIGHT_HOVER, this);
      Services.prefs.addObserver(PREF_OWNED_TABS, this);
    } catch (e) {
      console.error("nsZenTreeConnectors: Could not register pref observer.", e);
    }
  }

  observe(_aSubject, aTopic, aData) {
    if (aTopic !== "nsPref:changed") {
      return;
    }
    if (aData === PREF_ENABLED) {
      if (!this.#enabled) {
        this.uninit();
      } else if (!this.#initialized) {
        this.init();
      }
      return;
    }
    if (aData === PREF_OWNED_TABS) {
      this.#relationshipClassesDirty = true;
      this.scheduleUpdate(false);
      return;
    }
    this.#syncRootAttrs();
    this.#needsCleanUp = true;
    this.scheduleUpdate(true, 150);
  }

  handleEvent(aEvent) {
    const type = aEvent.type;
    if (type === "TabOpen") {
      this.#rememberOpener(aEvent.target);
    }
    if (LINEAGE_EVENTS.has(type)) {
      this.#relationshipClassesDirty = true;
      this.#resizeTargetsDirty = true;
    }
    if (ANIMATED_EVENTS.has(type)) {
      let duration = 120;
      if (
        type === "ZenWorkspacesUIUpdate" ||
        type === "ZenWorkspaceDataChanged"
      ) {
        duration = Services.prefs.getIntPref(PREF_WORKSPACE_ANIM, 250);
      }
      this.scheduleUpdate(true, duration + 20);
    } else if (DND_ANIMATED_EVENTS.has(type)) {
      this.scheduleUpdate(true, 250);
    } else {
      this.scheduleUpdate(false);
    }
  }
}

window.gZenTreeConnectors = new nsZenTreeConnectors();
