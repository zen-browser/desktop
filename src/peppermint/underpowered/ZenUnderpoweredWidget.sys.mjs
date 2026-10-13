/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  ZenUnderpowered: "moz-src:///peppermint/underpowered/ZenUnderpowered.sys.mjs",
});

const PREF_ENABLED = "zen.underpowered.enabled";
const UNDERPOWERED_ICON = "chrome://browser/skin/zen-icons/battery-low.svg";

export const ZenUnderpoweredWidget = {
  id: "zen-underpowered-button",
  l10nId: "zen-underpowered-button",
  overflows: false,

  onCreated(node) {
    node.classList.add("zen-sidebar-action-button");
    node.setAttribute("image", UNDERPOWERED_ICON);
    lazy.ZenUnderpowered.syncButton(node);
  },

  onCommand() {
    // The pref is the only state; every window's button follows it.
    Services.prefs.setBoolPref(
      PREF_ENABLED,
      !Services.prefs.getBoolPref(PREF_ENABLED, false)
    );
  },
};
