/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Native Copy Clean Link via nsIURLQueryStringStripper.
 * No custom strip lists.
 */

const PREF_STRIP_ON_SHARE = "privacy.query_stripping.strip_on_share.enabled";

function getStripper() {
  return Cc["@mozilla.org/url-query-string-stripper;1"].getService(
    Ci.nsIURLQueryStringStripper
  );
}

export function readCleanLink(win) {
  try {
    if (!Services.prefs.getBoolPref(PREF_STRIP_ON_SHARE, false)) {
      return {
        available: false,
        state: "hidden",
        labelId: "astra-suraksha-clean-link-unavailable",
        detailId: null,
        actions: [],
      };
    }

    const uri = win.gBrowser?.currentURI;
    if (!uri) {
      return {
        available: true,
        state: "na",
        labelId: "astra-suraksha-not-applicable",
        detailId: null,
        actions: [],
      };
    }
    const scheme = uri.scheme?.toLowerCase?.() || "";
    if (scheme !== "http" && scheme !== "https") {
      return {
        available: true,
        state: "na",
        labelId: "astra-suraksha-not-applicable",
        detailId: null,
        actions: [],
      };
    }

    let stripper;
    try {
      stripper = getStripper();
    } catch {
      return {
        available: false,
        state: "hidden",
        labelId: "astra-suraksha-clean-link-unavailable",
        detailId: null,
        actions: [],
      };
    }

    let canStrip = false;
    try {
      canStrip = !!stripper.canStripForShare(uri);
    } catch {
      return {
        available: false,
        state: "unavailable",
        labelId: "astra-suraksha-clean-link-unavailable",
        detailId: null,
        actions: [],
      };
    }

    if (!canStrip) {
      return {
        available: true,
        state: "none",
        labelId: "astra-suraksha-clean-link-none",
        detailId: null,
        actions: [],
      };
    }

    return {
      available: true,
      state: "ready",
      labelId: "astra-suraksha-clean-link-ready",
      detailId: null,
      actions: [
        { id: "copy-clean-link", labelId: "astra-suraksha-clean-link-copy" },
      ],
    };
  } catch {
    return {
      available: false,
      state: "error",
      labelId: "astra-suraksha-error",
      detailId: null,
      actions: [],
    };
  }
}

export function copyCleanLink(win) {
  try {
    if (!Services.prefs.getBoolPref(PREF_STRIP_ON_SHARE, false)) {
      return false;
    }
    const uri = win.gBrowser?.currentURI;
    if (!uri) {
      return false;
    }
    const scheme = uri.scheme?.toLowerCase?.() || "";
    if (scheme !== "http" && scheme !== "https") {
      return false;
    }

    const stripper = getStripper();
    if (!stripper.canStripForShare(uri)) {
      return false;
    }
    const stripped = stripper.stripForCopyOrShare(uri);
    if (!stripped) {
      return false;
    }
    const text = Services.io.createExposableURI(stripped)?.displaySpec;
    const original =
      Services.io.createExposableURI(uri)?.displaySpec || uri.displaySpec;
    if (!text || text === original) {
      return false;
    }
    Services.clipboardHelper.copyString(text);
    try {
      win.gZenUIManager?.showToast?.("astra-suraksha-clean-link-copied", {
        timeout: 2500,
      });
    } catch {
      // ignore toast failures
    }
    return true;
  } catch {
    return false;
  }
}
