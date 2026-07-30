/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Mutation-free Space state validation + conservative repair planning.
 * Does not log URLs, titles, or browsing content.
 */

/** Stable UUID for the lazily created Recovered Tabs Space (idempotent). */
export const RECOVERED_TABS_SPACE_UUID =
  "a57ra000-rec0-4000-8000-000000000001";

export const ASTRA_SPACE_ROLE_RECOVERED = "recovered-tabs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidSpaceUuid(value) {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

/**
 * @typedef {object} SpaceSnapshot
 * @property {string} uuid
 * @property {string} [name]
 * @property {number} [containerTabId]
 * @property {string} [astraRole]
 */

/**
 * @typedef {object} TabSnapshot
 * @property {string} [id]
 * @property {string} [workspaceId]
 * @property {boolean} [essential]
 * @property {boolean} [empty]
 * @property {boolean} [alive]
 * @property {boolean} [closing]
 * @property {boolean} [pending]
 * @property {boolean} [pinned]
 * @property {boolean} [hasGroup]
 * @property {boolean} [splitView]
 * @property {boolean} [restoring]
 */

/**
 * Cross-compartment-safe Set coercion.
 * `instanceof Set` fails when the Set was created in another global
 * (window vs system module), which would treat a valid id set as empty
 * and mark live tabs as orphans / skip pin validation.
 */
export function asIdSet(value) {
  if (value != null && typeof value === "object") {
    try {
      if (Object.prototype.toString.call(value) === "[object Set]") {
        return value;
      }
    } catch {
      // fall through
    }
  }
  if (Array.isArray(value)) {
    return new Set(value);
  }
  return new Set();
}

/**
 * Classify a tab for integrity — mutation-free.
 * Only `orphan-live` may be assigned to Recovered Tabs.
 * `zombie-*` may be cleaned by upstream empty/stale cleanup (never recovered).
 * `not-ready` must wait for restore; do not repair yet.
 */
export function classifyTabForIntegrity(tab, validSpaceIds) {
  const ids = asIdSet(validSpaceIds);
  if (!tab || typeof tab !== "object") {
    return { kind: "skip", reason: "null" };
  }
  // Production always sets boolean; omitted means "assume live" for pure fixtures.
  const isAlive = tab.alive === undefined ? true : !!tab.alive;
  if (tab.essential) {
    return { kind: "skip-essential" };
  }
  if (tab.empty && tab.pinned && !tab.hasGroup) {
    return { kind: "zombie-empty-folder" };
  }
  if (tab.empty) {
    return { kind: "skip-empty" };
  }
  if (tab.closing) {
    return { kind: "zombie-closing" };
  }
  if (tab.restoring || (!isAlive && tab.pending)) {
    return { kind: "not-ready" };
  }
  if (!isAlive) {
    return { kind: "zombie-stale" };
  }
  const wid = typeof tab.workspaceId === "string" ? tab.workspaceId : "";
  if (!wid || !ids.has(wid)) {
    return { kind: "orphan-live", workspaceId: wid || "" };
  }
  if (tab.splitView) {
    return { kind: "owned-split", workspaceId: wid };
  }
  return { kind: "owned", workspaceId: wid };
}

/**
 * Proven readiness gate for integrity repair (pure).
 */
export function isSpaceIntegrityReady({
  spacesInitialized = false,
  sessionRestoreComplete = false,
  workspaceCacheReady = false,
  windowClosing = false,
} = {}) {
  return !!(
    spacesInitialized &&
    sessionRestoreComplete &&
    workspaceCacheReady &&
    !windowClosing
  );
}

/** Pure switch-generation helpers — latest intent owns the window switch. */
export function nextSwitchGeneration(current = 0) {
  const n = Number(current) || 0;
  return n + 1;
}

export function ownsSwitchGeneration(ownerGen, currentGen) {
  return ownerGen === currentGen;
}

export function shouldRollbackSwitch(ownerGen, currentGen) {
  return ownsSwitchGeneration(ownerGen, currentGen);
}

