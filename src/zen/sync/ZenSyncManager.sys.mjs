/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
import { XPCOMUtils } from "resource://gre/modules/XPCOMUtils.sys.mjs";
import {
  RECORD_TYPES,
  SYNC_PREFS,
} from "resource:///modules/zen/ZenSyncConstants.sys.mjs";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  ZenSessionStore: "resource:///modules/zen/ZenSessionManager.sys.mjs",
  BrowserWindowTracker: "resource:///modules/BrowserWindowTracker.sys.mjs",
  TabStateCache: "resource:///modules/sessionstore/TabStateCache.sys.mjs",
  ContextualIdentityService:
    "moz-src:///toolkit/components/contextualidentity/ContextualIdentityService.sys.mjs",
  ZenWindowSync: "resource:///modules/zen/ZenWindowSync.sys.mjs",
});

XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "gSyncOnlyPinnedTabs",
  SYNC_PREFS.SYNC_ONLY_PINNED_TABS,
  true
);

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

  #registerChange(type, id) {
    if (id && !this.#ignoreChanges) {
      const key = `${type}~${id}`;
      this.#changedItems.set(key, { type, id });
    }
  }

  markTabChanged(id) {
    this.#registerChange(RECORD_TYPES.TAB, id);
  }

  markSpaceChanged(id) {
    this.#registerChange(RECORD_TYPES.SPACE, id);
  }

  markSplitChanged(id) {
    this.#registerChange(RECORD_TYPES.SPLIT, id);
  }

  markFolderChanged(id) {
    this.#registerChange(RECORD_TYPES.FOLDER, id);
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

  #getTab(tabId) {
    if (!tabId) {
      return null;
    }

    const orderedWindows = lazy.BrowserWindowTracker.getOrderedWindows({
      private: false,
    });
    for (const win of orderedWindows) {
      if (!win.gBrowser) {
        continue;
      }

      for (let position = 0; position < win.gBrowser.tabs.length; position++) {
        const tab = win.gBrowser.tabs[position];
        if (tab.id !== tabId) {
          continue;
        }

        return { position, tab };
      }
    }

    return null;
  }

  createSyncableTabData(tabId, { trimHistoryForUnpinned = false } = {}) {
    const tabInfo = this.#getTab(tabId);
    const { position, tab } = tabInfo || {};
    const isEssential = tab?.hasAttribute("zen-essential");

    if (
      !tab?.id ||
      tab.hasAttribute("zen-empty-tab") ||
      tab.hasAttribute("zen-live-folder-item-id") ||
      (!(tab.pinned || isEssential) && lazy.gSyncOnlyPinnedTabs)
    ) {
      return null;
    }

    const currentEntry = this.#getTabActiveEntry(tab);

    const pinned = !!(tab.pinned || isEssential);
    let entries = currentEntry ? [currentEntry] : [];
    let index = 1;

    if (trimHistoryForUnpinned && !pinned && entries.length) {
      const entryIndex = Math.max(0, index - 1);
      const entry = entries[entryIndex] || entries[0];
      entries = entry ? [entry] : [];
      index = 1;
    }

    const image =
      tab.zenStaticIcon ||
      tab.getAttribute("image") ||
      tab.documentGlobal.gBrowser.getIcon(tab) ||
      "";
    let group = tab.group;
    if (group?.hasAttribute("split-view-group")) {
      group = group.group;
    }
    const syncTabData = {
      entries,
      groupId: group?.id || null,
      image,
      index,
      pinned,
      userContextId: tab.userContextId || 0,
      zenDefaultUserContextId: tab.hasAttribute("zenDefaultUserContextId"),
      zenEssential: isEssential,
      zenHasStaticIcon: !!tab.zenStaticIcon,
      zenSyncId: tab.id,
      zenWorkspace: isEssential
        ? null
        : tab.getAttribute("zen-workspace-id") || null,
    };

    this.#appendOptionalTabSyncData(syncTabData, tab, position);
    return syncTabData;
  }

  /**
   * Returns the tab's active history entry for syncing. Unloaded and lazy
   * browsers report about:blank as their current URI, so prefer the session
   * history cache and never emit about:blank, which would blank the tab on
   * every other device.
   *
   * @param {MozTabbrowserTab} tab
   */
  #getTabActiveEntry(tab) {
    const cached = tab.linkedBrowser
      ? lazy.TabStateCache.get(tab.linkedBrowser.permanentKey)?.history
      : null;
    if (cached?.entries?.length) {
      const index = Math.min(
        Math.max((cached.index || cached.entries.length) - 1, 0),
        cached.entries.length - 1
      );
      const entry = cached.entries[index];
      if (entry?.url && entry.url !== "about:blank") {
        return { url: entry.url, title: entry.title || tab.label || "" };
      }
    }

    const currentURL = tab.linkedBrowser?.currentURI?.spec;
    if (currentURL && currentURL !== "about:blank") {
      return {
        url: currentURL,
        title: tab.linkedBrowser.contentTitle || tab.label || "",
      };
    }

    const initialEntry = tab._zenPinnedInitialState?.entry;
    if (initialEntry?.url && initialEntry.url !== "about:blank") {
      return { url: initialEntry.url, title: initialEntry.title || "" };
    }
    return null;
  }

  #appendOptionalTabSyncData(syncTabData, tab, position) {
    if (typeof tab.zenStaticLabel === "string") {
      syncTabData.zenStaticLabel = tab.zenStaticLabel;
    }
    if (tab._zenPinnedInitialState) {
      syncTabData._zenPinnedInitialState = tab._zenPinnedInitialState;
    }
    if (typeof position === "number") {
      syncTabData.position = position;
    }
  }
}

export const ZenSyncStore = new ZenSyncManager();
