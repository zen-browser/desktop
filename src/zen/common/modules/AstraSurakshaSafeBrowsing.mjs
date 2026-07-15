/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Suraksha Safe Browsing status — prefs only, no network, no URL logging.
 */

function prefBool(name, fallback = false) {
  try {
    return Services.prefs.getBoolPref(name, fallback);
  } catch {
    return fallback;
  }
}

export function readSafeBrowsing(_win) {
  try {
    const phishing = prefBool("browser.safebrowsing.phishing.enabled", true);
    const malware = prefBool("browser.safebrowsing.malware.enabled", true);
    const downloads = prefBool("browser.safebrowsing.downloads.enabled", true);
    const downloadsRemote = prefBool(
      "browser.safebrowsing.downloads.remote.enabled",
      true
    );

    const allOn = phishing && malware && downloads;
    const anyOn = phishing || malware || downloads;

    let labelId = "astra-suraksha-safebrowsing-partial";
    let state = "warn";
    if (allOn && downloadsRemote) {
      labelId = "astra-suraksha-safebrowsing-enabled";
      state = "ok";
    } else if (!anyOn) {
      labelId = "astra-suraksha-safebrowsing-disabled";
      state = "error";
    }

    const details = [];
    details.push({
      id: phishing
        ? "astra-suraksha-safebrowsing-phishing-on"
        : "astra-suraksha-safebrowsing-phishing-off",
    });
    details.push({
      id: malware
        ? "astra-suraksha-safebrowsing-malware-on"
        : "astra-suraksha-safebrowsing-malware-off",
    });
    details.push({
      id: downloads
        ? "astra-suraksha-safebrowsing-downloads-on"
        : "astra-suraksha-safebrowsing-downloads-off",
    });
    if (downloads && !downloadsRemote) {
      details.push({ id: "astra-suraksha-safebrowsing-remote-off" });
    }
    details.push({ id: "astra-suraksha-safebrowsing-freshness-unknown" });

    return {
      available: true,
      state,
      labelId,
      details,
      actions: [
        {
          id: "safebrowsing-settings",
          labelId: "astra-suraksha-action-safebrowsing-settings",
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

export function openSafeBrowsingSettings(win) {
  const target = win || window;
  try {
    target.openPreferences?.("privacy-security", { origin: "astra-suraksha" });
  } catch {
    try {
      target.openTrustedLinkIn?.("about:preferences#privacy", "tab");
    } catch (error) {
      console.error("[AstraSuraksha] Safe Browsing settings open failed", error);
    }
  }
}