/**
 * Resolve Recovered Tabs Space identity without hijacking a user Space.
 * @returns {{ spaceId: string, create: boolean, collided: boolean }}
 */
export function resolveRecoveredSpaceIdentity(spaces = []) {
  const list = Array.isArray(spaces) ? spaces : [];
  const byRole = list.find(
    s => s && s.astraRole === ASTRA_SPACE_ROLE_RECOVERED && isValidSpaceUuid(s.uuid)
  );
  if (byRole) {
    return { spaceId: byRole.uuid, create: false, collided: false };
  }
  const byReserved = list.find(
    s => s && s.uuid === RECOVERED_TABS_SPACE_UUID
  );
  if (byReserved) {
    if (byReserved.astraRole === ASTRA_SPACE_ROLE_RECOVERED) {
      return { spaceId: byReserved.uuid, create: false, collided: false };
    }
    // Reserved UUID occupied by a normal user Space — do not hijack.
    return {
      spaceId: "",
      create: true,
      collided: true,
      avoidUuid: RECOVERED_TABS_SPACE_UUID,
    };
  }
  return {
    spaceId: RECOVERED_TABS_SPACE_UUID,
    create: true,
    collided: false,
  };
}

/**
 * Pure validation — never mutates input.
 */
export function validateSpaceState({
  spaces = [],
  activeSpaceId = "",
  tabs = [],
  folders = [],
  lastSelectedBySpace = {},
  spacePins = {},
  knownAppIds = null,
} = {}) {
  const issues = [];
  const orphanTabs = [];
  const zombieTabs = [];
  const notReadyTabs = [];
  const invalidFolders = [];
  const duplicateSpaces = [];
  const invalidAppPins = [];
  let invalidActiveSpace = false;

  if (!Array.isArray(spaces)) {
    issues.push({ code: "spaces-not-array" });
    return {
      valid: false,
      issues,
      orphanTabs,
      zombieTabs,
      notReadyTabs,
      invalidFolders,
      invalidActiveSpace: true,
      duplicateSpaces,
      invalidAppPins,
      repairPlan: buildRepairPlan({
        spaces: [],
        activeSpaceId: "",
        orphanTabs: [],
        invalidFolders: [],
        invalidActiveSpace: true,
        duplicateSpaces: [],
        invalidAppPins: [],
        lastSelectedBySpace: {},
      }),
    };
  }

  const seen = new Set();
  const validSpaces = [];
  for (const space of spaces) {
    if (!space || typeof space !== "object") {
      issues.push({ code: "space-not-object" });
      continue;
    }
    const uuid = typeof space.uuid === "string" ? space.uuid.trim() : "";
    if (!isValidSpaceUuid(uuid)) {
      issues.push({ code: "invalid-space-uuid" });
      continue;
    }
    if (seen.has(uuid)) {
      duplicateSpaces.push(uuid);
      issues.push({ code: "duplicate-space-uuid" });
      continue;
    }
    seen.add(uuid);
    validSpaces.push({
      uuid,
      name: typeof space.name === "string" ? space.name : "",
      containerTabId:
        typeof space.containerTabId === "number" ? space.containerTabId : 0,
      astraRole: typeof space.astraRole === "string" ? space.astraRole : "",
    });
  }

  if (!validSpaces.length) {
    issues.push({ code: "no-valid-spaces" });
    invalidActiveSpace = true;
  }

  const validIds = new Set(validSpaces.map(s => s.uuid));
  if (
    !activeSpaceId ||
    !isValidSpaceUuid(activeSpaceId) ||
    !validIds.has(activeSpaceId)
  ) {
    invalidActiveSpace = true;
    issues.push({ code: "invalid-active-space" });
  }

  for (const tab of Array.isArray(tabs) ? tabs : []) {
    if (!tab) {
      continue;
    }
    // Snapshot copy — never mutate caller object.
    const snap = {
      id: typeof tab.id === "string" ? tab.id : "",
      workspaceId: typeof tab.workspaceId === "string" ? tab.workspaceId : "",
      essential: !!tab.essential,
      empty: !!tab.empty,
      // Preserve undefined so classify defaults omitted alive → live.
      alive: tab.alive === undefined ? undefined : !!tab.alive,
      closing: !!tab.closing,
      pending: !!tab.pending,
      pinned: !!tab.pinned,
      hasGroup: !!tab.hasGroup,
      splitView: !!tab.splitView,
      restoring: !!tab.restoring,
    };
    const classified = classifyTabForIntegrity(snap, validIds);
    if (classified.kind === "orphan-live") {
      orphanTabs.push({
        id: snap.id,
        workspaceId: classified.workspaceId || "",
      });
    } else if (
      classified.kind === "zombie-empty-folder" ||
      classified.kind === "zombie-closing" ||
      classified.kind === "zombie-stale"
    ) {
      zombieTabs.push({ id: snap.id, kind: classified.kind });
    } else if (classified.kind === "not-ready") {
      notReadyTabs.push({ id: snap.id });
    }
  }
  if (orphanTabs.length) {
    issues.push({ code: "orphan-tabs", count: orphanTabs.length });
  }
  if (notReadyTabs.length) {
    issues.push({ code: "tabs-not-ready", count: notReadyTabs.length });
  }

  for (const folder of Array.isArray(folders) ? folders : []) {
    if (!folder) {
      continue;
    }
    const wid = typeof folder.workspaceId === "string" ? folder.workspaceId : "";
    if (!wid || !validIds.has(wid)) {
      invalidFolders.push({
        id: typeof folder.id === "string" ? folder.id : "",
        workspaceId: wid || "",
      });
    }
  }
  if (invalidFolders.length) {
    issues.push({ code: "invalid-folders", count: invalidFolders.length });
  }

  if (spacePins && typeof spacePins === "object" && !Array.isArray(spacePins)) {
    for (const [spaceId, pins] of Object.entries(spacePins)) {
      if (!validIds.has(spaceId)) {
        invalidAppPins.push({ spaceId, reason: "missing-space" });
        continue;
      }
      if (!Array.isArray(pins)) {
        invalidAppPins.push({ spaceId, reason: "pins-not-array" });
        continue;
      }
      if (knownAppIds != null) {
        const known = asIdSet(knownAppIds);
        for (const pin of pins) {
          if (typeof pin !== "string" || !known.has(pin)) {
            invalidAppPins.push({
              spaceId,
              appId: typeof pin === "string" ? pin : "",
              reason: "unknown-app",
            });
          }
        }
      }
    }
  }
  if (invalidAppPins.length) {
    issues.push({ code: "invalid-app-pins", count: invalidAppPins.length });
  }

  // When tabs are still restoring, do not plan orphan moves yet.
  const deferOrphans = notReadyTabs.length > 0;
  const repairPlan = buildRepairPlan({
    spaces: validSpaces,
    activeSpaceId,
    orphanTabs: deferOrphans ? [] : orphanTabs,
    invalidFolders: deferOrphans ? [] : invalidFolders,
    invalidActiveSpace,
    duplicateSpaces,
    invalidAppPins: deferOrphans ? [] : invalidAppPins,
    lastSelectedBySpace:
      lastSelectedBySpace && typeof lastSelectedBySpace === "object"
        ? { ...lastSelectedBySpace }
        : {},
    recoveredIdentity: resolveRecoveredSpaceIdentity(validSpaces),
  });

  const valid =
    issues.filter(i => i.code !== "tabs-not-ready").length === 0 &&
    !notReadyTabs.length;

  return {
    valid,
    issues,
    orphanTabs,
    zombieTabs,
    notReadyTabs,
    invalidFolders,
    invalidActiveSpace,
    duplicateSpaces,
    invalidAppPins,
    repairPlan,
  };
}

