/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { JSONFile } from "resource://gre/modules/JSONFile.sys.mjs";
import { XPCOMUtils } from "resource://gre/modules/XPCOMUtils.sys.mjs";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  ZenSessionStore: "resource:///modules/zen/ZenSessionManager.sys.mjs",
  ZenLiveFoldersManager:
    "resource:///modules/zen/ZenLiveFoldersManager.sys.mjs",
  ContextualIdentityService:
    "moz-src:///toolkit/components/contextualidentity/ContextualIdentityService.sys.mjs",
});

XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "syncDebug",
  "zen.spaces-sync.debug",
  false
);

/**
 * Debug logging for the whole Spaces sync pipeline.
 *
 * @param {string} message
 * @param {...any} args
 */
export function syncLog(message, ...args) {
  if (lazy.syncDebug) {
    // eslint-disable-next-line no-console
    console.debug(`ZenSpacesSync: ${message}`, ...args);
  }
}

export const SIDEBAR_COLLECTED_TOPIC = "zen-sidebar-data-collected";

export const RECORD_KINDS = Object.freeze({
  CONTAINER: "container",
  SPACE: "space",
  TAB: "tab",
  FOLDER: "folder",
  SPLIT: "split",
  LAYOUT: "layout",
});

export const LAYOUT_RECORD_ID = "layout";

// Firefox ships four built-in containers with fixed userContextIds. They
// exist on every device, so they map to well-known guids instead of the
// per-profile generated ones.
const BUILTIN_CONTAINER_MAX = 4;
const BUILTIN_GUID_PREFIX = "builtin-";

const STORE_FILE_NAME = "zen-spaces-sync.json";
const STORE_VERSION = 1;

// Everything setIcon accepts without a loading principal.
const LOCAL_ICON_PROTOCOLS = ["data:", "chrome:", "about:", "resource:"];

/**
 * Normalizes a tab icon for syncing. The image attribute can hold a
 * moz-remote-image: wrapper around the actual (svg data:) favicon, carrying
 * a per-process contentParentId that means nothing on another device — sync
 * the wrapped URL instead. Anything else setIcon would reject as remote is
 * dropped.
 *
 * @param {?string} icon
 * @returns {string}
 */
export function syncableIconUrl(icon) {
  if (!icon || typeof icon !== "string") {
    return "";
  }
  if (icon.startsWith("moz-remote-image:")) {
    try {
      const uri = Services.io.newURI(icon);
      icon = new URLSearchParams(uri.query).get("url") || "";
    } catch (e) {
      return "";
    }
  }
  return LOCAL_ICON_PROTOCOLS.some(protocol => icon.startsWith(protocol))
    ? icon
    : "";
}

function sortedClone(value) {
  if (Array.isArray(value)) {
    return value.map(sortedClone);
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = sortedClone(value[key]);
    }
    return out;
  }
  return value === undefined ? null : value;
}

/**
 * Deterministic JSON serialization (recursively sorted keys), so that two
 * structurally equal payloads always stringify identically.
 *
 * @param {object} value
 */
export function canonicalJSON(value) {
  return JSON.stringify(sortedClone(value));
}

/**
 * Digest of a record's canonical form. The uploaded-state snapshot only ever
 * needs equality checks, so it stores these short digests instead of the
 * full canonical strings, keeping the store file small and cheap to write.
 *
 * @param {string} kind
 * @param {object} data
 * @returns {string} base64 SHA-256 of the canonical record payload.
 */
const textEncoder = new TextEncoder();

export function recordDigest(kind, data) {
  const hasher = Cc["@mozilla.org/security/hash;1"].createInstance(
    Ci.nsICryptoHash
  );
  hasher.init(Ci.nsICryptoHash.SHA256);
  const bytes = textEncoder.encode(canonicalJSON({ kind, data }));
  hasher.update(bytes, bytes.length);
  return hasher.finish(/* base64 = */ true);
}

/**
 * Owns the synced-data model for the Spaces engine.
 */
class nsZenSpacesSyncModel {
  #file = null;
  #cache = null;

