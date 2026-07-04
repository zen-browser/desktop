/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export const RECORD_TYPES = Object.freeze({
  SPACE: "space",
  CONTAINER: "container",
  TAB: "tab",
  FOLDER: "folder",
  SPLIT: "split",
});

export const WORKSPACES_ENGINE_NAME = "Workspaces";
export const WORKSPACES_RECORD_LOG_NAME = "Sync.Record.ZenWorkspaces";
export const WORKSPACES_RECORD_TYPE = "workspaces";

export const SYNC_PREFS = Object.freeze({
  SYNC_ONLY_PINNED_TABS: "zen.window-sync.sync-only-pinned-tabs",
});

export const OBSERVER_TOPICS = Object.freeze({
  ZEN_WORKSPACE_ITEM_CHANGED: "zen-workspace-item-changed",
  CONTEXTUAL_IDENTITY_CREATED: "contextual-identity-created",
  CONTEXTUAL_IDENTITY_UPDATED: "contextual-identity-updated",
  CONTEXTUAL_IDENTITY_DELETED: "contextual-identity-deleted",
});

export const CONTEXTUAL_IDENTITY_TOPIC_PREFIX = "contextual-identity-";

export const RECORD_ID_PREFIX_BY_TYPE = Object.freeze({
  [RECORD_TYPES.SPACE]: "s",
  [RECORD_TYPES.CONTAINER]: "c",
  [RECORD_TYPES.TAB]: "t",
  [RECORD_TYPES.FOLDER]: "f",
  [RECORD_TYPES.SPLIT]: "sv",
});

export const RECORD_TYPE_BY_PREFIX = Object.freeze({
  s: RECORD_TYPES.SPACE,
  c: RECORD_TYPES.CONTAINER,
  t: RECORD_TYPES.TAB,
  f: RECORD_TYPES.FOLDER,
  sv: RECORD_TYPES.SPLIT,
});