export function chooseSafeActiveSpace(spaces, preferredId = "") {
  const list = Array.isArray(spaces) ? spaces.filter(s => isValidSpaceUuid(s?.uuid)) : [];
  if (!list.length) {
    return null;
  }
  if (preferredId && list.some(s => s.uuid === preferredId)) {
    return list.find(s => s.uuid === preferredId);
  }
  // Prefer most recent non-recovered space, else first.
  const normal = list.filter(
    s => s.astraRole !== ASTRA_SPACE_ROLE_RECOVERED && s.uuid !== RECOVERED_TABS_SPACE_UUID
  );
  return (normal[0] || list[0]) ?? null;
}

/**
 * Build a conservative repair plan (no mutation).
 */
export function buildRepairPlan({
  spaces = [],
  activeSpaceId = "",
  orphanTabs = [],
  invalidFolders = [],
  invalidActiveSpace = false,
  duplicateSpaces = [],
  invalidAppPins = [],
  lastSelectedBySpace = {},
  recoveredIdentity = null,
} = {}) {
  const actions = [];
  const validSpaces = Array.isArray(spaces)
    ? spaces.filter(s => isValidSpaceUuid(s?.uuid))
    : [];

  if (duplicateSpaces?.length) {
    actions.push({
      type: "drop-duplicate-space-entries",
      uuids: [...new Set(duplicateSpaces)],
    });
  }

  if (!validSpaces.length) {
    actions.push({ type: "ensure-default-space" });
  }

  let targetActive = activeSpaceId;
  if (invalidActiveSpace || !validSpaces.some(s => s.uuid === activeSpaceId)) {
    const chosen = chooseSafeActiveSpace(validSpaces, activeSpaceId);
    targetActive = chosen?.uuid || null;
    actions.push({
      type: "set-active-space",
      spaceId: targetActive,
      createDefaultIfMissing: !chosen,
    });
  }

  if (orphanTabs.length) {
    const identity =
      recoveredIdentity || resolveRecoveredSpaceIdentity(validSpaces);
    actions.push({
      type: "ensure-recovered-tabs-space",
      spaceId: identity.spaceId || RECOVERED_TABS_SPACE_UUID,
      create: !!identity.create,
      collided: !!identity.collided,
      avoidUuid: identity.avoidUuid || null,
    });
    actions.push({
      type: "assign-orphan-tabs",
      spaceId: identity.spaceId || RECOVERED_TABS_SPACE_UUID,
      tabIds: orphanTabs.map(t => t.id).filter(Boolean),
      count: orphanTabs.length,
    });
  }

  for (const folder of invalidFolders) {
    actions.push({
      type: "detach-invalid-folder",
      folderId: folder.id || "",
      targetSpaceId: targetActive || RECOVERED_TABS_SPACE_UUID,
    });
  }

  for (const pin of invalidAppPins) {
    if (pin.reason === "missing-space") {
      actions.push({ type: "remove-space-pins", spaceId: pin.spaceId });
    } else if (pin.reason === "unknown-app") {
      actions.push({
        type: "remove-app-pin",
        spaceId: pin.spaceId,
        appId: pin.appId || "",
      });
    } else if (pin.reason === "pins-not-array") {
      actions.push({ type: "remove-space-pins", spaceId: pin.spaceId });
    }
  }

  for (const [spaceId, tabId] of Object.entries(lastSelectedBySpace || {})) {
    if (!validSpaces.some(s => s.uuid === spaceId) || !tabId) {
      actions.push({ type: "clear-last-selected", spaceId });
    }
  }

  return {
    actions,
    needsRepair: actions.length > 0,
    counts: {
      orphanTabs: orphanTabs.length,
      invalidFolders: invalidFolders.length,
      invalidAppPins: invalidAppPins.length,
      duplicateSpaces: duplicateSpaces?.length || 0,
    },
  };
}

