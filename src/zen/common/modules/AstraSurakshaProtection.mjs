/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Firefox Enhanced Tracking Protection status (read-only).
 */

const PREF_CATEGORY = "browser.contentblocking.category";

export function readProtection(win) {
  try {
    const handler = win?.gProtectionsHandler;
    if (!handler) {
      return {
        available: false,
        state: "unavailable",
        labelId: "astra-suraksha-unavailable",
        detailId: null,
        modeId: null,
        actions: [],
      };
    }

    let canHandle = true;
    try {
      const {
        ContentBlockingAllowList,
      } = ChromeUtils.importESModule(
        "resource://gre/modules/ContentBlockingAllowList.sys.mjs"
      );
      canHandle = ContentBlockingAllowList.canHandle(
        win.gBrowser.selectedBrowser
      );
    } catch {
      canHandle = true;
    }

    if (!canHandle) {
      return {
        available: true,
        state: "na",
        labelId: "astra-suraksha-not-applicable",
        detailId: null,
        modeId: null,
        actions: [
          { id: "etp-dashboard", labelId: "astra-suraksha-action-etp-dashboard" },
        ],
      };
    }

    let category = "standard";
    try {
      category = Services.prefs.getStringPref(PREF_CATEGORY, "standard");
    } catch {
      category = "standard";
    }
    const modeId =
      category === "strict"
        ? "astra-suraksha-etp-mode-strict"
        : category === "custom"
          ? "astra-suraksha-etp-mode-custom"
          : "astra-suraksha-etp-mode-standard";

    const hasException = !!handler.hasException;
    return {
      available: true,
      state: hasException ? "exception" : "active",
      labelId: hasException
        ? "astra-suraksha-etp-exception"
        : "astra-suraksha-etp-active",
      detailId: "astra-suraksha-etp-detail-mode",
      modeId,
      actions: [
        { id: "etp-panel", labelId: "astra-suraksha-action-etp-panel" },
        { id: "etp-dashboard", labelId: "astra-suraksha-action-etp-dashboard" },
      ],
    };
  } catch {
    return {
      available: false,
      state: "error",
      labelId: "astra-suraksha-error",
      detailId: null,
      modeId: null,
      actions: [],
    };
  }
}

export function openProtectionPanel(win, event) {
  const handler = win?.gProtectionsHandler;
  if (!handler || typeof handler.showProtectionsPopup !== "function") {
    openProtectionDashboard(win);
    return;
  }
  try {
    handler.showProtectionsPopup({
      event,
      openingReason: "astraSuraksha",
    });
    if (handler.trustPanelEnabledPref) {
      openProtectionDashboard(win);
    }
  } catch {
    openProtectionDashboard(win);
  }
}

export function openProtectionDashboard(win) {
  try {
    const handler = win?.gProtectionsHandler;
    if (handler && typeof handler.openProtections === "function") {
      handler.openProtections(true);
      return;
    }
    if (typeof win.switchToTabHavingURI === "function") {
      win.switchToTabHavingURI("about:protections", true, {
        replaceQueryString: true,
        relatedToCurrent: true,
        triggeringPrincipal:
          Services.scriptSecurityManager.getSystemPrincipal(),
      });
    }
  } catch {
    // ignore
  }
}
