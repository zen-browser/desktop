/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Connection status from gIdentityHandler.getConnectionSecurityInformation().
 * Does not claim website trustworthiness.
 */

export function readConnection(win) {
  try {
    const handler = win?.gIdentityHandler;
    if (!handler) {
      return {
        available: false,
        state: "unavailable",
        labelId: "astra-suraksha-unavailable",
        detailId: null,
        hostname: null,
        actions: [],
      };
    }

    let connection = "not-secure";
    try {
      if (typeof handler.getConnectionSecurityInformation === "function") {
        connection = handler.getConnectionSecurityInformation() || "not-secure";
      }
    } catch {
      connection = "not-secure";
    }

    // Optional nuance already used by Zen Site Data — guarded.
    let mixedOrBroken = false;
    try {
      mixedOrBroken = !!(
        handler._isBrokenConnection ||
        handler._isMixedActiveContentLoaded
      );
    } catch {
      mixedOrBroken = false;
    }

    let hostname = null;
    try {
      const uri = win.gBrowser?.currentURI;
      if (uri?.asciiHost) {
        hostname = uri.asciiHost;
      } else if (uri?.displayHost) {
        hostname = uri.displayHost;
      }
    } catch {
      hostname = null;
    }

    const pageproxystate = win.gURLBar?.getAttribute?.("pageproxystate");
    if (pageproxystate && pageproxystate !== "valid") {
      return {
        available: true,
        state: "none",
        labelId: "astra-suraksha-connection-none",
        detailId: null,
        hostname: null,
        actions: [],
      };
    }

    if (connection === "chrome") {
      return card("browser", "astra-suraksha-connection-browser", null, hostname);
    }
    if (connection === "extension") {
      return card(
        "extension",
        "astra-suraksha-connection-extension",
        null,
        hostname
      );
    }
    if (connection === "file" || connection === "associated") {
      return card("file", "astra-suraksha-connection-file", null, hostname);
    }
    if (connection === "cert-error-page") {
      return card(
        "cert-error",
        "astra-suraksha-connection-cert-error",
        null,
        hostname
      );
    }
    if (connection === "https-only-error-page") {
      return card(
        "https-only-error",
        "astra-suraksha-connection-https-only-error",
        null,
        hostname
      );
    }
    if (connection === "net-error-page") {
      return card(
        "net-error",
        "astra-suraksha-connection-net-error",
        null,
        hostname
      );
    }
    if (
      connection === "secure" ||
      connection === "secure-ev" ||
      connection === "secure-etsi" ||
      connection === "secure-cert-user-overridden"
    ) {
      if (mixedOrBroken) {
        return card(
          "broken",
          "astra-suraksha-connection-broken",
          "astra-suraksha-connection-broken-detail",
          hostname
        );
      }
      return card(
        "secure",
        "astra-suraksha-connection-secure",
        "astra-suraksha-connection-secure-detail",
        hostname
      );
    }
    if (mixedOrBroken) {
      return card(
        "broken",
        "astra-suraksha-connection-broken",
        "astra-suraksha-connection-broken-detail",
        hostname
      );
    }
    return card(
      "not-secure",
      "astra-suraksha-connection-not-secure",
      "astra-suraksha-connection-not-secure-detail",
      hostname
    );
  } catch {
    return {
      available: false,
      state: "error",
      labelId: "astra-suraksha-error",
      detailId: null,
      hostname: null,
      actions: [],
    };
  }
}

function card(state, labelId, detailId, hostname) {
  return {
    available: true,
    state,
    labelId,
    detailId,
    hostname,
    actions: [],
  };
}
