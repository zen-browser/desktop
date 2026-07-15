/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Explicit site permissions via SitePermissions (read-only).
 */

const RELEVANT_IDS = new Set([
  "camera",
  "microphone",
  "geo",
  "desktop-notification",
  "popup",
  "autoplay-media",
  "persistent-storage",
  "local-network",
  "localhost",
]);

export function readPermissions(win) {
  try {
    let SitePermissions = win?.SitePermissions;
    if (!SitePermissions) {
      ({ SitePermissions } = ChromeUtils.importESModule(
        "resource:///modules/SitePermissions.sys.mjs"
      ));
    }
    const browser = win?.gBrowser?.selectedBrowser;
    if (!browser) {
      return {
        available: true,
        state: "na",
        labelId: "astra-suraksha-not-applicable",
        detailId: null,
        items: [],
        actions: [],
      };
    }

    let details = [];
    try {
      details = SitePermissions.getAllPermissionDetailsForBrowser(browser) || [];
    } catch {
      details = [];
    }

    const items = [];
    for (const perm of details) {
      const rawId = perm?.id;
      if (!rawId) {
        continue;
      }
      const baseId = String(rawId).split(SitePermissions.PERM_KEY_DELIMITER)[0];
      if (!RELEVANT_IDS.has(baseId)) {
        continue;
      }
      // Prefer explicit / non-default entries.
      if (perm.state == SitePermissions.PROMPT) {
        // Skip pure "ask" defaults unless temporary/session.
        if (
          perm.scope != SitePermissions.SCOPE_TEMPORARY &&
          perm.scope != SitePermissions.SCOPE_SESSION &&
          perm.scope != SitePermissions.SCOPE_REQUEST
        ) {
          continue;
        }
      }

      let stateLabelId = "astra-suraksha-perm-ask";
      if (perm.state == SitePermissions.ALLOW) {
        stateLabelId = "astra-suraksha-perm-allowed";
      } else if (
        perm.state == SitePermissions.BLOCK ||
        perm.state == SitePermissions.AUTOPLAY_BLOCKED_ALL
      ) {
        stateLabelId = "astra-suraksha-perm-blocked";
      }

      let name = baseId;
      try {
        name = SitePermissions.getPermissionLabel(rawId) || baseId;
      } catch {
        name = baseId;
      }

      const temporary =
        perm.scope == SitePermissions.SCOPE_TEMPORARY ||
        perm.scope == SitePermissions.SCOPE_SESSION ||
        perm.scope == SitePermissions.SCOPE_REQUEST;

      items.push({
        id: baseId,
        name,
        stateLabelId,
        temporary,
      });
    }

    return {
      available: true,
      state: items.length ? "has" : "empty",
      labelId: items.length
        ? null
        : "astra-suraksha-perm-empty",
      detailId: null,
      items,
      actions: [
        { id: "manage-permissions", labelId: "astra-suraksha-perm-manage" },
      ],
    };
  } catch {
    return {
      available: false,
      state: "error",
      labelId: "astra-suraksha-error",
      detailId: null,
      items: [],
      actions: [],
    };
  }
}

export function openPermissionManager(win) {
  try {
    win.BrowserCommands?.pageInfo?.(null, "permTab");
  } catch {
    // ignore
  }
}
