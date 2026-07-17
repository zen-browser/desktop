/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Canonical Space routing — open URL / move tab via Zen APIs only.
 * Never sets zen-workspace-id without moveTabsToWorkspace.
 */

import {
  isValidSpaceUuid,
  resolveLaunchSpace,
  nextSwitchGeneration,
  ownsSwitchGeneration,
  shouldRollbackSwitch,
} from "resource:///modules/zen/AstraSpaceIntegrity.mjs";

export {
  nextSwitchGeneration,
  ownsSwitchGeneration,
  shouldRollbackSwitch,
};

function systemPrincipal() {
  return Services.scriptSecurityManager.getSystemPrincipal();
}

function validateHttpsUrl(url) {
  if (typeof url !== "string" || !url.trim()) {
    return { ok: false, reason: "empty" };
  }
  let parsed;
  try {
    parsed = new URL(url.trim());
  } catch {
    return { ok: false, reason: "unparseable" };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, reason: `scheme:${parsed.protocol}` };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, reason: "credentials" };
  }
  return { ok: true, href: parsed.href };
}

async function awaitSpacesReady(win) {
  const ws = win?.gZenWorkspaces;
  if (!ws?.workspaceEnabled) {
    return false;
  }
  try {
    if (ws.promiseInitialized) {
      await ws.promiseInitialized;
    }
  } catch {
    return false;
  }
  return true;
}

/**
 * Open a URL in a target Space using trusted tab APIs + canonical move.
 * @returns {{ ok: boolean, tab: object|null, browser: object|null, spaceId: string|null, reason?: string }}
 */
export async function openURLInSpace(win, {
  url,
  targetSpaceId = null,
  inBackground = false,
  source = "routing",
  customAppId = null,
} = {}) {
  void source;
  void customAppId;
  if (!win || win.closed) {
    return { ok: false, tab: null, browser: null, spaceId: null, reason: "window-closed" };
  }
  const urlCheck = validateHttpsUrl(url);
  if (!urlCheck.ok) {
    return { ok: false, tab: null, browser: null, spaceId: null, reason: urlCheck.reason };
  }
  const ready = await awaitSpacesReady(win);
  const ws = win.gZenWorkspaces;
  if (!ready || !ws) {
    // Still try a normal trusted open without Space assignment.
    return openTrustedInWindow(win, urlCheck.href, { inBackground });
  }

  const spaces = ws.getWorkspaces?.() || [];
  const resolved = resolveLaunchSpace({
    explicitSpaceId: targetSpaceId || "",
    activeSpaceId: ws.activeWorkspace || "",
    spaces,
  });
  let spaceId = resolved.spaceId;
  if (!spaceId || !ws.getWorkspaceFromId?.(spaceId)) {
    spaceId = ws.activeWorkspace || null;
  }
  if (!spaceId) {
    return { ok: false, tab: null, browser: null, spaceId: null, reason: "no-space" };
  }

  const opened = openTrustedInWindow(win, urlCheck.href, { inBackground });
  if (!opened.ok || !opened.tab) {
    return { ...opened, spaceId: null, reason: "open-failed" };
  }

  try {
    if (typeof ws.moveTabToWorkspace === "function") {
      ws.moveTabToWorkspace(opened.tab, spaceId, { trackUndo: false });
    }
  } catch (error) {
    console.warn("[AstraSpaceRouting] moveTabToWorkspace failed");
    // Fall back: tab stays in current Space.
    spaceId = opened.tab.getAttribute?.("zen-workspace-id") || ws.activeWorkspace;
  }

  const assigned = opened.tab.getAttribute?.("zen-workspace-id") || "";
  if (assigned && assigned !== spaceId && ws.getWorkspaceFromId?.(assigned)) {
    spaceId = assigned;
  }

  if (!inBackground && opened.tab && win.gBrowser) {
    try {
      // Only select if the Space is active; otherwise leave background.
      if (ws.activeWorkspace === spaceId) {
        win.gBrowser.selectedTab = opened.tab;
      }
    } catch {
      // ignore
    }
  }

  return {
    ok: true,
    tab: opened.tab,
    browser: opened.tab?.linkedBrowser || null,
    spaceId,
  };
}

