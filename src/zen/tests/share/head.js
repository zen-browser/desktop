/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { ZenShareClient, ZenShareError } = ChromeUtils.importESModule(
  "resource:///modules/zen/share/ZenShareClient.sys.mjs"
);

const SHARE_BASE = "https://example.com";
const SHARE_ID = "AAAA-BBBB-CCCC-DDDD";

/**
 * Replaces a method on an object until the current test file ends.
 *
 * @returns {Function} Restores the original immediately.
 */
function stubMethod(object, name, replacement) {
  const original = object[name];
  object[name] = replacement;
  const restore = () => (object[name] = original);
  registerCleanupFunction(restore);
  return restore;
}

function stubSharePreview(doc, name = null) {
  return stubMethod(ZenShareClient, "fetchSharePreview", async () => ({
    doc,
    name,
  }));
}

function makeLazyTab(url, label) {
  return gBrowser.addTrustedTab(url, {
    createLazyBrowser: true,
    inBackground: true,
    skipAnimation: true,
    lazyTabTitle: label,
    skipRoute: true,
  });
}

/** Opens a share link and waits for its overlay to finish loading. */
async function openShareOverlay(spec) {
  const tab = gBrowser.addTrustedTab(spec, { inBackground: false });
  gBrowser.selectedTab = tab;
  await TestUtils.waitForCondition(() => {
    const overlay = tab.linkedBrowser._zenShareOverlay;
    return overlay && !overlay.querySelector(".zen-share-overlay-status");
  }, "share overlay should finish loading");
  return { tab, overlay: tab.linkedBrowser._zenShareOverlay };
}

/** Clicks the overlay's import button and waits for the tab to close. */
async function importFromOverlay(tab, overlay) {
  const closed = BrowserTestUtils.waitForTabClosing(tab);
  overlay.querySelector(".zen-share-overlay-add").click();
  await closed;
}

/** Removes every workspace except the one passed, and all leftover tabs,
 * folders and splits of the surviving workspace. */
async function cleanupSpaces(keepUuid) {
  for (const workspace of gZenWorkspaces.getWorkspaces()) {
    if (workspace.uuid !== keepUuid) {
      await gZenWorkspaces.removeWorkspace(workspace.uuid);
    }
  }
  const element = gZenWorkspaces.workspaceElement(keepUuid);
  for (const folder of [...element.querySelectorAll("zen-folder")]) {
    await folder.delete();
  }
  // A fresh keeper tab lets every test tab go, including the last pinned
  // split member that would otherwise survive and leak into the next task.
  const keeper = BrowserTestUtils.addTab(gBrowser, "about:blank", {
    skipAnimation: true,
  });
  for (const tab of [...gBrowser.tabs]) {
    if (tab !== keeper && !tab.hasAttribute("zen-empty-tab")) {
      BrowserTestUtils.removeTab(tab);
    }
  }
  await TestUtils.waitForCondition(
    () => !document.querySelector("tab-group[split-view-group]"),
    "no split groups should survive cleanup"
  );
}
