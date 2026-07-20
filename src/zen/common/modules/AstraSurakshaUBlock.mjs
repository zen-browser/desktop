/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * uBlock Origin status via AddonManager only.
 * No extension messaging, storage, or moz-extension paths.
 */

const UBLOCK_ID = "uBlock0@raymondhill.net";

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  AddonManager: "resource://gre/modules/AddonManager.sys.mjs",
});

export async function readUBlock(win) {
  try {
    const addon = await lazy.AddonManager.getAddonByID(UBLOCK_ID);
    if (!addon) {
      return {
        available: true,
        state: "missing",
        labelId: "astra-suraksha-ublock-missing",
        detailId: null,
        version: null,
        actions: [
          { id: "addons", labelId: "astra-suraksha-action-addons" },
        ],
      };
    }

    const locked = isPolicyLocked(addon);
    let state = "active";
    let labelId = "astra-suraksha-ublock-active";
    if (addon.appDisabled) {
      state = "app-disabled";
      labelId = "astra-suraksha-ublock-app-disabled";
    } else if (addon.userDisabled || !addon.isActive) {
      state = "disabled";
      labelId = "astra-suraksha-ublock-disabled";
    }

    const details = [];
    if (addon.version) {
      details.push({ id: "astra-suraksha-ublock-version", version: addon.version });
    }
    if (locked) {
      details.push({ id: "astra-suraksha-ublock-locked" });
    }
    if (addon.pendingOperations) {
      details.push({ id: "astra-suraksha-ublock-pending" });
    }
    let privateAccess = "unknown";
    if (addon.incognito === "spanning") {
      details.push({ id: "astra-suraksha-ublock-pb-spanning" });
      privateAccess = "spanning";
    } else if (addon.incognito === "not_allowed") {
      details.push({ id: "astra-suraksha-ublock-pb-not-allowed" });
      privateAccess = "not_allowed";
    }

    // Private windows: do not claim Active when private browsing is not allowed.
    try {
      if (
        state === "active" &&
        privateAccess === "not_allowed" &&
        typeof PrivateBrowsingUtils !== "undefined" &&
        PrivateBrowsingUtils.isWindowPrivate(win)
      ) {
        state = "disabled";
        labelId = "astra-suraksha-ublock-disabled";
      }
    } catch {
      // ignore
    }

    const actions = [];
    if (state === "active") {
      actions.push({
        id: "ublock-popup",
        labelId: "astra-suraksha-action-ublock-popup",
      });
    }
    actions.push({
      id: "ublock-manage",
      labelId: "astra-suraksha-action-ublock-manage",
    });
    actions.push({ id: "addons", labelId: "astra-suraksha-action-addons" });

    return {
      available: true,
      state,
      labelId,
      detailId: null,
      version: addon.version || null,
      details,
      locked,
      privateAccess,
      actions,
    };
  } catch {
    return {
      available: false,
      state: "error",
      labelId: "astra-suraksha-error",
      detailId: null,
      version: null,
      actions: [],
    };
  }
}

function isPolicyLocked(addon) {
  try {
    const locked = Services.policies?.getExtensionSettings?.(UBLOCK_ID);
    if (locked && locked.installation_mode === "force_installed") {
      return true;
    }
  } catch {
    // ignore
  }
  try {
    const perms = addon.permissions;
    const canDisable = !!(
      perms & lazy.AddonManager.PERM_CAN_DISABLE
    );
    if (!canDisable && !addon.userDisabled) {
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

export function openUBlockBrowserAction(win) {
  try {
    const policy = win.WebExtensionPolicy?.getByID?.(UBLOCK_ID);
    const action = win.gUnifiedExtensions?.browserActionFor?.(policy);
    if (action && typeof action.triggerAction === "function") {
      action.triggerAction(win);
    }
  } catch {
    // ignore
  }
}

export async function manageUBlock(win) {
  try {
    if (win.BrowserAddonUI?.manageAddon) {
      await win.BrowserAddonUI.manageAddon(UBLOCK_ID);
      return;
    }
    win.BrowserAddonUI?.openAddonsMgr?.(
      "addons://detail/" + encodeURIComponent(UBLOCK_ID)
    );
  } catch {
    // ignore
  }
}

export function openAddonsManager(win) {
  try {
    win.BrowserAddonUI?.openAddonsMgr?.("addons://list/extension");
  } catch {
    // ignore
  }
}