  #data() {
    if (!this.#file) {
      this.#file = new JSONFile({
        path: PathUtils.join(PathUtils.profileDir, STORE_FILE_NAME),
        dataPostProcessor: data => {
          if (data.version !== STORE_VERSION) {
            // Drop the uploaded snapshot so everything re-diffs against
            // the (also wiped) server, but keep the container identity mappings.
            data.uploaded = {};
          }
          data.version = STORE_VERSION;
          data.uploaded ||= {};
          data.containers ||= {};
          // The container map used to be keyed by guid. It is keyed by
          // userContextId now so that registering a guid replaces any
          // previous one for the same container. Flip old stores over
          // (old values are numeric ids, new values are guid strings).
          for (const [key, value] of Object.entries(data.containers)) {
            if (typeof value === "number") {
              delete data.containers[key];
              data.containers[value] = key;
            }
          }
          return data;
        },
      });
      this.#file.ensureDataReady();
    }
    return this.#file.data;
  }

  invalidate() {
    this.#cache = null;
  }

  /* Mark: container identity */

  guidForContextId(userContextId, { create = false } = {}) {
    const id = Number(userContextId);
    if (!Number.isSafeInteger(id) || id <= 0) {
      return null;
    }
    const data = this.#data();
    if (!lazy.ContextualIdentityService.getPublicIdentityFromId(id)) {
      // A space or tab still pointing at a container that was deleted.
      if (id in data.containers) {
        delete data.containers[id];
        this.#file.saveSoon();
      }
      return null;
    }
    if (id <= BUILTIN_CONTAINER_MAX) {
      return `${BUILTIN_GUID_PREFIX}${id}`;
    }
    const existing = data.containers[id];
    if (existing) {
      return existing;
    }
    if (!create) {
      return null;
    }
    const guid = Services.uuid.generateUUID().toString().slice(1, -1);
    data.containers[id] = guid;
    this.#file.saveSoon();
    return guid;
  }

  contextIdForGuid(guid) {
    if (typeof guid !== "string" || !guid) {
      return null;
    }
    const data = this.#data();
    for (const [id, mapped] of Object.entries(data.containers)) {
      if (mapped === guid) {
        const contextId = Number(id);
        if (lazy.ContextualIdentityService.getPublicIdentityFromId(contextId)) {
          return contextId;
        }
        delete data.containers[id];
        this.#file.saveSoon();
        return null;
      }
    }
    if (guid.startsWith(BUILTIN_GUID_PREFIX)) {
      const id = Number(guid.slice(BUILTIN_GUID_PREFIX.length));
      return Number.isSafeInteger(id) &&
        id > 0 &&
        id <= BUILTIN_CONTAINER_MAX &&
        lazy.ContextualIdentityService.getPublicIdentityFromId(id)
        ? id
        : null;
    }
    return null;
  }

  /**
   * Adopts an incoming guid as the identity's synced name.
   *
   * @param {string} guid
   * @param {number} userContextId
   */
  registerContainerGuid(guid, userContextId) {
    this.#data().containers[userContextId] = guid;
    this.#file.saveSoon();
  }

  forgetContainerGuid(guid) {
    const data = this.#data();
    for (const [id, mapped] of Object.entries(data.containers)) {
      if (mapped === guid) {
        delete data.containers[id];
        this.#file.saveSoon();
        return;
      }
    }
  }

  /* Mark: projections */

  #isSyncableTab(tabData) {
    return !!(
      tabData &&
      tabData.zenSyncId &&
      (tabData.pinned || tabData.zenEssential) &&
      !tabData.zenIsEmpty &&
      !tabData.zenIsGlance &&
      !tabData.zenLiveFolderItemId
    );
  }

  #tabIdentity(tabData) {
    const initial = tabData._zenPinnedInitialState;
    let url = initial?.entry?.url;
    let title = initial?.entry?.title;
    if (!url || url === "about:blank") {
      const entries = tabData.entries || [];
      if (entries.length) {
        let index = Math.min(
          Math.max((tabData.index || entries.length) - 1, 0),
          entries.length - 1
        );
        const entry = entries[index] || entries[0];
        if (entry?.url && entry.url !== "about:blank") {
          url = entry.url;
          title ??= entry.title;
        }
      }
    }
    if (!url || url === "about:blank") {
      return null;
    }
    const icon = syncableIconUrl(
      (tabData.zenHasStaticIcon
        ? tabData.image
        : initial?.image || tabData.image) || ""
    );
    return { url, title: title || "", icon };
  }

  /**
   * Builds the ordered child id list for one parent (a space's pinned
   * section or a folder) from the collected tab list, which is in strip
   * order.
   *
   * @param {object} ctx - The projection context.
   * @param {{space?: string, folder?: string}} scope
   */
  #childSequence(ctx, scope) {
    const seq = [];
    const seen = new Set();
    const push = id => {
      if (!seen.has(id)) {
        seen.add(id);
        seq.push(id);
      }
    };
    for (const tab of ctx.allTabs) {
      const groupId = tab.groupId || null;
      if (!groupId) {
        if (
          scope.space &&
          !tab.zenEssential &&
          (tab.zenWorkspace || null) === scope.space &&
          ctx.syncableTabIds.has(tab.zenSyncId)
        ) {
          push(tab.zenSyncId);
        }
        continue;
      }
      if (scope.folder && groupId === scope.folder) {
        if (ctx.syncableTabIds.has(tab.zenSyncId)) {
          push(tab.zenSyncId);
        }
        continue;
      }
      if (ctx.splitIds.has(groupId) || ctx.splitParents.has(groupId)) {
        const parent = ctx.splitParents.get(groupId) ?? null;
        const isDirect = scope.folder ? parent === scope.folder : !parent;
        if (isDirect) {
          if (
            ctx.splitIds.has(groupId) &&
            (!scope.space || (ctx.splitWs.get(groupId) ?? null) === scope.space)
          ) {
            push(groupId);
          }
        } else if (parent) {
          const child = this.#scopeChildFolder(ctx, scope, parent);
          if (child) {
            push(child);
          }
        }
        continue;
      }
      if (ctx.folderById.has(groupId)) {
        const child = this.#scopeChildFolder(ctx, scope, groupId);
        if (child) {
          push(child);
        }
      }
    }
    return seq;
  }

  /**
   * Walks a folder's parent chain up to the direct child of the given
   * scope, or null when the chain leads somewhere else.
   *
   * @param {object} ctx - The projection context.
   * @param {{space?: string, folder?: string}} scope
   * @param {string} folderId
   * @returns {?string}
   */
  #scopeChildFolder(ctx, scope, folderId) {
    // The seen set only guards against a corrupt parentId cycle.
    const seen = new Set();
    let current = ctx.folderById.get(folderId);
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      const parentId = current.parentId || null;
      if (scope.folder ? parentId === scope.folder : !parentId) {
        if (scope.space && (current.workspaceId || null) !== scope.space) {
          return null;
        }
        return current.id;
      }
      current = parentId ? ctx.folderById.get(parentId) : null;
    }
    return null;
  }

  /**
   * Derives the shared projection context from one sidebar collection.
   * Syncable tabs, folders, the syncable splits and their parents and
   * workspaces, plus the folder-membership resolver.
   *
   * @param {object} sidebar
   */
  #projectionContext(sidebar) {
    const allTabs = sidebar.tabs || [];
    const tabs = allTabs.filter(t => this.#isSyncableTab(t));
    const folders = (sidebar.folders || []).filter(
      f => f?.id && !f.splitViewGroup
    );
    const folderIds = new Set(folders.map(f => f.id));
    const folderById = new Map(folders.map(f => [f.id, f]));
    const allSplits = (sidebar.splitViewData || []).filter(g => g?.groupId);
    const splitParents = new Map();
    for (const entry of sidebar.folders || []) {
      if (entry?.splitViewGroup && entry.id) {
        splitParents.set(entry.id, entry.parentId || null);
      }
    }

    // Only splits whose members are all synced tabs are synced themselves.
    const syncableTabIds = new Set(tabs.map(t => t.zenSyncId));
    const splits = allSplits.filter(
      g =>
        Array.isArray(g.tabs) &&
        g.tabs.length >= 2 &&
        g.tabs.every(id => syncableTabIds.has(id))
    );
    const splitIds = new Set(splits.map(g => g.groupId));
    const splitWs = new Map();
    for (const tab of tabs) {
      const groupId = tab.groupId || null;
      if (groupId && splitIds.has(groupId) && !splitWs.has(groupId)) {
        splitWs.set(groupId, tab.zenWorkspace || null);
      }
    }
    const folderOf = groupId => {
      if (!groupId) {
        return null;
      }
      if (splitIds.has(groupId)) {
        return splitParents.get(groupId) || null;
      }
      return folderIds.has(groupId) ? groupId : null;
    };
    return {
      allTabs,
      tabs,
      folders,
      folderById,
      syncableTabIds,
      splits,
      splitIds,
      splitParents,
      splitWs,
      folderOf,
    };
  }

  /**
   * @param {Map} map
   * @param {object} ctx - The projection context.
   */
  #projectTabs(map, ctx) {
    for (const tab of ctx.tabs) {
      const identity = this.#tabIdentity(tab);
      if (!identity) {
        continue;
      }
      const essential = !!tab.zenEssential;
      map.set(tab.zenSyncId, {
        kind: RECORD_KINDS.TAB,
        data: {
          tabId: tab.zenSyncId,
          url: identity.url,
          title: identity.title,
          icon: identity.icon,
          containerGuid: this.guidForContextId(tab.userContextId, {
            create: true,
          }),
          essential,
          workspaceUuid: essential ? null : tab.zenWorkspace || null,
          folderId: ctx.folderOf(tab.groupId || null),
          staticLabel:
            typeof tab.zenStaticLabel === "string" ? tab.zenStaticLabel : null,
          hasStaticIcon: !!tab.zenHasStaticIcon,
          defaultContainer: !!tab.zenDefaultUserContextId,
        },
      });
    }
  }

  projections() {
    const sidebar = lazy.ZenSessionStore.getSidebarData() || {};
    const stamp = sidebar.lastCollected || 0;
    if (this.#cache && this.#cache.stamp === stamp) {
      return this.#cache.map;
    }

    const map = new Map();
    const pending = new Set();
    const ctx = this.#projectionContext(sidebar);
    const { tabs, folders, splits, splitParents, splitWs } = ctx;

    for (const identity of lazy.ContextualIdentityService.getPublicIdentities()) {
      if (!identity.name) {
        continue;
      }
      const guid = this.guidForContextId(identity.userContextId, {
        create: true,
      });
      if (!guid) {
        continue;
      }
      map.set(guid, {
        kind: RECORD_KINDS.CONTAINER,
        data: {
          guid,
          name: identity.name,
          icon: identity.icon || "",
          color: identity.color || "",
        },
      });
    }

    const spaces = sidebar.spaces || [];
    for (const space of spaces) {
      if (!space?.uuid) {
        continue;
      }
      const uuid = space.uuid;
      map.set(uuid, {
        kind: RECORD_KINDS.SPACE,
        data: {
          uuid,
          name: space.name ?? "",
          icon: space.icon ?? null,
          theme: space.theme ?? null,
          containerGuid: this.guidForContextId(space.containerTabId, {
            create: true,
          }),
          children: this.#childSequence(ctx, { space: uuid }),
        },
      });
    }

    for (const folder of folders) {
      const fid = folder.id;
      let live = null;
      if (folder.isLiveFolder) {
        try {
          live = lazy.ZenLiveFoldersManager.getSyncableFolderData(fid);
        } catch (e) {
          console.error("ZenSpacesSync: failed to project live folder", e);
        }
        if (!live) {
          pending.add(fid);
          continue;
        }
      }
      map.set(fid, {
        kind: RECORD_KINDS.FOLDER,
        data: {
          folderId: fid,
          name: folder.name ?? "",
          icon: folder.userIcon || null,
          workspaceUuid: folder.workspaceId || null,
          parentFolderId: folder.parentId || null,
          live,
          children: this.#childSequence(ctx, { folder: fid }),
        },
      });
    }

    this.#projectTabs(map, ctx);

    for (const split of splits) {
      map.set(split.groupId, {
        kind: RECORD_KINDS.SPLIT,
        data: {
          splitId: split.groupId,
          gridType: split.gridType || "grid",
          tabs: [...split.tabs],
          workspaceUuid: splitWs.get(split.groupId) ?? null,
          folderId: splitParents.get(split.groupId) || null,
        },
      });
    }

    if (spaces.length) {
      const essentials = {};
      for (const tab of tabs) {
        if (!tab.zenEssential) {
          continue;
        }
        const key =
          this.guidForContextId(tab.userContextId, { create: true }) ||
          "default";
        (essentials[key] ||= []).push(tab.zenSyncId);
      }
      map.set(LAYOUT_RECORD_ID, {
        kind: RECORD_KINDS.LAYOUT,
        data: {
          spaces: spaces.map(s => s.uuid).filter(Boolean),
          essentials,
        },
      });
    }

    this.#cache = { stamp, map, pending };
    return map;
  }

  /**
   * Ids that are locally present but deliberately not projected this cycle
   * (live folders whose provider config isn't available yet). The diff must
   * not read their absence as a deletion.
   */
  #pendingIds() {
    this.projections();
    return this.#cache.pending;
  }

  #digestCache = null;

  /**
   * Digests of all current projections. Change detection runs several times per
   * sync cycle (tracker observe, changed-id computation, upload bookkeeping)
   * and only needs to hash again after a fresh sidebar collection.
   */
  #digestAll() {
    const map = this.projections();
    if (this.#digestCache?.map === map) {
      return this.#digestCache.digests;
    }
    const digests = new Map();
    for (const [id, projected] of map) {
      digests.set(id, recordDigest(projected.kind, projected.data));
    }
    this.#digestCache = { map, digests };
    return digests;
  }

  /* Mark: engine-facing API */

  getAllRecordIds() {
    const ids = {};
    for (const id of this.projections().keys()) {
      ids[id] = true;
    }
    return ids;
  }

  itemExists(id) {
    return this.projections().has(id);
  }

  projectRecord(id) {
    return this.projections().get(id) ?? null;
  }

  /**
   * Changes = diff between the current projections and the last state the
   * server acknowledged. Ids present locally with different content are
   * modified; ids only present in the uploaded snapshot are deletions.
   */
  computeChangedIDs() {
    const uploaded = this.#data().uploaded;
    const current = this.#digestAll();
    const pending = this.#pendingIds();
    const now = Date.now() / 1000;
    const changes = {};
    for (const [id, digest] of current) {
      if (uploaded[id] !== digest) {
        changes[id] = now;
      }
    }
    for (const id of Object.keys(uploaded)) {
      if (!current.has(id) && !pending.has(id)) {
        changes[id] = now;
      }
    }
    if (lazy.syncDebug && Object.keys(changes).length) {
      const map = this.projections();
      syncLog(
        "outgoing diff:",
        Object.keys(changes).map(id =>
          current.has(id) ? `${map.get(id)?.kind} ${id}` : `TOMBSTONE ${id}`
        )
      );
    }
    return changes;
  }

  hasPendingChanges() {
    const uploaded = this.#data().uploaded;
    const current = this.#digestAll();
    const pending = this.#pendingIds();
    for (const [id, digest] of current) {
      if (uploaded[id] !== digest) {
        return true;
      }
    }
    for (const id of Object.keys(uploaded)) {
      if (!current.has(id) && !pending.has(id)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Called after records were successfully uploaded. Remember exactly what
   * the server now holds for them.
   *
   * @param {Array<string>} ids
   */
  markUploaded(ids) {
    const data = this.#data();
    const current = this.#digestAll();
    for (const id of ids) {
      if (current.has(id)) {
        data.uploaded[id] = current.get(id);
      } else {
        delete data.uploaded[id];
      }
    }
    if (lazy.syncDebug && ids.length) {
      syncLog(
        "server acknowledged upload:",
        ids.map(id => (current.has(id) ? id : `${id} (tombstone)`))
      );
    }
    this.#file.saveSoon();
  }

  /**
   * Called after an incoming record was applied locally. Storing the
   * incoming payload as the uploaded state means a faithful local
   * materialization produces no re-upload, while a divergent one re-uploads
   * the local truth (self-healing).
   *
   * @param {string} id
   * @param {?object} cleartext - null for tombstones.
   */
  noteApplied(id, cleartext) {
    const data = this.#data();
    if (!cleartext) {
      delete data.uploaded[id];
    } else {
      data.uploaded[id] = recordDigest(cleartext.kind, cleartext.data);
    }
    syncLog(
      `acknowledged incoming ${cleartext ? cleartext.kind : "tombstone"} ${id}`
    );
    this.#file.saveSoon();
  }
}

export const ZenSpacesSyncModel = new nsZenSpacesSyncModel();
