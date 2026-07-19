/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { XPCOMUtils } from "resource://gre/modules/XPCOMUtils.sys.mjs";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  SessionStore: "resource:///modules/sessionstore/SessionStore.sys.mjs",
});

XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "gSyncOnlyPinnedTabs",
  "zen.window-sync.sync-only-pinned-tabs",
  true
);

export class ZenSpaceSyncResolver {
  #spaceManager;

  constructor(spaceManager) {
    this.#spaceManager = spaceManager;
  }

  get #win() {
    return this.#spaceManager.ownerWindow;
  }

  /**
   * Applies live sync changes: updates workspace cache, removes deleted items,
   * then creates/updates pulled items.
   *
   * @param {{ spaces: Array, tabs: Array, folders: Array, splits: Array }} pulled  Reconcile-pulled items.
   * @param {{ spaces: Array, tabs: Array, folders: Array, splits: Array }} removals  Items to remove.
   */
  async applySyncChanges(pulled, removals = {}) {
    if (
      !this.#spaceManager.shouldHaveWorkspaces ||
      this.#spaceManager.privateWindowOrDisabled
    ) {
      return;
    }
    await this.#spaceManager.promiseInitialized;

    // 1. Update workspace cache (remove deleted, merge pulled)
    const removedSpaceIds = new Set((removals.spaces || []).map(s => s.uuid));
    if (removedSpaceIds.size || pulled.spaces?.length) {
      const localMap = new Map(
        this.#spaceManager
          .getWorkspaces()
          .filter(w => !removedSpaceIds.has(w.uuid))
          .map(w => [w.uuid, w])
      );
      for (const space of pulled.spaces || []) {
        if (!space?.uuid) {
          continue;
        }
        const existing = localMap.get(space.uuid);
        localMap.set(space.uuid, existing ? { ...existing, ...space } : space);
      }
      await this.#spaceManager.propagateWorkspaces(
        this.#getOrderedWorkspacesByPosition(Array.from(localMap.values()))
      );
      this.#spaceManager._propagateWorkspaceDataForSync();
    }

    // 2. Remove deleted folders/tabs
    await this.#removeSyncedItems(removals);

    // 3. Create/update pulled folders and tabs
    await this.#applyPulledItems(pulled);
  }

  /**
   * Removes folders and tabs that were previously synced but are absent
   * from the latest incoming sync payload.
   *
   * @param {{ folders: Array, tabs: Array, splits: Array }} removals
   */
  async #removeSyncedItems(removals) {
    if (
      !this.#spaceManager.shouldHaveWorkspaces ||
      this.#spaceManager.privateWindowOrDisabled
    ) {
      return;
    }

    // Remove folders first; tabs inside them are removed together with the folder.
    for (const folderData of removals.folders || []) {
      if (!folderData.id) {
        continue;
      }
      const folder = this.#win.document.getElementById(folderData.id);
      if (folder?.isZenFolder) {
        await folder.delete();
      }
    }

    for (const splitData of removals.splits || []) {
      if (!splitData.groupId || !this.#win.gZenViewSplitter?._data) {
        continue;
      }
      const groupIndex = this.#win.gZenViewSplitter._data.findIndex(
        group => group.groupId === splitData.groupId
      );
      if (groupIndex >= 0) {
        this.#win.gZenViewSplitter.removeGroup(groupIndex);
      }
    }

    // Remove tabs not already cleaned up by folder deletion.
    const pinnedOnly = lazy.gSyncOnlyPinnedTabs;
    for (const tabData of removals.tabs || []) {
      const syncId = this.#normalizeIncomingTabSyncId(tabData);
      if (!syncId) {
        continue;
      }
      const tab = this.#findTabBySyncId(syncId);
      if (tab && this.#win.gBrowser.isTab(tab)) {
        if (pinnedOnly && !tab.pinned) {
          continue;
        }
        this.#win.gBrowser.removeTab(tab, { animate: false });
      }
    }
  }

  /**
   * Creates or updates folders and tabs that arrived from Firefox Sync.
   *
   * Called on ONE window by ZenSyncManager, ZenWindowSync propagates every
   * new/updated item to all other open windows automatically.
   *
   * Ordering rules:
   *   1. Folders first: tabs need the folder elements to exist so they can
   *      be placed inside them immediately after being pinned.
   *   2. Essential tabs: use addToEssentials() which handles pinning and
   *      placement in the essentials container.
   *   3. Regular pinned tabs: restoreInitialTabData → pinTab → addTabs into
   *      their folder (if any).
   *   4. Unpinned tabs: created with addTrustedTab and placed in the
   *      correct workspace/folder.
   *
   * @param {{ tabs: Array, folders: Array, splits: Array }} pulled  Reconcile-pulled items.
   */
  async #applyPulledItems(pulled) {
    if (
      !this.#spaceManager.shouldHaveWorkspaces ||
      this.#spaceManager.privateWindowOrDisabled
    ) {
      return;
    }

    const incomingFolders = pulled.folders || [];
    const incomingSplits = pulled.splits || [];
    // Filter out folder placeholder tabs, they should never be synced.
    let incomingTabs = (pulled.tabs || []).filter(t => !t.zenIsEmpty);

    // When the pref is set, skip incoming unpinned tabs.
    if (lazy.gSyncOnlyPinnedTabs) {
      incomingTabs = incomingTabs.filter(t => t.pinned);
    }

    if (
      !incomingFolders.length &&
      !incomingTabs.length &&
      !incomingSplits.length
    ) {
      return;
    }

    // Step 1: create or update folders.
    for (const folderData of incomingFolders) {
      this.#processIncomingFolder(folderData);
    }

    // Step 2: create or update tabs (pinned AND unpinned).
    for (const tabData of incomingTabs) {
      this.#processIncomingTab(tabData);
    }

    this.#applyIncomingTabPositions(incomingTabs);
    this.#applyIncomingFolderStructure(incomingFolders);
    this.#applyIncomingSplitViewData(incomingSplits);
  }

  #processIncomingFolder(folderData) {
    if (!folderData.id) {
      return;
    }
    const existing = this.#win.document.getElementById(folderData.id);
    if (existing?.isZenFolder) {
      // Update existing folder
      if (folderData.name && existing.label !== folderData.name) {
        existing.label = folderData.name;
      }
      if (folderData.collapsed !== undefined) {
        existing.collapsed = folderData.collapsed;
      }
      if (folderData.workspaceId) {
        existing.setAttribute("zen-workspace-id", folderData.workspaceId);
      }
      if (folderData.saveOnWindowClose !== undefined) {
        existing.saveOnWindowClose = folderData.saveOnWindowClose;
      }
      if (folderData.isLiveFolder !== undefined) {
        existing.isLiveFolder = folderData.isLiveFolder;
      }
      if (folderData.userIcon !== undefined) {
        this.#win.gZenFolders.setFolderUserIcon(existing, folderData.userIcon);
      }
      existing.dispatchEvent(
        new this.#win.CustomEvent("TabGroupUpdate", { bubbles: true })
      );
    } else {
      this.#win.gZenFolders.createFolder([], {
        id: folderData.id,
        label: folderData.name || "Folder",
        workspaceId: folderData.workspaceId,
        collapsed: folderData.collapsed,
        saveOnWindowClose: folderData.saveOnWindowClose,
        isLiveFolder: folderData.isLiveFolder,
      });
      if (folderData.userIcon !== undefined) {
        const createdFolder = this.#win.document.getElementById(folderData.id);
        if (createdFolder?.isZenFolder) {
          this.#win.gZenFolders.setFolderUserIcon(
            createdFolder,
            folderData.userIcon
          );
        }
      }
    }
  }

  #processIncomingTab(tabData) {
    const syncId = this.#normalizeIncomingTabSyncId(tabData);
    if (!syncId) {
      return;
    }
    const existingTab = this.#findTabBySyncId(syncId);
    if (existingTab && this.#win.gBrowser.isTab(existingTab)) {
      this.#updateExistingIncomingTab(existingTab, tabData);
      return;
    }
    if (tabData.pinned) {
      this.#createIncomingPinnedTab(tabData, syncId);
    } else {
      this.#createIncomingUnpinnedTab(tabData, syncId);
    }
  }

  #updateExistingIncomingTab(existingTab, tabData) {
    this.#applyIncomingTabContainer(existingTab, tabData);

    const isCurrentlyEssential = existingTab.hasAttribute("zen-essential");
    const shouldBeEssential = !!tabData.zenEssential;
    const incomingPinnedInitialState =
      this.#getSyncedPinnedInitialState(tabData);
    if (incomingPinnedInitialState) {
      existingTab._zenPinnedInitialState = incomingPinnedInitialState;
    }
    if (shouldBeEssential && !isCurrentlyEssential) {
      this.#win.gZenPinnedTabManager.addToEssentials(existingTab);
    } else if (!shouldBeEssential && isCurrentlyEssential) {
      this.#win.gZenPinnedTabManager.removeEssentials(
        existingTab,
        /* unpin */ false
      );
    }

    // Workspace changes: skip for essentials, they don't belong to a workspace.
    if (
      !shouldBeEssential &&
      tabData.zenWorkspace &&
      existingTab.getAttribute("zen-workspace-id") !== tabData.zenWorkspace
    ) {
      this.#spaceManager.moveTabToWorkspace(existingTab, tabData.zenWorkspace);
    }

    // Pinned state changes (after essentials, since essentials implies pinned).
    if (tabData.pinned !== undefined && existingTab.pinned !== tabData.pinned) {
      if (tabData.pinned) {
        this.#win.gBrowser.pinTab(existingTab);
      } else {
        this.#win.gBrowser.unpinTab(existingTab);
      }
    }

    // Group/folder membership.
    const currentGroupId = existingTab.group?.id || null;
    const targetGroupId = tabData.groupId || null;
    const targetGroup = targetGroupId
      ? this.#win.document.getElementById(targetGroupId)
      : null;
    if (
      currentGroupId !== targetGroupId &&
      !targetGroup?.hasAttribute("split-view-group")
    ) {
      if (targetGroupId) {
        if (targetGroup?.isZenFolder) {
          targetGroup.addTabs([existingTab]);
        }
      } else if (currentGroupId) {
        this.#win.gBrowser.ungroupTab(existingTab);
      }
    }

    this.#applyIncomingTabDefaultUserContextId(existingTab, tabData);

    // Visual updates.
    if (tabData.image && existingTab.getAttribute("image") !== tabData.image) {
      this.#win.gBrowser.setIcon(existingTab, tabData.image);
    }
    if (typeof tabData.zenStaticLabel === "string") {
      existingTab.zenStaticLabel = tabData.zenStaticLabel;
      this.#win.gBrowser._setTabLabel(existingTab, tabData.zenStaticLabel);
    } else {
      delete existingTab.zenStaticLabel;
      const activeEntry = this.#getSyncedTabActiveEntry(tabData);
      if (activeEntry?.title) {
        this.#win.gBrowser._setTabLabel(existingTab, activeEntry.title);
      }
    }
    if (tabData.zenHasStaticIcon && tabData.image) {
      existingTab.zenStaticIcon = tabData.image;
    } else {
      delete existingTab.zenStaticIcon;
    }
    this.#applyIncomingTabNavigation(existingTab, tabData);
  }

  #createIncomingPinnedTab(tabData, syncId) {
    const pinnedInitialState = this.#getSyncedPinnedInitialState(tabData);
    const activeEntry = this.#getSyncedTabActiveEntry(tabData);

    const pinnedOptions = { createLazyBrowser: true };
    const pinnedUserContextId = this.#getSyncedTabUserContextId(tabData);
    if (pinnedUserContextId) {
      pinnedOptions.userContextId = pinnedUserContextId;
    }
    const newTab = this.#win.gBrowser.addTrustedTab(
      "about:blank",
      pinnedOptions
    );

    if (!this.#setIncomingTabSyncId(newTab, syncId)) {
      this.#win.gBrowser.removeTab(newTab, { animate: false });
      return;
    }

    if (tabData.zenEssential) {
      this.#setupIncomingEssentialTab(
        newTab,
        tabData,
        pinnedInitialState,
        activeEntry
      );
    } else {
      this.#setupIncomingRegularPinnedTab(
        newTab,
        tabData,
        pinnedInitialState,
        activeEntry
      );
    }
  }

  #setupIncomingEssentialTab(newTab, tabData, pinnedInitialState, activeEntry) {
    if (typeof tabData.zenStaticLabel === "string") {
      newTab.zenStaticLabel = tabData.zenStaticLabel;
    }
    if (tabData.zenHasStaticIcon && tabData.image) {
      newTab.zenStaticIcon = tabData.image;
    }
    if (pinnedInitialState) {
      newTab._zenPinnedInitialState = pinnedInitialState;
    }
    const label =
      newTab.zenStaticLabel ||
      activeEntry?.title ||
      pinnedInitialState?.entry?.title ||
      "";
    if (label) {
      this.#win.gBrowser._setTabLabel(newTab, label);
    }
    const image = tabData.image || pinnedInitialState?.image || "";
    if (image) {
      this.#win.gBrowser.setIcon(newTab, image);
    }
    this.#win.gZenPinnedTabManager.addToEssentials(newTab);
    this.#applyIncomingTabNavigation(newTab, tabData);
    this.#applyIncomingTabDefaultUserContextId(newTab, tabData);
  }

  #setupIncomingRegularPinnedTab(
    newTab,
    tabData,
    pinnedInitialState,
    activeEntry
  ) {
    this.#win.gZenSessionStore.restoreInitialTabData(newTab, tabData);
    if (!newTab._zenPinnedInitialState && pinnedInitialState) {
      newTab._zenPinnedInitialState = pinnedInitialState;
    }
    const label =
      newTab.zenStaticLabel ||
      activeEntry?.title ||
      pinnedInitialState?.entry?.title ||
      "";
    if (label) {
      this.#win.gBrowser._setTabLabel(newTab, label);
    }
    const image = tabData.image || pinnedInitialState?.image || "";
    if (image) {
      this.#win.gBrowser.setIcon(newTab, image);
    }
    this.#win.gBrowser.pinTab(newTab);
    this.#applyIncomingTabNavigation(newTab, tabData);
    if (tabData.groupId) {
      const folder = this.#win.document.getElementById(tabData.groupId);
      if (folder?.isZenFolder) {
        folder.addTabs([newTab]);
      }
    }
    this.#applyIncomingTabDefaultUserContextId(newTab, tabData);
  }

  #createIncomingUnpinnedTab(tabData, syncId) {
    const activeEntry = this.#getSyncedTabActiveEntry(tabData) || {};
    const url = activeEntry.url || "about:blank";
    const unpinnedOptions = { createLazyBrowser: true };
    const unpinnedUserContextId = this.#getSyncedTabUserContextId(tabData);
    if (unpinnedUserContextId) {
      unpinnedOptions.userContextId = unpinnedUserContextId;
    }
    const newTab = this.#win.gBrowser.addTrustedTab(url, unpinnedOptions);
    if (!this.#setIncomingTabSyncId(newTab, syncId)) {
      this.#win.gBrowser.removeTab(newTab, { animate: false });
      return;
    }
    if (tabData.zenWorkspace) {
      newTab.setAttribute("zen-workspace-id", tabData.zenWorkspace);
    }
    const label = activeEntry.title || url;
    if (label) {
      this.#win.gBrowser._setTabLabel(newTab, label);
    }
    if (tabData.image) {
      this.#win.gBrowser.setIcon(newTab, tabData.image);
    }
    // Place in folder if applicable
    if (tabData.groupId) {
      const folder = this.#win.document.getElementById(tabData.groupId);
      if (folder?.isZenFolder) {
        folder.addTabs([newTab]);
      }
    }
    this.#applyIncomingTabDefaultUserContextId(newTab, tabData);
  }

  #getSyncedTabActiveEntry(tabData) {
    const entries = tabData.entries || [];
    if (entries.length) {
      const entryIndex =
        typeof tabData.index === "number" ? Math.max(0, tabData.index - 1) : 0;
      return entries[entryIndex] ?? entries[0] ?? null;
    }
    return tabData._zenPinnedInitialState?.entry || null;
  }

  #getSyncedPinnedInitialState(tabData) {
    const incomingPinnedInitialState = tabData?._zenPinnedInitialState;
    if (incomingPinnedInitialState?.entry?.url) {
      return {
        ...incomingPinnedInitialState,
        entry: { ...incomingPinnedInitialState.entry },
        image: incomingPinnedInitialState.image || tabData.image || "",
      };
    }

    const fallbackEntry = this.#getSyncedTabActiveEntry(tabData);
    if (!fallbackEntry?.url) {
      return null;
    }

    return {
      entry: { ...fallbackEntry },
      image: tabData.image || "",
    };
  }

  #normalizeIncomingTabSyncId(tabData) {
    const rawSyncId = tabData?.zenSyncId || tabData?.zenPinnedId;
    if (typeof rawSyncId !== "string") {
      return null;
    }

    const syncId = rawSyncId.trim();
    return syncId || null;
  }

  #findTabBySyncId(syncId) {
    if (!syncId) {
      return null;
    }

    const fromDocument = this.#win.document.getElementById(syncId);
    if (fromDocument && this.#win.gBrowser.isTab(fromDocument)) {
      return fromDocument;
    }

    return (
      this.#win.gBrowser.tabs.find(
        tab => tab?.id === syncId || tab?.getAttribute("id") === syncId
      ) || null
    );
  }

  #setIncomingTabSyncId(tab, syncId) {
    if (!tab || !syncId) {
      return false;
    }

    tab.id = syncId;
    if (tab.id !== syncId) {
      tab.setAttribute("id", syncId);
    }

    return tab.id === syncId;
  }

  #getSyncedTabState(tab) {
    try {
      return JSON.parse(lazy.SessionStore.getTabState(tab));
    } catch (e) {
      return null;
    }
  }

  #getSyncedTabUserContextId(tabData) {
    return parseInt(tabData?.userContextId, 10) || 0;
  }

  #applyIncomingTabDefaultUserContextId(tab, tabData) {
    if (!tab || !this.#win.gBrowser.isTab(tab)) {
      return;
    }

    if (tabData?.zenDefaultUserContextId) {
      tab.setAttribute("zenDefaultUserContextId", "true");
    } else {
      tab.removeAttribute("zenDefaultUserContextId");
    }
  }

  #applyIncomingTabContainer(tab, tabData) {
    if (!tab || !this.#win.gBrowser.isTab(tab)) {
      return;
    }

    const targetUserContextId = this.#getSyncedTabUserContextId(tabData);
    const currentUserContextId =
      parseInt(tab.getAttribute("usercontextid"), 10) || 0;

    if (
      currentUserContextId !== targetUserContextId &&
      typeof tab.setUserContextId === "function"
    ) {
      tab.setUserContextId(targetUserContextId);
    }

    if (tab.hasAttribute("zen-essential")) {
      const essentialsSection = this.#spaceManager.getEssentialsSection(tab);
      if (essentialsSection && tab.parentNode !== essentialsSection) {
        essentialsSection.appendChild(tab);
      }
    }
  }

  #applyIncomingTabNavigation(tab, tabData) {
    const incomingEntry = this.#getSyncedTabActiveEntry(tabData);
    if (!incomingEntry?.url || tab.hasAttribute("zen-empty-tab")) {
      return;
    }

    const currentState = this.#getSyncedTabState(tab);
    if (!currentState) {
      return;
    }

    const entryIndex =
      typeof currentState.index === "number"
        ? Math.max(0, currentState.index - 1)
        : 0;
    const currentEntry =
      currentState.entries?.[entryIndex] ?? currentState.entries?.[0] ?? null;

    if (currentEntry?.url === incomingEntry.url) {
      return;
    }

    const incomingEntries = Array.isArray(tabData.entries)
      ? tabData.entries.map(entry => ({ ...entry }))
      : [{ ...incomingEntry }];
    const incomingIndex = Math.min(
      Math.max(typeof tabData.index === "number" ? tabData.index : 1, 1),
      incomingEntries.length
    );

    const newState = {
      ...currentState,
      entries: incomingEntries,
      index: incomingIndex,
    };
    if (tabData.image) {
      newState.image = tabData.image;
    }
    delete newState.scroll;
    lazy.SessionStore.setTabState(tab, newState);
  }

  #getSyncedFolderContainer(folderData) {
    if (folderData.parentId) {
      const parentFolder = this.#win.document.getElementById(
        folderData.parentId
      );
      if (!parentFolder?.isZenFolder) {
        return null;
      }
      return {
        container: parentFolder.groupContainer,
        parentFolder,
      };
    }

    const workspaceId =
      folderData.workspaceId || this.#spaceManager.activeWorkspace;
    const workspaceElement = this.#spaceManager.workspaceElement(workspaceId);
    return {
      container: workspaceElement?.pinnedTabsContainer,
      parentFolder: null,
    };
  }

  #getOrderedIncomingFolders(folderDataList) {
    const childrenByParent = new Map();
    for (const folderData of folderDataList) {
      const parentId = folderData.parentId || null;
      if (!childrenByParent.has(parentId)) {
        childrenByParent.set(parentId, []);
      }
      childrenByParent.get(parentId).push(folderData);
    }

    const result = [];
    const seen = new Set();
    const visiting = new Set();

    const sortChildren = parentId => {
      const children = childrenByParent.get(parentId) || [];
      for (const folderData of children) {
        visitChild(folderData, children);
      }
    };

    const visitChild = (folderData, siblings) => {
      if (seen.has(folderData.id) || visiting.has(folderData.id)) {
        return;
      }
      visiting.add(folderData.id);
      const siblingId =
        folderData.prevSiblingInfo?.type === "group"
          ? folderData.prevSiblingInfo.id
          : null;
      if (siblingId) {
        const sibling = siblings.find(other => other.id === siblingId);
        if (sibling) {
          visitChild(sibling, siblings);
        }
      }
      visiting.delete(folderData.id);
      seen.add(folderData.id);
      result.push(folderData);
      sortChildren(folderData.id);
    };

    sortChildren(null);
    for (const folderData of folderDataList) {
      if (!seen.has(folderData.id)) {
        result.push(folderData);
      }
    }
    return result;
  }

  #applyIncomingFolderStructure(folderDataList) {
    const orderedFolders = this.#getOrderedIncomingFolders(
      folderDataList.filter(folderData => folderData?.id)
    );

    for (const folderData of orderedFolders) {
      const folder = this.#win.document.getElementById(folderData.id);
      if (!folder?.isZenFolder) {
        continue;
      }

      const placement = this.#getSyncedFolderContainer(folderData);
      const container = placement?.container;
      if (!container) {
        continue;
      }

      const previousItem =
        folderData.prevSiblingInfo?.type === "tab" ||
        folderData.prevSiblingInfo?.type === "group"
          ? this.#win.document.getElementById(folderData.prevSiblingInfo.id)
          : null;

      this.#win.gBrowser.zenHandleTabMove(folder, () => {
        if (previousItem?.parentNode === container && previousItem !== folder) {
          previousItem.after(folder);
          return;
        }

        if (placement.parentFolder) {
          const initialSibling =
            placement.parentFolder.tabs.find(tab =>
              tab.hasAttribute("zen-empty-tab")
            ) || null;
          if (
            initialSibling?.parentNode === container &&
            initialSibling !== folder
          ) {
            initialSibling.after(folder);
            return;
          }
          container.insertBefore(folder, container.firstChild);
          return;
        }
        container.insertBefore(folder, container.firstChild);
      });
    }

    this.#spaceManager.makeSureEmptyTabIsFirst();
    this.#spaceManager.updateTabsContainers();
  }

  #applyIncomingSplitViewData(splitViewDataList) {
    const splitter = this.#win.gZenViewSplitter;
    if (
      !splitter?.restoreDataFromSessionStore ||
      !splitter?.storeDataForSessionStore ||
      !splitter?._data
    ) {
      return;
    }

    const localSplitGroupsById = new Map(
      splitter.storeDataForSessionStore().map(group => [group.groupId, group])
    );

    for (const splitData of splitViewDataList) {
      if (
        !splitData?.groupId ||
        !Array.isArray(splitData.tabs) ||
        splitData.tabs.length < 2
      ) {
        continue;
      }

      const existingGroup = localSplitGroupsById.get(splitData.groupId);
      if (
        existingGroup &&
        this.#splitViewDataMatches(existingGroup, splitData)
      ) {
        continue;
      }

      const incomingTabIds = new Set(
        splitData.tabs.filter(tabId => typeof tabId === "string" && tabId)
      );
      const conflictingGroupIndexes = [];

      for (let index = 0; index < splitter._data.length; index++) {
        const group = splitter._data[index];
        if (
          group.groupId === splitData.groupId ||
          group.tabs.some(tab => incomingTabIds.has(tab.id))
        ) {
          conflictingGroupIndexes.push(index);
        }
      }

      for (const index of conflictingGroupIndexes.sort((a, b) => b - a)) {
        splitter.removeGroup(index, { suppressEvents: true });
      }

      splitter.restoreDataFromSessionStore([splitData]);
      localSplitGroupsById.set(splitData.groupId, splitData);
    }

    splitter.onAfterWorkspaceSessionRestore?.();
    this.#spaceManager.makeSureEmptyTabIsFirst();
    this.#spaceManager.updateTabsContainers();
  }

  #splitViewDataMatches(localSplitData, incomingSplitData) {
    return (
      localSplitData.groupId === incomingSplitData.groupId &&
      localSplitData.gridType === incomingSplitData.gridType &&
      this.#arrayMatches(localSplitData.tabs, incomingSplitData.tabs) &&
      this.#splitLayoutTreeMatches(
        localSplitData.layoutTree,
        incomingSplitData.layoutTree
      )
    );
  }

  #arrayMatches(localItems, incomingItems) {
    if (
      !Array.isArray(localItems) ||
      !Array.isArray(incomingItems) ||
      localItems.length !== incomingItems.length
    ) {
      return false;
    }

    return localItems.every((item, index) => item === incomingItems[index]);
  }

  #splitLayoutTreeMatches(localNode, incomingNode) {
    if (!localNode || !incomingNode || localNode.type !== incomingNode.type) {
      return false;
    }

    if (localNode.sizeInParent !== incomingNode.sizeInParent) {
      return false;
    }

    if (localNode.type === "leaf") {
      return localNode.tabId === incomingNode.tabId;
    }

    if (localNode.direction !== incomingNode.direction) {
      return false;
    }

    return (
      Array.isArray(localNode.children) &&
      Array.isArray(incomingNode.children) &&
      localNode.children.length === incomingNode.children.length &&
      localNode.children.every((child, index) =>
        this.#splitLayoutTreeMatches(child, incomingNode.children[index])
      )
    );
  }

  #applyIncomingTabPositions(tabDataList) {
    const orderedTabs = [...tabDataList]
      .filter(tabData => typeof tabData.position === "number")
      .sort((a, b) => a.position - b.position);

    if (!orderedTabs.length) {
      return;
    }

    const lastItemByContainer = new Map();
    const movedItems = new Set();

    for (const tabData of orderedTabs) {
      const syncId = this.#normalizeIncomingTabSyncId(tabData);
      if (!syncId) {
        continue;
      }
      const tab = this.#findTabBySyncId(syncId);
      if (
        !tab ||
        !this.#win.gBrowser.isTab(tab) ||
        tab.hasAttribute("zen-empty-tab")
      ) {
        continue;
      }

      const moveItem = tab.group?.hasAttribute("split-view-group")
        ? tab.group
        : tab;
      if (!moveItem || movedItems.has(moveItem)) {
        continue;
      }

      const placement = this.#getSyncedTabContainer(tab);
      if (!placement?.container) {
        continue;
      }

      const { container, initialSibling } = placement;
      const previousItem = lastItemByContainer.get(container);

      this.#win.gBrowser.zenHandleTabMove(moveItem, () => {
        if (
          previousItem?.parentNode === container &&
          previousItem !== moveItem
        ) {
          previousItem.after(moveItem);
        } else if (
          initialSibling?.parentNode === container &&
          initialSibling !== moveItem
        ) {
          initialSibling.after(moveItem);
        } else {
          container.insertBefore(moveItem, container.firstChild);
        }
      });

      lastItemByContainer.set(container, moveItem);
      movedItems.add(moveItem);
    }

    this.#spaceManager.makeSureEmptyTabIsFirst();
    this.#spaceManager.updateTabsContainers();
  }

  #getSyncedTabContainer(tab) {
    if (
      !tab ||
      !this.#win.gBrowser.isTab(tab) ||
      tab.group?.hasAttribute("split-view-group")
    ) {
      return null;
    }

    if (tab.group?.isZenFolder) {
      return {
        container: tab.group.groupContainer,
        initialSibling:
          tab.group.tabs.find(groupTab =>
            groupTab.hasAttribute("zen-empty-tab")
          ) || null,
      };
    }

    if (tab.hasAttribute("zen-essential")) {
      return {
        container: this.#spaceManager.getEssentialsSection(tab),
        initialSibling: null,
      };
    }

    const workspaceId =
      tab.getAttribute("zen-workspace-id") ||
      this.#spaceManager.activeWorkspace;
    const workspaceElement = this.#spaceManager.workspaceElement(workspaceId);
    return {
      container: tab.pinned
        ? workspaceElement?.pinnedTabsContainer
        : workspaceElement?.tabsContainer,
      initialSibling: null,
    };
  }

  #getOrderedWorkspacesByPosition(workspaces) {
    return [...workspaces]
      .map((workspace, index) => ({ workspace, index }))
      .sort((a, b) => {
        const aPosition =
          typeof a.workspace.position === "number"
            ? a.workspace.position
            : a.index;
        const bPosition =
          typeof b.workspace.position === "number"
            ? b.workspace.position
            : b.index;
        return aPosition - bPosition || a.index - b.index;
      })
      .map(({ workspace }) => {
        // strip the position property that comes from pulled workspaces
        const rest = { ...workspace };
        delete rest.position;
        return rest;
      });
  }
}
