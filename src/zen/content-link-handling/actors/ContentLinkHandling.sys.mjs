// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { AppConstants } from "resource://gre/modules/AppConstants.sys.mjs";

export const ContentLinkHandling = {
  modifiers: ["ctrl", "alt", "shift", "meta"],
  actions: [
    { id: "glance", pref: "zen.content-link-handling.glance-activation-method", default: "none" },
    {
      id: "split",
      pref: "zen.content-link-handling.split-activation-method",
      default: "none",
    },
    {
      id: "tab",
      pref: "zen.content-link-handling.tab-activation-method",
      default: AppConstants.platform === "macosx" ? "meta" : "ctrl",
    },
    {
      id: "window",
      pref: "zen.content-link-handling.window-activation-method",
      default: "shift",
    },
  ],

  shortcut(event) {
    return (
      this.modifiers.filter((key) => event[`${key}Key`]).join("+") || "none"
    );
  },

  assignments() {
    return this.actions.map((action) => ({
      ...action,
      shortcut: Services.prefs.getStringPref(action.pref, action.default),
    }));
  },

  resolve(shortcut) {
    if (shortcut === "none") {
      return null;
    }
    const matches = this.assignments().filter(
      (action) => action.shortcut === shortcut,
    );
    // Conflicting preferences can arrive through sync or about:config. Never
    // silently choose an action; Settings exposes these conflicts for repair.
    return matches.length > 1 ? "conflict" : (matches[0]?.id ?? null);
  },
};
