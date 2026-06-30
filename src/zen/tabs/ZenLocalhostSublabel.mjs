// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { nsZenDOMOperatedFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";

const lazy = {};

const PREF_SHOW_LOCALHOST_URL = "zen.tabs.show-localhost-url";

// eslint-disable-next-line mozilla/valid-lazy
XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "showLocalhostUrl",
  PREF_SHOW_LOCALHOST_URL,
  true
);

// Property stamped on tabs whose sublabel we own. We only ever clear a sublabel
// that we set, so we never stomp on the ones managed by pinned tabs or live
// folders.
const OWNED_SUBLABEL = "_zenLocalhostUrl";

/**
 * Shows the host (and port) of local development servers as a small sublabel
 * underneath the tab title, in the style of Arc/Dia. This reuses Zen's existing
 * `.zen-tab-sublabel` element and the `zen-show-sublabel` attribute, so it needs
 * no extra markup or styles of its own.
 */
class nsZenLocalhostSublabel extends nsZenDOMOperatedFeature {
  init() {
    Services.prefs.addObserver(PREF_SHOW_LOCALHOST_URL, this);

    gBrowser.addTabsProgressListener(this);
    gBrowser.tabContainer.addEventListener("TabOpen", event =>
      this._update(event.target)
    );
    // Session restore can attach the URL after the tab has already opened.
    window.addEventListener(
      "SSTabRestored",
      event => this._update(event.target),
      true
    );

    window.addEventListener(
      "unload",
      () => Services.prefs.removeObserver(PREF_SHOW_LOCALHOST_URL, this),
      { once: true }
    );

    this._updateAll();
  }

  // nsIObserver: react live when the preference is toggled.
  observe() {
    this._updateAll();
  }

  // nsIWebProgressListener, registered via addTabsProgressListener.
  onLocationChange(aBrowser) {
    const tab = gBrowser.getTabForBrowser(aBrowser);
    if (tab) {
      this._update(tab);
    }
  }

  _updateAll() {
    for (const tab of gBrowser.tabs) {
      this._update(tab);
    }
  }

  _update(tab) {
    if (!tab || !tab.linkedBrowser) {
      return;
    }
    // Leave tabs whose sublabel is driven by another feature untouched.
    if (tab.pinned || tab.hasAttribute("zen-live-folder-item-id")) {
      this._clearSublabel(tab);
      return;
    }
    const label = lazy.showLocalhostUrl ? this._labelForTab(tab) : "";
    if (label) {
      this._setSublabel(tab, label);
    } else {
      this._clearSublabel(tab);
    }
  }

  _setSublabel(tab, text) {
    const sublabel = tab.querySelector(".zen-tab-sublabel");
    if (!sublabel) {
      return;
    }
    tab[OWNED_SUBLABEL] = text;
    tab.setAttribute("zen-show-sublabel", text);
    // The `zen-tab-sublabel` Fluent message renders any value that is not a
    // known key (e.g. "zen-default-pinned") verbatim, so the host is shown
    // as-is without needing a dedicated string.
    document.l10n.setArgs(sublabel, { tabSubtitle: text });
  }

  _clearSublabel(tab) {
    if (!tab[OWNED_SUBLABEL]) {
      return;
    }
    delete tab[OWNED_SUBLABEL];
    tab.removeAttribute("zen-show-sublabel");
    const sublabel = tab.querySelector(".zen-tab-sublabel");
    if (sublabel) {
      document.l10n.setArgs(sublabel, { tabSubtitle: "zen-default-pinned" });
    }
  }

  /**
   * Returns the `host:port` to display for a tab pointing at a local or LAN
   * address, or an empty string for anything else.
   */
  _labelForTab(tab) {
    const uri = tab.linkedBrowser.currentURI;
    if (!uri || !/^https?$/.test(uri.scheme)) {
      return "";
    }
    let host;
    try {
      host = uri.host;
    } catch (e) {
      return "";
    }
    // `hostPort` omits the port for the default 80/443 and brackets IPv6.
    return this._isLocalHost(host) ? uri.hostPort : "";
  }

  _isLocalHost(host) {
    if (!host) {
      return false;
    }
    // Strip brackets from IPv6 literals (e.g. "[::1]" -> "::1").
    const bare = host.replace(/^\[|\]$/g, "").toLowerCase();

    // Hostnames reserved for local use.
    if (
      bare === "localhost" ||
      bare.endsWith(".localhost") ||
      bare.endsWith(".local")
    ) {
      return true;
    }

    // IPv4 loopback, private (RFC 1918) and link-local ranges.
    const ipv4 = bare.match(/^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
    if (ipv4) {
      const a = Number(ipv4[1]);
      const b = Number(ipv4[2]);
      return (
        a === 127 || // 127.0.0.0/8 loopback
        a === 10 || // 10.0.0.0/8
        (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
        (a === 192 && b === 168) || // 192.168.0.0/16
        (a === 169 && b === 254) // 169.254.0.0/16 link-local
      );
    }

    // IPv6 loopback, unique-local (fc00::/7) and link-local (fe80::/10).
    if (bare.includes(":")) {
      return (
        bare === "::1" ||
        bare.startsWith("fc") ||
        bare.startsWith("fd") ||
        bare.startsWith("fe8") ||
        bare.startsWith("fe9") ||
        bare.startsWith("fea") ||
        bare.startsWith("feb")
      );
    }

    return false;
  }
}

window.gZenLocalhostSublabel = new nsZenLocalhostSublabel();
