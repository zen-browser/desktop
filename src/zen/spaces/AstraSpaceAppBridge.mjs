/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Lazy App Hub ↔ Spaces bridge.
 * Does not import App Hub at module scope for consumers that only need pins.
 */

import { openURLInSpace } from "resource:///modules/zen/AstraSpaceRouting.mjs";
import {
  gAstraSpaceAppState,
  PRESET_PIN_SUGGESTIONS,
} from "resource:///modules/zen/AstraSpaceAppState.mjs";

function isPrivate(win) {
  try {
    return (
      typeof PrivateBrowsingUtils !== "undefined" &&
      PrivateBrowsingUtils.isWindowPrivate(win)
    );
  } catch {
    return false;
  }
}

/**
 * Route an App Hub launch into a Space; returns actual tab for favicon capture.
 */
export async function launchAppInSpace(win, { url, targetSpaceId = null, inBackground = false, customAppId = null } = {}) {
  return openURLInSpace(win, {
    url,
    targetSpaceId,
    inBackground,
    source: "app-hub",
    customAppId,
  });
}

export async function getPinsForCurrentSpace(win) {
  const ws = win?.gZenWorkspaces;
  const spaceId = ws?.activeWorkspace;
  if (!spaceId) {
    return [];
  }
  try {
    await gAstraSpaceAppState.load();
    return gAstraSpaceAppState.getPinsForSpace(spaceId);
  } catch {
    return [];
  }
}

export async function pinAppToCurrentSpace(win, appId) {
  if (isPrivate(win)) {
    return { ok: false, reason: "private" };
  }
  const spaceId = win?.gZenWorkspaces?.activeWorkspace;
  if (!spaceId || typeof appId !== "string") {
    return { ok: false, reason: "invalid" };
  }
  await gAstraSpaceAppState.pinApp(spaceId, appId, { privateWindow: false });
  return { ok: true, spaceId };
}

export async function unpinAppFromCurrentSpace(win, appId) {
  if (isPrivate(win)) {
    return { ok: false, reason: "private" };
  }
  const spaceId = win?.gZenWorkspaces?.activeWorkspace;
  if (!spaceId || typeof appId !== "string") {
    return { ok: false, reason: "invalid" };
  }
  await gAstraSpaceAppState.unpinApp(spaceId, appId, { privateWindow: false });
  return { ok: true, spaceId };
}

export async function onSpaceDeleted(spaceId) {
  if (!spaceId) {
    return;
  }
  try {
    await gAstraSpaceAppState.removeSpacePins(spaceId, { privateWindow: false });
  } catch {
    // ignore
  }
}

export async function onCustomAppDeleted(appId) {
  if (!appId) {
    return;
  }
  const ref = appId.startsWith("custom-") ? `custom:${appId}` : appId;
  try {
    await gAstraSpaceAppState.removeAppFromAllSpaces(appId, {
      privateWindow: false,
    });
    if (ref !== appId) {
      await gAstraSpaceAppState.removeAppFromAllSpaces(ref, {
        privateWindow: false,
      });
    }
  } catch {
    // ignore
  }
}

export function getPresetPinSuggestions(presetId) {
  return [...(PRESET_PIN_SUGGESTIONS[presetId] || [])];
}

/**
 * After preset Space creation — optional pin suggestion ids (caller confirms).
 */
export function suggestPinsForPreset(presetId) {
  return getPresetPinSuggestions(presetId);
}
