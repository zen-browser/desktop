/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Suraksha password / breach-alert status — prefs only.
 * Never reads credentials, usernames, or domains.
 */

function prefBool(name, fallback = false) {
  try {
    return Services.prefs.getBoolPref(name, fallback);
  } catch {
    return fallback;
  }
}

export function readPasswords(win) {
  try {
    let isPrivate = false;
    try {
      const { PrivateBrowsingUtils } = ChromeUtils.importESModule(
        "resource://gre/modules/PrivateBrowsingUtils.sys.mjs"
      );
      isPrivate = PrivateBrowsingUtils.isWindowPrivate(win);
    } catch {
      isPrivate = false;
    }
    if (isPrivate) {
      return {
        available: true,
        state: "private",
        labelId: "astra-suraksha-passwords-private",
        details: [{ id: "astra-suraksha-passwords-private-detail" }],
        actions: [
          {
            id: "passwords-manager",
            labelId: "astra-suraksha-action-passwords-manager",
          },
        ],
      };
    }

    const remember = prefBool("signon.rememberSignons", true);
    const autofill = prefBool("signon.autofillForms", true);
    const breachAlerts = prefBool(
      "signon.management.page.breach-alerts.enabled",
      true
    );
    const vulnerableAlerts = prefBool(
      "signon.management.page.vulnerable-passwords.enabled",
      true
    );

    let labelId = "astra-suraksha-passwords-enabled";
    let state = "ok";
    if (!remember) {
      labelId = "astra-suraksha-passwords-disabled";
      state = "warn";
    } else if (!breachAlerts || !vulnerableAlerts) {
      labelId = "astra-suraksha-passwords-partial";
      state = "warn";
    }

    const details = [];
    details.push({
      id: remember
        ? "astra-suraksha-passwords-manager-on"
        : "astra-suraksha-passwords-manager-off",
    });
    if (remember) {
      details.push({
        id: autofill
          ? "astra-suraksha-passwords-autofill-on"
          : "astra-suraksha-passwords-autofill-off",
      });
      details.push({
        id: breachAlerts
          ? "astra-suraksha-passwords-breach-on"
          : "astra-suraksha-passwords-breach-off",
      });
      details.push({
        id: vulnerableAlerts
          ? "astra-suraksha-passwords-vulnerable-on"
          : "astra-suraksha-passwords-vulnerable-off",
      });
    }

    return {
      available: true,
      state,
      labelId,
      details,
      actions: [
        {
          id: "passwords-manager",
          labelId: "astra-suraksha-action-passwords-manager",
        },
        {
          id: "passwords-settings",
          labelId: "astra-suraksha-action-passwords-settings",
        },
      ],
    };
  } catch {
    return {
      available: false,
      state: "unavailable",
      labelId: "astra-suraksha-unavailable",
      details: [],
      actions: [],
    };
  }
}

export function openPasswordManager(win) {
  const target = win || window;
  try {
    target.openTrustedLinkIn?.("about:logins", "tab");
  } catch (error) {
    console.error("[AstraSuraksha] about:logins open failed", error);
  }
}

export function openPasswordSettings(win) {
  const target = win || window;
  try {
    target.openPreferences?.("privacy-logins", { origin: "astra-suraksha" });
  } catch {
    try {
      target.openTrustedLinkIn?.("about:preferences#privacy", "tab");
    } catch (error) {
      console.error("[AstraSuraksha] password settings open failed", error);
    }
  }
}
