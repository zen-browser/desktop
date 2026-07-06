/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["ChromeExtensionCompat"];

const { XPCOMUtils } = ChromeUtils.importESModule(
  "resource://gre/modules/XPCOMUtils.sys.mjs"
);

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  ExtensionParent: "resource://gre/modules/ExtensionParent.sys.mjs",
  ExtensionUtils: "resource://gre/modules/ExtensionUtils.sys.mjs",
  Services: "resource://gre/modules/Services.sys.mjs",
});

XPCOMUtils.defineLazyPreferenceGetter(
  lazy, "kCompatEnabled", "nixo.extensions.chrome-compat", true
);

const CHROME_API_COMPAT_MAP = {
  "identity.getRedirectURL": {
    status: "polyfill",
    impl: () => {
      const uuid = lazy.ExtensionUtils.getExtensionUUID();
      return "https://" + uuid + ".chromiumapp.org/";
    },
  },
  "identity.getProfileUserInfo": {
    status: "partial",
    impl: () => Promise.resolve({ email: "", id: "" }),
  },
  "identity.getAccounts": {
    status: "noop",
    impl: () => Promise.resolve([]),
  },
  "sidePanel.setOptions": {
    status: "polyfill",
    impl: (extId, opts) => {
      Cu.reportError("[Nixo] sidePanel.setOptions polyfill for " + extId);
    },
  },
  "sidePanel.getOptions": {
    status: "polyfill",
    impl: (extId) => ({ path: "", enabled: true }),
  },
  "offscreen.createDocument": {
    status: "polyfill",
    impl: (extId, opts) => Promise.resolve(null),
  },
  "offscreen.closeDocument": {
    status: "polyfill",
    impl: (extId) => {},
  },
  "offscreen.hasDocument": {
    status: "polyfill",
    impl: (extId) => false,
  },
  "loginState.getProfileType": { status: "noop", impl: () => "UNPROFILE" },
  "loginState.getSessionState": { status: "noop", impl: () => "UNKNOWN" },
  "gcm.register": { status: "noop", impl: () => Promise.reject(new Error("GCM not supported")) },
  "gcm.unregister": { status: "noop", impl: () => Promise.reject(new Error("GCM not supported")) },
  "gcm.send": { status: "noop", impl: () => Promise.reject(new Error("GCM not supported")) },
  "action.setBadgeText": { status: "passthrough", fx: "browserAction.setBadgeText" },
  "action.setBadgeBackgroundColor": { status: "passthrough", fx: "browserAction.setBadgeBackgroundColor" },
  "action.setIcon": { status: "passthrough", fx: "browserAction.setIcon" },
  "action.setTitle": { status: "passthrough", fx: "browserAction.setTitle" },
  "action.getTitle": { status: "passthrough", fx: "browserAction.getTitle" },
  "action.setPopup": { status: "passthrough", fx: "browserAction.setPopup" },
  "action.getPopup": { status: "passthrough", fx: "browserAction.getPopup" },
  "action.openPopup": { status: "passthrough", fx: "browserAction.openPopup" },
  "action.disable": { status: "passthrough", fx: "browserAction.disable" },
  "action.enable": { status: "passthrough", fx: "browserAction.enable" },
  "action.getBadgeText": { status: "passthrough", fx: "browserAction.getBadgeText" },
  "action.getBadgeBackgroundColor": { status: "passthrough", fx: "browserAction.getBadgeBackgroundColor" },
  "scripting.executeScript": { status: "passthrough", fx: "tabs.executeScript" },
  "scripting.insertCSS": { status: "passthrough", fx: "tabs.insertCSS" },
  "scripting.removeCSS": { status: "passthrough", fx: "tabs.removeCSS" },
};

var ChromeExtensionCompat = {
  init() {
    if (!lazy.kCompatEnabled) return;
    Cu.reportError("[Nixo] Chrome Extension Compat layer initialized with " +
      Object.keys(CHROME_API_COMPAT_MAP).length + " API mappings");
  },

  checkExtensionCompatibility(manifest) {
    const issues = [];
    const warnings = [];
    for (const api of (manifest.permissions || [])) {
      const compat = CHROME_API_COMPAT_MAP[api];
      if (compat?.status === "noop") warnings.push(api + " not supported");
      else if (compat?.status === "partial") warnings.push(api + " partial support");
      else if (!compat && api.startsWith("chrome.")) issues.push(api + " may not be supported");
    }
    return {
      compatible: issues.length === 0,
      issues,
      warnings,
      score: Math.max(0, 100 - issues.length * 20 - warnings.length * 5),
    };
  },

  getStatusSummary() {
    const entries = Object.values(CHROME_API_COMPAT_MAP);
    return {
      supported: entries.filter(e => e.status === "passthrough" || e.status === "polyfill").length,
      partial: entries.filter(e => e.status === "partial").length,
      unsupported: entries.filter(e => e.status === "noop").length,
      total: entries.length,
    };
  },
};
