/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { ZenSpacesSyncModel } = ChromeUtils.importESModule(
  "resource:///modules/zen/ZenSpacesSyncModel.sys.mjs"
);
const { ZenSpacesSyncApplier } = ChromeUtils.importESModule(
  "resource:///modules/zen/ZenSpacesSyncApplier.sys.mjs"
);
const { SessionSaver } = ChromeUtils.importESModule(
  "moz-src:///browser/components/sessionstore/SessionSaver.sys.mjs"
);
const { TabStateFlusher } = ChromeUtils.importESModule(
  "moz-src:///browser/components/sessionstore/TabStateFlusher.sys.mjs"
);
const { TestUtils } = ChromeUtils.importESModule(
  "resource://testing-common/TestUtils.sys.mjs"
);
const { E10SUtils } = ChromeUtils.importESModule(
  "resource://gre/modules/E10SUtils.sys.mjs"
);
const { PromiseTestUtils } = ChromeUtils.importESModule(
  "resource://testing-common/PromiseTestUtils.sys.mjs"
);

PromiseTestUtils.allowMatchingRejectionsGlobally(/menu-bookmark-tab/);

const NORMAL_TABS_PREF = "zen.spaces-sync.normal-tabs";

/**
 * Runs a full session save (which collects the sidebar data) and returns
 * fresh sync projections built from it.
 */
async function collectProjections() {
  await SessionSaver.run();
  ZenSpacesSyncModel.invalidate();
  return ZenSpacesSyncModel.projections();
}

async function openSyncableTab(url, { pinned = false } = {}) {
  const tab = await BrowserTestUtils.openNewForegroundTab(gBrowser, url);
  if (pinned) {
    gBrowser.pinTab(tab);
  }
  await TabStateFlusher.flush(tab.linkedBrowser);
  ok(tab.id, "the tab should have a sync id");
  return tab;
}

function tabRecord(
  id,
  {
    pinned,
    url = "https://example.com/",
    current = null,
    workspaceUuid,
    folderId = null,
  } = {}
) {
  return {
    id,
    deleted: false,
    cleartext: {
      kind: "tab",
      data: {
        tabId: id,
        url,
        title: "Synced tab",
        current,
        icon: null,
        containerGuid: null,
        essential: false,
        pinned,
        workspaceUuid: workspaceUuid ?? gZenWorkspaces.activeWorkspace,
        folderId,
        staticLabel: null,
        hasStaticIcon: false,
        defaultContainer: false,
      },
    },
  };
}

function folderRecord(id, { name = "Synced folder", workspaceUuid } = {}) {
  return {
    id,
    deleted: false,
    cleartext: {
      kind: "folder",
      data: {
        folderId: id,
        name,
        icon: null,
        workspaceUuid: workspaceUuid ?? gZenWorkspaces.activeWorkspace,
        parentFolderId: null,
        live: null,
        children: [],
      },
    },
  };
}

function tombstone(id) {
  return { id, deleted: true };
}
