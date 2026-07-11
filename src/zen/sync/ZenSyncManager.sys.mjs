/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};
const CONTAINER_SYNC_MAPPINGS_PREF = "zen.sync.container-id-mappings";
const MAX_CONTAINER_SEMANTIC_ORDINAL = 128;

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

function normalizeContainerSyncId(value) {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > 64 || normalized.includes("~")) {
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

  // Firefox container IDs are profile-local. Sync records use opaque IDs and
  // this local mapping translates them to each profile's numeric IDs.
  #containerMappings = null;

  #getContainerMappings() {
    if (this.#containerMappings) {
      return this.#containerMappings;
    }

    let stored = {};
    try {
      stored = JSON.parse(
        Services.prefs.getStringPref(CONTAINER_SYNC_MAPPINGS_PREF, "{}")
      );
    } catch {
      // A malformed local mapping is rebuilt as containers are encountered.
    }
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) {
      stored = {};
    }

    const primaryByLocalId = {};
    const localIdBySyncId = {};
    for (const [localIdValue, syncIdValue] of Object.entries(
      stored.primaryByLocalId || {}
    )) {
      const localId = normalizeUserContextId(localIdValue);
      const syncId = normalizeContainerSyncId(syncIdValue);
      if (localId && syncId) {
        localIdBySyncId[syncId] = localId;
      }
    }
    for (const [syncIdValue, localIdValue] of Object.entries(
      stored.localIdBySyncId || {}
    )) {
      const localId = normalizeUserContextId(localIdValue);
      const syncId = normalizeContainerSyncId(syncIdValue);
      if (localId && syncId) {
        localIdBySyncId[syncId] = localId;
      }
    }
    for (const [syncId, localId] of Object.entries(localIdBySyncId).sort()) {
      primaryByLocalId[localId] ??= syncId;
    }

    this.#containerMappings = { primaryByLocalId, localIdBySyncId };
    return this.#containerMappings;
  }

  #saveContainerMappings() {
    Services.prefs.setStringPref(
      CONTAINER_SYNC_MAPPINGS_PREF,
      JSON.stringify({ version: 1, ...this.#getContainerMappings() })
    );
  }

  #recomputePrimaryContainerSyncId(localId) {
    const mappings = this.#getContainerMappings();
    const aliases = Object.entries(mappings.localIdBySyncId)
      .filter(([, mappedLocalId]) => mappedLocalId === localId)
      .map(([syncId]) => syncId)
      .sort();
    if (aliases.length) {
      mappings.primaryByLocalId[localId] = aliases[0];
    } else {
      delete mappings.primaryByLocalId[localId];
    }
  }

  getContainerSyncId(userContextId) {
    const localId = normalizeUserContextId(userContextId);
    if (!localId) {
      return null;
    }

    const mappings = this.#getContainerMappings();
    if (mappings.primaryByLocalId[localId]) {
      return mappings.primaryByLocalId[localId];
    }

    let syncId;
    do {
      syncId = Services.uuid.generateUUID().toString().slice(1, -1);
    } while (mappings.localIdBySyncId[syncId]);
    mappings.primaryByLocalId[localId] = syncId;
    mappings.localIdBySyncId[syncId] = localId;
    this.#saveContainerMappings();
    return syncId;
  }

  getContainerSyncIds(userContextId) {
    const localId = normalizeUserContextId(userContextId);
    if (!localId) {
      return [];
    }

    const mappings = this.#getContainerMappings();
    let aliases = Object.entries(mappings.localIdBySyncId)
      .filter(([, mappedLocalId]) => mappedLocalId === localId)
      .map(([syncId]) => syncId)
      .sort();
    if (!aliases.length) {
      const syncId = this.getContainerSyncId(localId);
      aliases = syncId ? [syncId] : [];
    }
    return aliases;
  }

  resolveLocalContainerId(syncIdValue) {
    const syncId = normalizeContainerSyncId(syncIdValue);
    if (!syncId) {
      return null;
    }
    return (
      normalizeUserContextId(
        this.#getContainerMappings().localIdBySyncId[syncId]
      ) || null
    );
  }

  #associateContainerSyncId(userContextId, syncIdValue) {
    const localId = normalizeUserContextId(userContextId);
    const syncId = normalizeContainerSyncId(syncIdValue);
    if (!localId || !syncId) {
      return null;
    }

    const mappings = this.#getContainerMappings();
    const previousLocalId = mappings.localIdBySyncId[syncId];
    if (previousLocalId && previousLocalId !== localId) {
      delete mappings.localIdBySyncId[syncId];
      this.#recomputePrimaryContainerSyncId(previousLocalId);
    }
    mappings.localIdBySyncId[syncId] = localId;
    this.#recomputePrimaryContainerSyncId(localId);
    this.#saveContainerMappings();
    return localId;
  }

  #getContainerSemanticSignature(container) {
    if (!container) {
      return null;
    }
    const name = container.l10nId
      ? null
      : lazy.ContextualIdentityService.getUserContextLabel(
          container.userContextId
        )
          .trim()
          .toLocaleLowerCase();
    return JSON.stringify({
      l10nId: container.l10nId || null,
      name,
      icon: container.icon || null,
      color: container.color || null,
    });
  }

  getContainerSemanticOrdinal(userContextId) {
    const localId = normalizeUserContextId(userContextId);
    const containers = lazy.ContextualIdentityService.getPublicIdentities();
    const container = containers.find(
      candidate => candidate.userContextId === localId
    );
    const signature = this.#getContainerSemanticSignature(container);
    if (!signature) {
      return 0;
    }
    const ordinal = containers
      .filter(
        candidate =>
          this.#getContainerSemanticSignature(candidate) === signature
      )
      .sort((a, b) => a.userContextId - b.userContextId)
      .findIndex(candidate => candidate.userContextId === localId);
    return Math.max(0, ordinal);
  }

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
      // ContextualIdentityService.remove() clears local site data. Container
      // deletion therefore remains an explicit, device-local operation.
      this.#applyIncomingContainers(pulled.containers || []);
      this.#mapIncomingSpaceReferences(pulled.spaces || []);

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

  #getIncomingContainerSyncId(container) {
    const syncId = normalizeContainerSyncId(container?.syncId);
    if (syncId) {
      return syncId;
    }
    const legacyId = normalizeUserContextId(container?.userContextId);
    return legacyId ? String(legacyId) : null;
  }

  #containerMetadataMatches(localContainer, incomingContainer) {
    const identityMatches = incomingContainer.l10nId
      ? localContainer.l10nId === incomingContainer.l10nId
      : lazy.ContextualIdentityService.getUserContextLabel(
          localContainer.userContextId
        ) === incomingContainer.name;
    return (
      identityMatches &&
      localContainer.icon === incomingContainer.icon &&
      localContainer.color === incomingContainer.color
    );
  }

  #getIncomingContainerOrdinal(container) {
    return Number.isSafeInteger(container?.semanticOrdinal) &&
      container.semanticOrdinal >= 0 &&
      container.semanticOrdinal <= MAX_CONTAINER_SEMANTIC_ORDINAL
      ? container.semanticOrdinal
      : 0;
  }

  #getMatchingLocalContainers(localContainers, incomingContainer) {
    return Array.from(localContainers.values())
      .filter(candidate =>
        this.#containerMetadataMatches(candidate, incomingContainer)
      )
      .sort((a, b) => a.userContextId - b.userContextId);
  }

  #createIncomingContainer(incomingContainer, localContainers) {
    const localContainer = lazy.ContextualIdentityService.create(
      incomingContainer.name,
      incomingContainer.icon,
      incomingContainer.color
    );
    if (localContainer) {
      localContainers.set(localContainer.userContextId, localContainer);
    }
    return localContainer;
  }

  #findOrCreateEquivalentContainer(incomingContainer, localContainers) {
    const ordinal = this.#getIncomingContainerOrdinal(incomingContainer);
    let matches = this.#getMatchingLocalContainers(
      localContainers,
      incomingContainer
    );
    while (matches.length <= ordinal) {
      if (!this.#createIncomingContainer(incomingContainer, localContainers)) {
        return null;
      }
      matches = this.#getMatchingLocalContainers(
        localContainers,
        incomingContainer
      );
    }
    return matches[ordinal];
  }

  #applyIncomingContainers(pulledContainers) {
    const localContainersById = new Map(
      lazy.ContextualIdentityService.getPublicIdentities().map(container => [
        container.userContextId,
        container,
      ])
    );
    const orderedContainers = [...pulledContainers].sort(
      (a, b) =>
        this.#getIncomingContainerOrdinal(a) -
        this.#getIncomingContainerOrdinal(b)
    );

    for (const container of orderedContainers) {
      const syncId = this.#getIncomingContainerSyncId(container);
      if (!container.name || !syncId) {
        continue;
      }

      let userContextId = this.resolveLocalContainerId(syncId);
      let localContainer = localContainersById.get(userContextId);
      if (!localContainer) {
        localContainer = this.#findOrCreateEquivalentContainer(
          container,
          localContainersById
        );
        userContextId = localContainer?.userContextId || null;
      }

      if (
        localContainer &&
        !container.l10nId &&
        !this.#containerMetadataMatches(localContainer, container)
      ) {
        lazy.ContextualIdentityService.update(
          userContextId,
          container.name,
          container.icon,
          container.color
        );
      }
      this.#associateContainerSyncId(userContextId, syncId);
    }
  }

  #mapIncomingSpaceReferences(spaces) {
    for (const space of spaces) {
      const syncId =
        normalizeContainerSyncId(space.containerSyncId) ||
        (normalizeUserContextId(space.containerTabId)
          ? String(space.containerTabId)
          : null);
      const localId = syncId ? this.resolveLocalContainerId(syncId) : null;
      space.containerTabId = localId || 0;
      delete space.containerSyncId;
    }
  }
}

export const ZenSyncStore = new ZenSyncManager();
