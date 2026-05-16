/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  ZenSessionStore: "resource:///modules/zen/ZenSessionManager.sys.mjs",
  ContextualIdentityService:
    "resource://gre/modules/ContextualIdentityService.sys.mjs",
  ZenWindowSync: "resource:///modules/zen/ZenWindowSync.sys.mjs",
});

function normalizeUserContextId(value) {
  const normalized = typeof value === "string" ? Number(value) : value;
  if (!Number.isSafeInteger(normalized) || normalized <= 0) {
    return null;
  }
  return normalized;
}

class ZenSyncManager {

  #lastRefreshTimestamp = 0;

  /**
   * Returns sidebar data, ensuring it reflects the current live DOM state.
   *
   * The session store's save cycle may lag behind actual DOM changes
   * (e.g. a newly created tab won't appear in the sidebar until the
   * next save cycle). This method forces a fresh collection via
   * SessionStore.getCurrentState(true) before returning the data.
   *
   * A timestamp guard prevents redundant re-collections when the sync
   * engine calls this multiple times within the same sync cycle.
   */
  getSidebarData() {
    const now = Date.now();
    if (now - this.#lastRefreshTimestamp >= 500) {
      lazy.ZenSessionStore.refreshSidebarData();
      this.#lastRefreshTimestamp = now;
    }
    return lazy.ZenSessionStore.getSidebarData();
  }

  /**
   * Whether to ignore changes to items. This is used to prevent
   * infinite loops when applying incoming sync changes.
   *
   * @type {boolean}
   */
  #ignoreChanges = false;

  #changedItems = new Map();

  markItemChanged(item) {
    if (item.type && item.id && !this.#ignoreChanges) {
      const key = `${item.type}~${item.id}`;
      this.#changedItems.set(key, { type: item.type, id: item.id });
    }
  }

  #getChangedItems() {
    return Array.from(this.#changedItems.values());
  }

  #clearChangedItems() {
    this.#changedItems.clear();
  }

  notifyAboutChanges() {
    const changedItems = this.#getChangedItems();

    for (const item of changedItems) {
      Services.obs.notifyObservers(
        { wrappedJSObject: item },
        "zen-workspace-item-changed"
      );
    }
    this.#clearChangedItems();
  }

  async applyIncomingBatch(pulled, removals) {
    try {
      this.#ignoreChanges = true;
      this.#applyIncomingContainers(
        pulled.containers || [],
        removals.containers || []
      );

      const win = lazy.ZenWindowSync.firstSyncedWindow;
      if (win?.gZenWorkspaces) {
        await win.gZenWorkspaces._applySyncChanges(pulled, removals);
      }
    } catch (e) {
      console.error("ZenSyncManager: Failed to apply incoming sync data:", e);
      throw e;
    } finally {
      this.#ignoreChanges = false;
    }
  }

  #applyIncomingContainers(pulledContainers, removedContainers) {
    const localContainersById = new Map(
      lazy.ContextualIdentityService.getPublicIdentities().map(container => [
        container.userContextId,
        container,
      ])
    );

    for (const container of pulledContainers) {
      if (!container.name) {
        continue;
      }

      const userContextId = normalizeUserContextId(container.userContextId);
      if (userContextId === null) {
        console.warn(
          "ZenSyncManager: Ignoring incoming container with invalid userContextId",
          { container }
        );
        continue;
      }

      const existsLocally = localContainersById.has(userContextId);

      if (existsLocally) {
        lazy.ContextualIdentityService.update(
          userContextId,
          container.name,
          container.icon,
          container.color
        );
        continue;
      }

      const createdIdentity = lazy.ContextualIdentityService.create(
        container.name,
        container.icon,
        container.color,
        userContextId
      );
      if (createdIdentity) {
        localContainersById.set(createdIdentity.userContextId, createdIdentity);
      }
      if (createdIdentity && createdIdentity.userContextId !== userContextId) {
        console.warn("ZenSyncManager: Container sync created unexpected ID", {
          requestedId: userContextId,
          createdId: createdIdentity.userContextId,
          name: container.name,
        });
      }
    }

    for (const container of removedContainers) {
      const userContextId = normalizeUserContextId(container.userContextId);
      if (userContextId === null) {
        console.warn(
          "ZenSyncManager: Ignoring container removal with invalid userContextId",
          { container }
        );
        continue;
      }

      if (!localContainersById.has(userContextId)) {
        continue;
      }

      try {
        lazy.ContextualIdentityService.remove(userContextId);
        localContainersById.delete(userContextId);
      } catch {
        // Container may already be gone locally.
      }
    }
  }

  createSyncableTabData(
    tabData,
    { position, trimHistoryForUnpinned = false } = {},
  ) {
    if (
      !tabData?.zenSyncId ||
      tabData.zenIsEmpty ||
      tabData.zenLiveFolderItemId
    ) {
      return null;
    }

    const pinned = !!tabData.pinned;
    let entries = Array.isArray(tabData.entries) ? [...tabData.entries] : [];
    let index = typeof tabData.index === "number" ? tabData.index : 1;

    if (trimHistoryForUnpinned && !pinned && entries.length) {
      const entryIndex = Math.max(0, index - 1);
      const entry = entries[entryIndex] || entries[0];
      entries = entry ? [entry] : [];
      index = 1;
    }

    const isEssential = !!tabData.zenEssential;
    const syncTabData = {
      entries,
      groupId: tabData.groupId || null,
      image: typeof tabData.image === "string" ? tabData.image : "",
      index,
      pinned,
      userContextId: parseInt(tabData.userContextId, 10) || 0,
      zenDefaultUserContextId: !!tabData.zenDefaultUserContextId,
      zenEssential: isEssential,
      zenHasStaticIcon: !!tabData.zenHasStaticIcon,
      zenSyncId: tabData.zenSyncId,
      zenWorkspace: isEssential ? null : tabData.zenWorkspace || null,
    };

    if (typeof tabData.zenStaticLabel === "string") {
      syncTabData.zenStaticLabel = tabData.zenStaticLabel;
    }
    if (tabData._zenPinnedInitialState) {
      syncTabData._zenPinnedInitialState = tabData._zenPinnedInitialState;
    }
    if (typeof position === "number") {
      syncTabData.position = position;
    }

    return syncTabData;
  }
}

export const ZenSyncStore = new ZenSyncManager();