export function calculateRecoveredTabAssignments(orphanTabs, recoveredSpaceId) {
  const target =
    isValidSpaceUuid(recoveredSpaceId)
      ? recoveredSpaceId
      : RECOVERED_TABS_SPACE_UUID;
  const out = [];
  for (const tab of Array.isArray(orphanTabs) ? orphanTabs : []) {
    out.push({
      tabId: typeof tab.id === "string" ? tab.id : "",
      spaceId: target,
    });
  }
  return out;
}

/**
 * Sanitize Space → app pin map (pure).
 */
export function sanitizeSpacePins(
  raw,
  { validSpaceIds = null, knownAppIds = null, maxPinsPerSpace = 24 } = {}
) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const out = {};
  for (const [spaceId, pins] of Object.entries(raw)) {
    if (!isValidSpaceUuid(spaceId)) {
      continue;
    }
    if (validSpaceIds != null && !asIdSet(validSpaceIds).has(spaceId)) {
      continue;
    }
    if (!Array.isArray(pins)) {
      continue;
    }
    const seen = new Set();
    const clean = [];
    const known = knownAppIds != null ? asIdSet(knownAppIds) : null;
    for (const pin of pins) {
      if (typeof pin !== "string" || !pin || seen.has(pin)) {
        continue;
      }
      if (known && !known.has(pin)) {
        continue;
      }
      seen.add(pin);
      clean.push(pin);
      if (clean.length >= maxPinsPerSpace) {
        break;
      }
    }
    if (clean.length) {
      out[spaceId] = clean;
    }
  }
  return out;
}