function openTrustedInWindow(win, href, { inBackground = false } = {}) {
  try {
    if (typeof win.openTrustedLinkIn === "function") {
      win.openTrustedLinkIn(href, "tab", {
        triggeringPrincipal: systemPrincipal(),
        inBackground: !!inBackground,
      });
      const tab = inBackground
        ? findNewestTab(win)
        : win.gBrowser?.selectedTab || null;
      return { ok: true, tab, browser: tab?.linkedBrowser || null, spaceId: null };
    }
    if (win.gBrowser) {
      const tab = win.gBrowser.addTrustedTab(href, {
        triggeringPrincipal: systemPrincipal(),
        inBackground: !!inBackground,
      });
      if (!inBackground) {
        win.gBrowser.selectedTab = tab;
      }
      return { ok: true, tab, browser: tab?.linkedBrowser || null, spaceId: null };
    }
  } catch (error) {
    console.error("[AstraSpaceRouting] trusted open failed");
  }
  return { ok: false, tab: null, browser: null, spaceId: null };
}

function findNewestTab(win) {
  try {
    const tabs = win.gBrowser?.tabs;
    if (!tabs?.length) {
      return null;
    }
    return tabs[tabs.length - 1] || null;
  } catch {
    return null;
  }
}

/**
 * Move an existing tab into a target Space via canonical API.
 */
export function moveTabToSpace(win, tab, targetSpaceId, { select = false } = {}) {
  const ws = win?.gZenWorkspaces;
  if (!ws || !tab || !isValidSpaceUuid(targetSpaceId)) {
    return { ok: false, reason: "invalid" };
  }
  if (!ws.getWorkspaceFromId?.(targetSpaceId)) {
    return { ok: false, reason: "missing-space" };
  }
  try {
    ws.moveTabToWorkspace(tab, targetSpaceId);
    if (select && ws.activeWorkspace === targetSpaceId && win.gBrowser) {
      win.gBrowser.selectedTab = tab;
    }
    win.dispatchEvent(
      new CustomEvent("AstraTabMovedBetweenSpaces", {
        bubbles: true,
        detail: {
          spaceId: targetSpaceId,
          reason: "move",
        },
      })
    );
    return { ok: true, spaceId: targetSpaceId };
  } catch {
    return { ok: false, reason: "move-failed" };
  }
}

/**
 * Transactional Space switch with rollback on failure.
 * Latest-intent-wins via generation token.
 */
export async function switchSpaceSafely(win, targetSpaceId, options = {}) {
  const ws = win?.gZenWorkspaces;
  if (!win || win.closed || !ws?.workspaceEnabled) {
    return { ok: false, reason: "unavailable" };
  }
  if (ws._isClosingWindow) {
    return { ok: false, reason: "closing" };
  }

  await awaitSpacesReady(win);

  if (!isValidSpaceUuid(targetSpaceId) || !ws.getWorkspaceFromId?.(targetSpaceId)) {
    return { ok: false, reason: "missing-space" };
  }

  // Generation: latest intent wins.
  const gen = (ws._astraSwitchGeneration = nextSwitchGeneration(
    ws._astraSwitchGeneration
  ));
  const previousSpaceId = ws.activeWorkspace;
  const previousTab = win.gBrowser?.selectedTab || null;

  // Reentrancy: do not nest safe-wrapper → canonical → safe-wrapper.
  // Canonical path is changeWorkspaceWithID only.
  try {
    await ws.changeWorkspaceWithID(targetSpaceId, options);
    if (!ownsSwitchGeneration(gen, ws._astraSwitchGeneration)) {
      // Superseded by a newer switch.
      return { ok: true, superseded: true, spaceId: ws.activeWorkspace };
    }
    if (ws.activeWorkspace !== targetSpaceId) {
      throw new Error("active-mismatch");
    }
    // Guarantee a visible tab.
    const selected = win.gBrowser?.selectedTab;
    const visible =
      selected &&
      !selected.hidden &&
      (selected.getAttribute("zen-workspace-id") === targetSpaceId ||
        selected.hasAttribute("zen-empty-tab") ||
        selected.hasAttribute("zen-essential"));
    if (!visible) {
      const empty = ws._emptyTab || ws.selectEmptyTab?.();
      if (empty && win.gBrowser) {
        win.gBrowser.selectedTab = empty;
      }
    }
    win.dispatchEvent(
      new CustomEvent("AstraSpaceChanged", {
        bubbles: true,
        detail: {
          spaceId: targetSpaceId,
          previousSpaceId,
          reason: options.reason || "switch",
        },
      })
    );
    return { ok: true, spaceId: targetSpaceId };
  } catch (error) {
    console.warn("[AstraSpaceRouting] switch failed; rolling back");
    try {
      if (
        shouldRollbackSwitch(gen, ws._astraSwitchGeneration) &&
        previousSpaceId &&
        ws.getWorkspaceFromId?.(previousSpaceId)
      ) {
        await ws.changeWorkspaceWithID(previousSpaceId, { alwaysChange: true });
        if (
          previousTab?.isConnected &&
          previousTab.getAttribute?.("zen-workspace-id") === previousSpaceId &&
          win.gBrowser
        ) {
          win.gBrowser.selectedTab = previousTab;
        }
      }
    } catch {
      // Last resort: ensure some visible tab.
      try {
        ws.selectEmptyTab?.();
      } catch {
        // ignore
      }
    }
    // Emit failure only while this transaction still owns the generation.
    if (shouldRollbackSwitch(gen, ws._astraSwitchGeneration)) {
      win.dispatchEvent(
        new CustomEvent("AstraSpaceChanged", {
          bubbles: true,
          detail: {
            spaceId: ws.activeWorkspace || null,
            previousSpaceId,
            reason: "switch-failed",
          },
        })
      );
    }
    return { ok: false, reason: "switch-failed" };
  }
}

