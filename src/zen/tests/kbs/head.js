/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { ZenKeyboardShortcuts } = ChromeUtils.importESModule(
  "resource:///modules/zen/kbs/ZenKeyboardShortcuts.sys.mjs"
);
const { CustomKeys } = ChromeUtils.importESModule(
  "moz-src:///browser/components/customkeys/CustomKeys.sys.mjs"
);
const { ShortcutUtils } = ChromeUtils.importESModule(
  "resource://gre/modules/ShortcutUtils.sys.mjs"
);

const isMac = AppConstants.platform == "macosx";
const isLinux = AppConstants.platform == "linux";

const UNUSED_KEY = isLinux ? "Q" : "Y";
const UNUSED_MODIFIERS = "accel,shift";
const UNUSED_OPTIONS = { accelKey: true, shiftKey: true };

const LEGACY_VERSION_PREF = "zen.keyboard.shortcuts.version";

function isUnassigned(keyEl) {
  return !keyEl.hasAttribute("key") && !keyEl.hasAttribute("keycode");
}
