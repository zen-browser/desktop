/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import {
  canonicalJSON,
  LAYOUT_RECORD_ID,
  RECORD_KINDS,
  syncableIconUrl,
  ZenSpacesSyncModel,
} from "resource:///modules/zen/ZenSpacesSyncModel.sys.mjs";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  SessionSaver: "resource:///modules/sessionstore/SessionSaver.sys.mjs",
  E10SUtils: "resource://gre/modules/E10SUtils.sys.mjs",
  TabStateCache: "resource:///modules/sessionstore/TabStateCache.sys.mjs",
  ZenWindowSync: "resource:///modules/zen/ZenWindowSync.sys.mjs",
  ZenLiveFoldersManager:
    "resource:///modules/zen/ZenLiveFoldersManager.sys.mjs",
  ContextualIdentityService:
    "moz-src:///toolkit/components/contextualidentity/ContextualIdentityService.sys.mjs",
});

const FIRST_SYNC_ANIMATION_PREF = "zen.spaces-sync.first-sync-animation-shown";

/**
 * Applies batches of incoming Spaces records to the local browser.
 */
class nsZenSpacesSyncApplier {
  #itemIn(win, id) {
    return id ? win.document.getElementById(id) : null;
  }

  /**
   * @param {Array} records - decrypted incoming records.
   * @returns {Array<string>} ids of records that failed to apply.
   */
  async applyBatch(records) {
    const incoming = {
      containers: [],
      spaces: [],
      tabs: [],
      folders: [],
      splits: [],
      layout: null,
      deleted: [],
    };
    const handled = new Set();

    for (const record of records) {
      if (typeof record.id !== "string" || !record.id) {
        continue;
      }
      if (record.deleted) {
        if (record.id !== LAYOUT_RECORD_ID) {
          incoming.deleted.push({ key: record.id, record });
        }
        handled.add(record);
        continue;
      }
      const data = record.cleartext?.data;
      if (!data) {
        continue;
      }
      const entry = { key: record.id, data, record };
      switch (record.cleartext.kind) {
        case RECORD_KINDS.CONTAINER:
          incoming.containers.push(entry);
          break;
        case RECORD_KINDS.SPACE:
          incoming.spaces.push(entry);
          break;
        case RECORD_KINDS.TAB:
          incoming.tabs.push(entry);
          break;
        case RECORD_KINDS.FOLDER:
          incoming.folders.push(entry);
          break;
        case RECORD_KINDS.SPLIT:
          incoming.splits.push(entry);
          break;
        case RECORD_KINDS.LAYOUT:
          incoming.layout = entry;
          break;
        default:
          // Unknown kind (newer client): leave untouched and unacknowledged.
          continue;
      }
      handled.add(record);
    }

    const failed = new Set();
    const fail = (record, e) => {
      failed.add(record.id);
      console.error(`ZenSpacesSync: failed to apply ${record.id}:`, e);
    };

    const deletions = this.#applyContainers(incoming, fail);

    const win = lazy.ZenWindowSync.firstSyncedWindow;
    if (!win) {
      // Report the records as failed so the engine redelivers the batch on a later sync.
      const noWindow = new Error("no synced window to apply into");
      for (const entry of [
        ...incoming.spaces,
        ...incoming.folders,
        ...incoming.tabs,
        ...incoming.splits,
        ...(incoming.layout ? [incoming.layout] : []),
        ...deletions,
      ]) {
        fail(entry.record, noWindow);
      }
    } else {
      await win.gZenWorkspaces.promiseInitialized;
      this.#maybePlayFirstSyncAnimation(win);
      const removals = this.#routeTombstones(win, deletions);
      this.#deleteTabs(win, removals.tabs, fail);
      this.#deleteSplits(win, removals.splits, fail);
      await this.#applySpaces(win, incoming.spaces, fail);
      await this.#applyFolders(win, incoming.folders, fail);
      this.#applyTabs(win, incoming.tabs, fail);
      this.#applySplits(win, incoming.splits, fail);
      await this.#deleteFolders(win, removals.folders, fail);
      await this.#deleteSpaces(win, removals.spaces, fail);
      this.#applyOrdering(win, incoming, fail);
      // Collect the session soon so the stored sidebar (and with it the
      // sync projections) reflects the applied state instead of re-uploading
      // the pre-apply one.
      lazy.SessionSaver.runDelayed();
    }

    ZenSpacesSyncModel.invalidate();
    for (const record of records) {
      if (!handled.has(record) || failed.has(record.id)) {
        continue;
      }
      ZenSpacesSyncModel.noteApplied(
        record.id,
        record.deleted ? null : record.cleartext
      );
    }
    return [...failed];
  }

  /**
   * Plays the update sweep animation over the window the first time
   * incoming sync data lands on this profile.
   *
   * @param {Window} win
   */
  #maybePlayFirstSyncAnimation(win) {
    if (Services.prefs.getBoolPref(FIRST_SYNC_ANIMATION_PREF, false)) {
      return;
    }
    Services.prefs.setBoolPref(FIRST_SYNC_ANIMATION_PREF, true);
    win.gZenStartup.playWindowSweepAnimation();
  }

  /**
   * Tombstones have no payload. Whatever local thing owns the id decides
   * what kind of deletion this is. Ids with no local counterpart need no
   * work at all.
   *
   * @param {Window} win
   * @param {Array<{key: string, record: object}>} deletions
   */
  #routeTombstones(win, deletions) {
    const routed = { tabs: [], folders: [], splits: [], spaces: [] };
    const spaces = win.gZenWorkspaces.getWorkspaces();
    for (const entry of deletions) {
      const el = this.#itemIn(win, entry.key);
      if (win.gBrowser.isTab(el)) {
        routed.tabs.push(entry);
      } else if (el?.isZenFolder) {
        routed.folders.push(entry);
      } else if (el?.hasAttribute?.("split-view-group")) {
        routed.splits.push(entry);
      } else if (spaces.some(s => s.uuid === entry.key)) {
        routed.spaces.push(entry);
      }
    }
    return routed;
  }

  /* Mark: containers */

  #applyContainers(incoming, fail) {
    for (const { key: guid, data, record } of incoming.containers) {
      try {
        if (!data.name) {
          continue;
        }
        const mapped = ZenSpacesSyncModel.contextIdForGuid(guid);
        const existing =
          mapped !== null
            ? lazy.ContextualIdentityService.getPublicIdentityFromId(mapped)
            : null;
        if (existing) {
          lazy.ContextualIdentityService.update(
            mapped,
            data.name,
            data.icon,
            data.color
          );
        } else {
          const identity = lazy.ContextualIdentityService.create(
            data.name,
            data.icon,
            data.color
          );
          ZenSpacesSyncModel.registerContainerGuid(
            guid,
            identity.userContextId
          );
        }
      } catch (e) {
        fail(record, e);
      }
    }

    const rest = [];
    for (const entry of incoming.deleted) {
      const mapped = ZenSpacesSyncModel.contextIdForGuid(entry.key);
      if (mapped === null) {
        rest.push(entry);
        continue;
      }
      try {
        if (lazy.ContextualIdentityService.getPublicIdentityFromId(mapped)) {
          lazy.ContextualIdentityService.remove(mapped);
        }
        ZenSpacesSyncModel.forgetContainerGuid(entry.key);
      } catch (e) {
        fail(entry.record, e);
      }
    }
    return rest;
  }

  /* Mark: spaces */

  async #applySpaces(win, spaces, fail) {
    if (!spaces.length) {
      return;
    }
    const list = win.gZenWorkspaces.getWorkspaces();
    let changed = false;
    const repaint = [];
    for (const { data, record } of spaces) {
      try {
        if (!data.uuid) {
          continue;
        }
        const fields = {
          uuid: data.uuid,
          name: data.name ?? "",
          icon: data.icon ?? undefined,
          theme: data.theme ?? null,
          containerTabId:
            ZenSpacesSyncModel.contextIdForGuid(data.containerGuid) ?? 0,
        };
        // A space record re-syncs whenever its child ordering changes, so
        // only propagate (and especially repaint) when its own fields did.
        const index = list.findIndex(s => s.uuid === data.uuid);
        const current = index === -1 ? null : list[index];
        const visualChanged =
          !current ||
          (current.name ?? "") !== fields.name ||
          (current.icon ?? null) !== (fields.icon ?? null) ||
          canonicalJSON(current.theme ?? null) !==
            canonicalJSON(fields.theme ?? null);
        const containerChanged =
          !current || (current.containerTabId ?? 0) !== fields.containerTabId;
        if (!current) {
          list.push(fields);
          changed = true;
        } else if (visualChanged || containerChanged) {
          list[index] = { ...current, ...fields };
          changed = true;
        }
        if (visualChanged) {
          repaint.push(data.uuid);
        }
      } catch (e) {
        fail(record, e);
      }
    }
    if (changed) {
      await win.gZenWorkspaces.propagateWorkspaces(list);
      win.gZenWindowSync.propagateWorkspacesToAllWindows(list);
      for (const uuid of repaint) {
        const updated = list.find(s => s.uuid === uuid);
        if (updated) {
          win.gZenThemePicker.onWorkspaceChange(updated);
        }
      }
    }
  }

  async #deleteSpaces(win, removals, fail) {
    for (const { key: uuid, record } of removals) {
      try {
        const spaces = win.gZenWorkspaces.getWorkspaces();
        if (!spaces.some(s => s.uuid === uuid)) {
          continue;
        }
        if (spaces.length <= 1) {
          // Never delete the last space; the local copy revives it remotely.
          continue;
        }
        if (!(await this.#confirmRemoteSpaceDelete(win, uuid))) {
          continue;
        }
        await win.gZenWorkspaces.removeWorkspace(uuid);
      } catch (e) {
        fail(record, e);
      }
    }
  }

  /**
   * @param {Window} win
   * @param {string} uuid
   * @returns {Promise<boolean>} Whether the user confirmed the deletion.
   */
  async #confirmRemoteSpaceDelete(win, uuid) {
    const name = win.gZenWorkspaces.getWorkspaceFromId(uuid)?.name || uuid;
    const [title, body] = await win.document.l10n.formatValues([
      { id: "zen-workspaces-remote-delete-title" },
      { id: "zen-workspaces-remote-delete-body", args: { name } },
    ]);
    const result = await Services.prompt.asyncConfirmEx(
      win.browsingContext,
      Services.prompt.MODAL_TYPE_WINDOW,
      title,
      body,
      Services.prompt.STD_YES_NO_BUTTONS,
      null,
      null,
      null,
      null,
      false
    );
    return result.get("buttonNumClicked") === 0;
  }

  /* Mark: folders */

  async #applyFolders(win, folders, fail) {
    // Parents before children so nesting targets exist.
    const depths = new Map(folders.map(f => [f.key, f.data.parentFolderId]));
    const depthOf = key => {
      let depth = 0;
      let parent = depths.get(key);
      while (parent && depths.has(parent) && depth < 10) {
        depth++;
        parent = depths.get(parent);
      }
      return depth;
    };
    const ordered = [...folders].sort(
      (a, b) => depthOf(a.key) - depthOf(b.key)
    );

    for (const { key: folderId, data, record } of ordered) {
      try {
        let folder = this.#itemIn(win, folderId);
        if (!folder?.isZenFolder) {
          folder = win.gZenFolders.createFolder([], {
            id: folderId,
            label: data.name || "Folder",
            workspaceId:
              data.workspaceUuid || win.gZenWorkspaces.activeWorkspace,
            isLiveFolder: !!data.live,
          });
        } else if (data.name && folder.label !== data.name) {
          folder.label = data.name;
        }

        if (data.live && !folder.isLiveFolder) {
          // The folder synced before its provider config was available and
          // materialized as a plain folder; upgrade it so this profile
          // projects the config too instead of clobbering it with live: null.
          folder.isLiveFolder = true;
        }

        if ((folder.iconURL || null) !== (data.icon || null)) {
          win.gZenFolders.setFolderUserIcon(folder, data.icon || null);
          // Window sync picks this up and mirrors the icon everywhere else.
          folder.dispatchEvent(
            new win.CustomEvent("TabGroupUpdate", { bubbles: true })
          );
        }

        const desiredParent = data.parentFolderId
          ? this.#itemIn(win, data.parentFolderId)
          : null;
        const currentParent = folder.group;
        if ((currentParent?.id || null) !== (data.parentFolderId || null)) {
          if (desiredParent?.isZenFolder) {
            win.gBrowser.zenHandleTabMove(folder, () => {
              if (desiredParent.tabs.length) {
                desiredParent.tabs[0].after(folder);
              } else {
                desiredParent.appendChild(folder);
              }
            });
          } else if (!data.parentFolderId && currentParent?.isZenFolder) {
            const ws = data.workspaceUuid || win.gZenWorkspaces.activeWorkspace;
            const container =
              win.gZenWorkspaces.workspaceElement(ws)?.pinnedTabsContainer;
            if (container) {
              win.gBrowser.zenHandleTabMove(folder, () => {
                container.insertBefore(
                  folder,
                  container.querySelector(".pinned-tabs-container-separator")
                );
              });
            }
          }
        }
        if (
          data.workspaceUuid &&
          folder.getAttribute("zen-workspace-id") !== data.workspaceUuid
        ) {
          if (!folder.group) {
            win.gZenFolders.changeFolderToSpace(folder, data.workspaceUuid);
          } else {
            folder.setAttribute("zen-workspace-id", data.workspaceUuid);
          }
        }
        if (data.live) {
          await lazy.ZenLiveFoldersManager.adoptSyncedFolder(
            folderId,
            data.live
          );
        }
      } catch (e) {
        fail(record, e);
      }
    }
  }

  async #deleteFolders(win, removals, fail) {
    for (const { key: folderId, record } of removals) {
      try {
        const folder = this.#itemIn(win, folderId);
        if (!folder?.isZenFolder) {
          continue;
        }
        // Members without their own tombstone survive: unpack, then delete
        // the (now empty) folder.
        await folder.unpackTabs();
        await folder.delete();
      } catch (e) {
        fail(record, e);
      }
    }
  }

  /* Mark: tabs */

  #applyTabs(win, tabs, fail) {
    for (const { key: tabId, data, record } of tabs) {
      try {
        if (!data.url || data.url === "about:blank") {
          continue;
        }
        const existing = this.#itemIn(win, tabId);
        if (win.gBrowser.isTab(existing)) {
          this.#updateTab(win, existing, tabId, data);
        } else {
          this.#createTab(win, tabId, data);
        }
      } catch (e) {
        fail(record, e);
      }
    }
  }

  #createTab(win, tabId, data) {
    const userContextId =
      ZenSpacesSyncModel.contextIdForGuid(data.containerGuid) ?? 0;
    const tab = win.gBrowser.addTrustedTab(data.url, {
      createLazyBrowser: true,
      inBackground: true,
      skipAnimation: true,
      skipBackgroundNotify: true,
      lazyTabTitle: data.title || undefined,
      userContextId,
    });
    // Setting the sync id before the queued TabOpen handler runs makes
    // window sync treat this tab as already replicated.
    tab.id = tabId;
    tab._zenContentsVisible = true;
    this.#applyTabDecorations(win, tab, data);
    if (data.essential) {
      win.gZenPinnedTabManager.addToEssentials(tab);
    } else {
      if (data.workspaceUuid) {
        tab.setAttribute("zen-workspace-id", data.workspaceUuid);
      }
      win.gBrowser.pinTab(tab);
      if (data.workspaceUuid) {
        win.gZenWorkspaces.moveTabToWorkspace(tab, data.workspaceUuid);
      }
      const folder = data.folderId && this.#itemIn(win, data.folderId);
      if (folder?.isZenFolder) {
        folder.addTabs([tab]);
      }
    }
    lazy.ZenWindowSync.on_TabOpen({ target: tab }, { ignoreExistingId: true });
    lazy.ZenWindowSync.setPinnedInitialState(
      tab,
      { url: data.url, title: data.title || "" },
      syncableIconUrl(data.icon) || undefined
    );
  }

  #applyTabDecorations(win, tab, data) {
    if (data.defaultContainer) {
      tab.setAttribute("zenDefaultUserContextId", "true");
    } else {
      tab.removeAttribute("zenDefaultUserContextId");
    }
    // Records from before icon normalization can still carry wrapped or
    // remote urls setIcon would refuse.
    const icon = syncableIconUrl(data.icon);
    tab.zenStaticLabel =
      typeof data.staticLabel === "string" ? data.staticLabel : undefined;
    tab.zenStaticIcon = data.hasStaticIcon && icon ? icon : undefined;
    if (icon) {
      try {
        win.gBrowser.setIcon(tab, icon);
        // The tab is lazy, so its session state cache keeps the (empty)
        // image it was created with: it is only cleared once a restore
        // finishes, which never happens for lazy tabs, and it would hide
        // the icon from every session collect. Drop it so the session
        // saves the icon set above.
        lazy.TabStateCache.update(tab.linkedBrowser.permanentKey, {
          image: null,
        });
      } catch (e) {
        console.error("ZenSpacesSync: failed to set tab icon", e);
      }
    }
  }

  /**
   * Reconciles the tab's synced identity: pinned initial state, static
   * label/icon, the live icon and the default-container marker.
   *
   * @param {Window} win
   * @param {MozTabbrowserTab} tab
   * @param {object} data
   */
  #updateTabIdentity(win, tab, data) {
    const icon = syncableIconUrl(data.icon);
    const initial = tab._zenPinnedInitialState;
    const identityChanged =
      initial?.entry?.url !== data.url ||
      (initial?.entry?.title || "") !== (data.title || "");
    if (identityChanged || syncableIconUrl(initial?.image || "") !== icon) {
      lazy.ZenWindowSync.setPinnedInitialState(
        tab,
        { url: data.url, title: data.title || "" },
        icon || undefined
      );
    }
    if (identityChanged && !tab.linkedPanel) {
      // An unloaded tab has no live state to lose: retarget its lazy session
      // state so the next activation loads the new canonical url directly
      // instead of whatever the tab was created with.
      this.#retargetUnloadedTab(win, tab, data);
    }

    const staticLabel =
      typeof data.staticLabel === "string" ? data.staticLabel : null;
    const localLabel =
      typeof tab.zenStaticLabel === "string" ? tab.zenStaticLabel : null;
    if (staticLabel !== localLabel) {
      tab.zenStaticLabel = staticLabel ?? undefined;
      if (staticLabel) {
        tab._zenChangeLabelFlag = true;
        try {
          win.gBrowser._setTabLabel(tab, staticLabel);
        } finally {
          delete tab._zenChangeLabelFlag;
        }
      }
    }
    tab.zenStaticIcon = data.hasStaticIcon && icon ? icon : undefined;
    // Compare normalized: setIcon rewraps svg data: icons into
    // moz-remote-image urls when writing the attribute.
    if (icon && syncableIconUrl(tab.getAttribute("image")) !== icon) {
      try {
        win.gBrowser.setIcon(tab, icon);
        // As on creation: an unloaded tab's cached session image would
        // otherwise override the icon set above at every collect.
        lazy.TabStateCache.update(tab.linkedBrowser.permanentKey, {
          image: null,
        });
      } catch (e) {
        console.error("ZenSpacesSync: failed to set tab icon", e);
      }
    }
    if (data.defaultContainer) {
      tab.setAttribute("zenDefaultUserContextId", "true");
    } else {
      tab.removeAttribute("zenDefaultUserContextId");
    }
  }

  /**
   * Points an unloaded tab's session state at the record's canonical url,
   * mirroring ZenPinnedTabManager's reset-to-stored-state shape.
   *
   * @param {Window} win
   * @param {MozTabbrowserTab} tab
   * @param {object} data
   */
  #retargetUnloadedTab(win, tab, data) {
    try {
      const state = JSON.parse(win.SessionStore.getTabState(tab));
      state.entries = [
        {
          url: data.url,
          title: data.title || "",
          triggeringPrincipal_base64: lazy.E10SUtils.serializePrincipal(
            Services.scriptSecurityManager.createContentPrincipal(
              Services.io.newURI(data.url),
              {}
            )
          ),
        },
      ];
      state.index = 1;
      state.image = syncableIconUrl(data.icon) || undefined;
      delete state.scroll;
      win.SessionStore.setTabState(tab, state);
    } catch (e) {
      console.error("ZenSpacesSync: failed to retarget unloaded tab", e);
    }
  }

  #updateTab(win, tab, tabId, data) {
    this.#updateTabIdentity(win, tab, data);

    const isEssential = tab.hasAttribute("zen-essential");
    if (data.essential && !isEssential) {
      win.gZenPinnedTabManager.addToEssentials(tab);
      return;
    }
    if (!data.essential && isEssential) {
      win.gZenPinnedTabManager.removeEssentials(tab, /* unpin */ false);
    }
    if (data.essential) {
      return;
    }

    const inSplit = tab.group?.hasAttribute("split-view-group");
    if (inSplit) {
      // The split record governs placement of its members.
      return;
    }
    const currentFolder = tab.group?.isZenFolder ? tab.group.id : null;
    const wantFolder = data.folderId || null;
    if (currentFolder !== wantFolder) {
      const target = wantFolder && this.#itemIn(win, wantFolder);
      if (target?.isZenFolder) {
        target.addTabs([tab]);
      } else if (!wantFolder && currentFolder) {
        // ungroupTab pops a single nesting level: a tab inside a subfolder
        // lands inside the parent folder, so keep going until the tab is
        // actually top-level. The isTabGroup check keeps the collapsed
        // pinned-section pseudo-group (which the group getter also returns)
        // from ever looping.
        while (win.gBrowser.isTabGroup(tab.group) && tab.group.isZenFolder) {
          win.gBrowser.ungroupTab(tab);
        }
      }
    }
    if (
      !wantFolder &&
      data.workspaceUuid &&
      tab.getAttribute("zen-workspace-id") !== data.workspaceUuid
    ) {
      win.gZenWorkspaces.moveTabToWorkspace(tab, data.workspaceUuid);
    }
  }

  #removeTab(win, tab) {
    if (tab.splitView) {
      win.gZenViewSplitter.removeTabFromGroup(tab, undefined, {
        forUnsplit: true,
        changeTab: false,
      });
    }
    win.gBrowser.removeTab(tab, { animate: true });
  }

  #deleteTabs(win, removals, fail) {
    for (const { key: tabId, record } of removals) {
      try {
        const tab = this.#itemIn(win, tabId);
        if (win.gBrowser.isTab(tab)) {
          this.#removeTab(win, tab);
        }
      } catch (e) {
        fail(record, e);
      }
    }
  }

  /* Mark: splits */

  #applySplits(win, splits, fail) {
    for (const { key: splitId, data, record } of splits) {
      try {
        const members = (data.tabs || [])
          .map(id => this.#itemIn(win, id))
          .filter(tab => win.gBrowser.isTab(tab));
        const existing = this.#itemIn(win, splitId);
        const hasGroup = existing?.hasAttribute?.("split-view-group");
        if (hasGroup) {
          const wanted = new Set(data.tabs || []);
          for (const tab of [...existing.tabs]) {
            if (tab.id && !wanted.has(tab.id)) {
              win.gZenViewSplitter.removeTabFromGroup(tab, undefined, {
                changeTab: false,
              });
            }
          }
        }
        if (members.length >= 2) {
          win.gZenViewSplitter.splitTabs(members, data.gridType, -1, {
            groupFetchId: splitId,
          });
        }
        // Folder membership, mirroring the tab flow in #updateTab: the
        // record's folderId is authoritative for where the group lives.
        const group = this.#itemIn(win, splitId);
        if (group?.hasAttribute?.("split-view-group")) {
          const currentFolder = group.group?.isZenFolder
            ? group.group.id
            : null;
          const wantFolder = data.folderId || null;
          if (currentFolder !== wantFolder) {
            const target = wantFolder && this.#itemIn(win, wantFolder);
            if (target?.isZenFolder) {
              target.addTabs([group]);
            } else if (!wantFolder && currentFolder) {
              // Unwrap every folder level, not just the innermost one.
              while (
                win.gBrowser.isTabGroup(group.group) &&
                group.group.isZenFolder
              ) {
                win.gBrowser.ungroupTab(group);
              }
            }
          }
        }
      } catch (e) {
        fail(record, e);
      }
    }
  }

  #deleteSplits(win, removals, fail) {
    for (const { key: splitId, record } of removals) {
      try {
        const index = win.gZenViewSplitter._data.findIndex(
          group => group.groupId === splitId
        );
        if (index >= 0) {
          win.gZenViewSplitter.removeGroup(index);
        }
      } catch (e) {
        fail(record, e);
      }
    }
  }

  /* Mark: ordering */

  #applyRelativeOrder(win, elements) {
    let prev = null;
    for (const el of elements) {
      if (!el) {
        continue;
      }
      if (
        prev &&
        prev.parentNode &&
        prev.parentNode === el.parentNode &&
        prev.nextElementSibling !== el
      ) {
        win.gBrowser.zenHandleTabMove(el, () => prev.after(el));
      }
      prev = el;
    }
  }

  /**
   * Ordering runs in the first synced window only: every move goes through
   * zenHandleTabMove, whose TabMove events window sync replicates into the
   * other windows.
   *
   * @param {Window} win
   * @param {object} incoming
   * @param {Function} fail
   */
  #applyOrdering(win, incoming, fail) {
    for (const { key, data, record } of [
      ...incoming.spaces,
      ...incoming.folders,
    ]) {
      try {
        if (Array.isArray(data.children) && data.children.length) {
          // A folder's empty-tab placeholder anchors its first child: without
          // it, relative ordering could never move anything to the start.
          const folder = data.folderId ? this.#itemIn(win, key) : null;
          const start = folder?.isZenFolder
            ? folder.tabs.find(t => t.hasAttribute("zen-empty-tab"))
            : null;
          this.#applyRelativeOrder(win, [
            start ?? null,
            ...data.children.map(id => this.#itemIn(win, id)),
          ]);
        }
      } catch (e) {
        fail(record, e);
      }
    }
    if (!incoming.layout) {
      return;
    }
    const { data, record } = incoming.layout;
    try {
      for (const tabIds of Object.values(data.essentials || {})) {
        if (Array.isArray(tabIds) && tabIds.length > 1) {
          this.#applyRelativeOrder(
            win,
            tabIds.map(id => this.#itemIn(win, id))
          );
        }
      }
      if (Array.isArray(data.spaces) && data.spaces.length > 1) {
        const current = win.gZenWorkspaces.getWorkspaces();
        const byUuid = new Map(current.map(s => [s.uuid, s]));
        const ordered = data.spaces
          .map(uuid => byUuid.get(uuid))
          .filter(Boolean);
        for (const space of current) {
          if (!data.spaces.includes(space.uuid)) {
            ordered.push(space);
          }
        }
        const changedOrder = ordered.some(
          (space, i) => current[i]?.uuid !== space.uuid
        );
        if (changedOrder && ordered.length === current.length) {
          win.gZenWindowSync.propagateWorkspacesToAllWindows(ordered);
        }
      }
    } catch (e) {
      fail(record, e);
    }
  }
}

export const ZenSpacesSyncApplier = new nsZenSpacesSyncApplier();