/**
 * Safe Space deletion with explicit tab disposition.
 * @param {"move"|"close"} disposition
 */
export async function deleteSpaceSafely(
  win,
  spaceId,
  { disposition = "move", targetSpaceId = null } = {}
) {
  const ws = win?.gZenWorkspaces;
  if (!ws || ws.privateWindowOrDisabled) {
    return { ok: false, reason: "unavailable" };
  }
  const spaces = ws.getWorkspaces?.() || [];
  if (spaces.length <= 1) {
    return { ok: false, reason: "last-space" };
  }
  if (!ws.getWorkspaceFromId?.(spaceId)) {
    return { ok: false, reason: "missing-space" };
  }

  const tabs = (ws.allStoredTabs || []).filter(
    tab =>
      tab.getAttribute?.("zen-workspace-id") === spaceId &&
      !tab.hasAttribute?.("zen-essential") &&
      !(tab.hasAttribute?.("zen-empty-tab") && !tab.group)
  );

  let moveTarget = targetSpaceId;
  if (disposition === "move") {
    if (!moveTarget || moveTarget === spaceId || !ws.getWorkspaceFromId?.(moveTarget)) {
      moveTarget = spaces.find(s => s.uuid !== spaceId)?.uuid || null;
    }
    if (!moveTarget) {
      return { ok: false, reason: "no-move-target" };
    }
    if (tabs.length) {
      const moved = ws.moveTabsToWorkspace(tabs, moveTarget, { trackUndo: false });
      if (!moved) {
        return { ok: false, reason: "move-failed" };
      }
    }
    // Move folders
    try {
      for (const group of win.gBrowser?.tabGroups || []) {
        if (group.getAttribute?.("zen-workspace-id") === spaceId) {
          win.gZenFolders?.changeFolderToSpace?.(group, moveTarget);
        }
      }
    } catch {
      // continue — tabs already moved
    }
  } else if (disposition === "close") {
    // Explicit close path — user confirmed.
    try {
      win.gBrowser?.removeTabs?.(tabs, { closeWindowWithLastTab: false });
    } catch {
      return { ok: false, reason: "close-failed" };
    }
  } else {
    return { ok: false, reason: "cancelled" };
  }

  win.dispatchEvent(
    new CustomEvent("AstraSpaceDeleting", {
      bubbles: true,
      detail: { spaceId, reason: disposition },
    })
  );

  const previousActive = ws.activeWorkspace;
  try {
    // removeWorkspace still deletes remaining owned tabs — clear first by moving.
    // Temporarily stub owned tabs to empty by ensuring none remain with this id.
    await ws.removeWorkspace(spaceId);
  } catch {
    return { ok: false, reason: "delete-failed" };
  }

  if (previousActive === spaceId && moveTarget) {
    try {
      await switchSpaceSafely(win, moveTarget, { reason: "after-delete" });
    } catch {
      // ignore
    }
  }

  win.dispatchEvent(
    new CustomEvent("AstraSpaceDeleted", {
      bubbles: true,
      detail: { spaceId, reason: disposition },
    })
  );
  return { ok: true, spaceId, movedTo: moveTarget || null };
}
