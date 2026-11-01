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

const { gZenBoostsManager } = ChromeUtils.importESModule(
  "resource:///modules/zen/boosts/ZenBoostsManager.sys.mjs"
);

const BOOST_DOMAIN = "example.com";

// A hostile share: every field that can carry a request or break out of the
// CSS it is interpolated into is poisoned.
const BOOST_DOC = {
  version: "1",
  shared: {
    type: "boost",
    name: "Shared Boost",
    domain: BOOST_DOMAIN,
    author: "John Zen",
    icon: "data:image/png;base64,iVBORw0KGgo=",
    preview: "data:image/jpeg;base64,/9j/4AAQ",
    signature: { viewBox: "0 0 100 50", paths: ["M1 1 L2 2"] },
    boostData: {
      boostName: "Ignored",
      customCSS:
        "@import url(https://evil.example/x.css); " +
        "body { background: url(https://evil.example/t.png); color: red; }",
      fontFamily: "Arial; background: url(https://evil.example/f)",
      textCaseOverride: "blink",
      zapSelectors: [".ad", { not: "a string" }],
      dotPos: { x: 0.2, y: "nope", extra: 1 },
      sizeOverride: "big",
      smartInvert: true,
    },
  },
};