export function resolveLaunchSpace({
  explicitSpaceId = "",
  activeSpaceId = "",
  spaces = [],
} = {}) {
  const valid = Array.isArray(spaces)
    ? spaces.filter(s => isValidSpaceUuid(s?.uuid))
    : [];
  const ids = new Set(valid.map(s => s.uuid));
  if (explicitSpaceId && ids.has(explicitSpaceId)) {
    return { spaceId: explicitSpaceId, reason: "explicit" };
  }
  if (activeSpaceId && ids.has(activeSpaceId)) {
    return { spaceId: activeSpaceId, reason: "current" };
  }
  const fallback = chooseSafeActiveSpace(valid);
  return {
    spaceId: fallback?.uuid || null,
    reason: fallback ? "fallback" : "none",
  };
}

/**
 * Snapshot current window Spaces/tabs for validation (no browsing content).
 */
export function snapshotWindowSpaceState(win) {
  const ws = win?.gZenWorkspaces;
  if (!ws || !ws.workspaceEnabled) {
    return null;
  }
  const spaces = (ws.getWorkspaces?.() || []).map(s => ({
    uuid: s.uuid,
    name: typeof s.name === "string" ? s.name : "",
    containerTabId:
      typeof s.containerTabId === "number" ? s.containerTabId : 0,
    astraRole: s.astraRole || "",
  }));
  const tabs = [];
  try {
    for (const tab of ws.allStoredTabs || []) {
      const closing =
        !!tab?.closing ||
        !!(win.gBrowser?._removingTabs?.has?.(tab)) ||
        !tab?.isConnected;
      tabs.push({
        id: tab?.id || "",
        workspaceId: tab?.getAttribute?.("zen-workspace-id") || "",
        essential: !!tab?.hasAttribute?.("zen-essential"),
        empty: !!tab?.hasAttribute?.("zen-empty-tab"),
        alive: !!tab?.linkedBrowser && !closing,
        closing,
        pending: !!tab?.hasAttribute?.("pending"),
        pinned: !!tab?.pinned,
        hasGroup: !!tab?.group,
        splitView: !!tab?.group?.hasAttribute?.("split-view-group"),
        restoring: !!tab?.hasAttribute?.("pending") && !tab?.linkedBrowser,
      });
    }
  } catch {
    // ignore
  }
  const folders = [];
  try {
    const groups = win.gBrowser?.tabGroups || [];
    for (const group of groups) {
      folders.push({
        id: group?.id || "",
        workspaceId: group?.getAttribute?.("zen-workspace-id") || "",
      });
    }
  } catch {
    // ignore
  }
  const lastSelectedBySpace = {};
  try {
    for (const [spaceId, tab] of Object.entries(
      ws.lastSelectedWorkspaceTabs || {}
    )) {
      lastSelectedBySpace[spaceId] = tab?.id || "";
    }
  } catch {
    // ignore
  }
  return {
    spaces,
    activeSpaceId: ws.activeWorkspace || "",
    tabs,
    folders,
    lastSelectedBySpace,
  };
}

