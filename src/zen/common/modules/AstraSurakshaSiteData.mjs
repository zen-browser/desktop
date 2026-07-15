/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Site-data presence via SiteDataManager.hasSiteData (async, non-blocking).
 */

export function getSiteDataContext(win) {
  try {
    const { PrivateBrowsingUtils } = ChromeUtils.importESModule(
      "resource://gre/modules/PrivateBrowsingUtils.sys.mjs"
    );
    if (PrivateBrowsingUtils.isWindowPrivate(win)) {
      return {
        available: true,
        state: "private",
        asciiHost: null,
        canClear: false,
      };
    }
    const uri = win.gBrowser?.currentURI;
    const handler = win.gIdentityHandler;
    if (!uri?.asciiHost || handler?._pageExtensionPolicy) {
      return {
        available: true,
        state: "na",
        asciiHost: null,
        canClear: false,
      };
    }
    if (!handler?._uriHasHost) {
      return {
        available: true,
        state: "na",
        asciiHost: null,
        canClear: false,
      };
    }
    return {
      available: true,
      state: "pending",
      asciiHost: uri.asciiHost,
      canClear: true,
    };
  } catch {
    return {
      available: false,
      state: "error",
      asciiHost: null,
      canClear: false,
    };
  }
}

export async function readSiteData(win, expectedHost) {
  try {
    if (!expectedHost) {
      return {
        available: true,
        state: "na",
        labelId: "astra-suraksha-not-applicable",
        detailId: null,
        actions: [],
      };
    }

    // Re-verify active host has not changed.
    const current = win.gBrowser?.currentURI?.asciiHost;
    if (current !== expectedHost) {
      return { stale: true };
    }

    const { SiteDataManager } = ChromeUtils.importESModule(
      "resource:///modules/SiteDataManager.sys.mjs"
    );
    const hasData = await SiteDataManager.hasSiteData(expectedHost);

    if (win.gBrowser?.currentURI?.asciiHost !== expectedHost) {
      return { stale: true };
    }

    const canClear = getSiteDataContext(win).canClear && hasData;
    return {
      available: true,
      state: hasData ? "present" : "absent",
      labelId: hasData
        ? "astra-suraksha-site-data-present"
        : "astra-suraksha-site-data-absent",
      detailId: null,
      actions: canClear
        ? [{ id: "clear-site-data", labelId: "astra-suraksha-site-data-clear" }]
        : [],
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

export function clearSiteData(win, event) {
  try {
    const handler = win.gIdentityHandler;
    if (!handler || typeof handler.clearSiteData !== "function") {
      return false;
    }
    // Verify still a clearable host.
    const ctx = getSiteDataContext(win);
    if (!ctx.canClear) {
      return false;
    }
    void handler.clearSiteData(event);
    return true;
  } catch {
    return false;
  }
}
