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
  getSidebarData() {
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
}

export const ZenSyncStore = new ZenSyncManager();