/**
 * Apply a repair plan using canonical Zen APIs. Idempotent.
 * @returns {{ repaired: boolean, counts: object }}
 */
export async function applySpaceRepairPlan(win, plan, { spacePinsApi = null } = {}) {
  const counts = {
    orphanTabs: 0,
    spacesCreated: 0,
    foldersDetached: 0,
    pinsCleaned: 0,
    activeFixed: 0,
  };
  if (!plan?.needsRepair || !Array.isArray(plan.actions) || !win?.gZenWorkspaces) {
    return { repaired: false, counts };
  }
  const ws = win.gZenWorkspaces;
  if (ws.privateWindowOrDisabled) {
    return { repaired: false, counts };
  }

  let recoveredSpaceId = RECOVERED_TABS_SPACE_UUID;

  for (const action of plan.actions) {
    try {
      switch (action.type) {
        case "ensure-default-space": {
          if (!(ws.getWorkspaces?.() || []).length) {
            await ws.createAndSaveWorkspace("General", "🇮🇳", false, 0);
            counts.spacesCreated += 1;
          }
          break;
        }
        case "set-active-space": {
          let targetId = action.spaceId;
          if ((!targetId || !ws.getWorkspaceFromId?.(targetId)) && action.createDefaultIfMissing) {
            const created = await ws.createAndSaveWorkspace(
              "General",
              "🇮🇳",
              false,
              0
            );
            targetId = created?.uuid || ws.activeWorkspace;
            counts.spacesCreated += 1;
          }
          if (targetId && ws.activeWorkspace !== targetId) {
            await ws.changeWorkspaceWithID(targetId, { alwaysChange: true });
            counts.activeFixed += 1;
          }
          break;
        }
        case "ensure-recovered-tabs-space": {
          recoveredSpaceId = action.spaceId || RECOVERED_TABS_SPACE_UUID;
          if (action.create && typeof ws.ensureAstraRecoveredTabsSpace === "function") {
            const created = await ws.ensureAstraRecoveredTabsSpace({
              avoidUuid: action.avoidUuid || null,
              preferUuid: action.collided ? null : recoveredSpaceId,
            });
            if (created?.uuid) {
              recoveredSpaceId = created.uuid;
              counts.spacesCreated += 1;
            }
          } else if (action.create) {
            const identity = resolveRecoveredSpaceIdentity(
              ws.getWorkspaces?.() || []
            );
            if (!identity.create && identity.spaceId) {
              recoveredSpaceId = identity.spaceId;
            }
          }
          break;
        }
        case "assign-orphan-tabs": {
          const target =
            ws.getWorkspaceFromId?.(action.spaceId) ||
            ws.getWorkspaceFromId?.(recoveredSpaceId);
          const targetId = target?.uuid || recoveredSpaceId;
          const validIds = new Set(
            (ws.getWorkspaces?.() || []).map(s => s.uuid)
          );
          const orphans = (ws.allStoredTabs || []).filter(tab => {
            const snap = {
              id: tab?.id || "",
              workspaceId: tab?.getAttribute?.("zen-workspace-id") || "",
              essential: !!tab?.hasAttribute?.("zen-essential"),
              empty: !!tab?.hasAttribute?.("zen-empty-tab"),
              alive: !!tab?.linkedBrowser && !!tab?.isConnected,
              closing:
                !!tab?.closing || !!(win.gBrowser?._removingTabs?.has?.(tab)),
              pending: !!tab?.hasAttribute?.("pending"),
              pinned: !!tab?.pinned,
              hasGroup: !!tab?.group,
              splitView: !!tab?.group?.hasAttribute?.("split-view-group"),
              restoring:
                !!tab?.hasAttribute?.("pending") && !tab?.linkedBrowser,
            };
            return (
              classifyTabForIntegrity(snap, validIds).kind === "orphan-live"
            );
          });
          if (orphans.length && typeof ws.moveTabsToWorkspace === "function") {
            ws.moveTabsToWorkspace(orphans, targetId, { trackUndo: false });
            counts.orphanTabs += orphans.length;
          }
          break;
        }
        case "detach-invalid-folder": {
          if (
            action.folderId &&
            typeof win.gZenFolders?.changeFolderToSpace === "function"
          ) {
            const folder =
              win.document?.getElementById?.(action.folderId) ||
              (win.gBrowser?.tabGroups || []).find(
                g => g.id === action.folderId
              );
            const targetId =
              action.targetSpaceId ||
              ws.activeWorkspace ||
              recoveredSpaceId;
            if (folder && ws.getWorkspaceFromId?.(targetId)) {
              win.gZenFolders.changeFolderToSpace(folder, targetId);
              counts.foldersDetached += 1;
            }
          }
          break;
        }
        case "clear-last-selected": {
          if (action.spaceId && ws.lastSelectedWorkspaceTabs) {
            delete ws.lastSelectedWorkspaceTabs[action.spaceId];
          }
          break;
        }
        case "remove-space-pins": {
          if (spacePinsApi?.removeSpacePins && action.spaceId) {
            await spacePinsApi.removeSpacePins(action.spaceId);
            counts.pinsCleaned += 1;
          }
          break;
        }
        case "remove-app-pin": {
          if (spacePinsApi?.unpinApp && action.spaceId && action.appId) {
            await spacePinsApi.unpinApp(action.spaceId, action.appId);
            counts.pinsCleaned += 1;
          }
          break;
        }
        case "drop-duplicate-space-entries": {
          // Cache is already unique after snapshot; no-op at apply time.
          break;
        }
        default:
          break;
      }
    } catch (error) {
      console.warn("[AstraSpaceIntegrity] repair action failed:", action.type);
    }
  }

  const repaired =
    counts.orphanTabs +
      counts.spacesCreated +
      counts.foldersDetached +
      counts.pinsCleaned +
      counts.activeFixed >
    0;
  return { repaired, counts };
}

/**
 * Run validate + repair once for a window. Generation-guarded by caller.
 */
export async function runSpaceIntegrityPass(win, options = {}) {
  const ready = isSpaceIntegrityReady({
    spacesInitialized: !!win?.gZenWorkspaces?.workspaceEnabled,
    sessionRestoreComplete: !!options.sessionRestoreComplete,
    workspaceCacheReady: Array.isArray(win?.gZenWorkspaces?.getWorkspaces?.()),
    windowClosing: !!win?.closed || !!win?.gZenWorkspaces?._isClosingWindow,
  });
  if (!ready && options.requireReady !== false) {
    return {
      valid: true,
      repaired: false,
      deferred: true,
      counts: {},
      reason: "not-ready",
    };
  }
  const snap = snapshotWindowSpaceState(win);
  if (!snap) {
    return { valid: true, repaired: false, counts: {} };
  }
  let spacePins = {};
  try {
    if (typeof options.loadSpacePins === "function") {
      spacePins = (await options.loadSpacePins()) || {};
    }
  } catch {
    spacePins = {};
  }
  const result = validateSpaceState({
    ...snap,
    spacePins,
    knownAppIds: options.knownAppIds || null,
  });
  if (result.notReadyTabs?.length) {
    return { ...result, repaired: false, deferred: true };
  }
  if (result.valid) {
    return { ...result, repaired: false, counts: {} };
  }
  // Re-validate against latest snapshot before apply (stale plan guard).
  const latest = snapshotWindowSpaceState(win);
  const latestResult = latest
    ? validateSpaceState({
        ...latest,
        spacePins,
        knownAppIds: options.knownAppIds || null,
      })
    : result;
  if (latestResult.valid || latestResult.notReadyTabs?.length) {
    return {
      ...latestResult,
      repaired: false,
      counts: {},
      deferred: !!latestResult.notReadyTabs?.length,
    };
  }
  const applied = await applySpaceRepairPlan(win, latestResult.repairPlan, {
    spacePinsApi: options.spacePinsApi || null,
  });
  return { ...latestResult, ...applied };
}
