// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

// prettier-ignore

{
  ChromeUtils.importESModule("chrome://browser/content/ZenStartup.mjs", { global: "current" });
  ChromeUtils.importESModule("chrome://browser/content/zen-components/ZenCompactMode.mjs", { global: "current" });
  ChromeUtils.importESModule("chrome://browser/content/ZenUIManager.mjs", { global: "current" });
  ChromeUtils.importESModule("chrome://browser/content/zen-components/ZenMods.mjs", { global: "current" });
  ChromeUtils.importESModule("chrome://browser/content/zen-components/ZenKeyboardShortcuts.mjs", { global: "current" });
  ChromeUtils.importESModule("chrome://browser/content/zen-components/ZenSessionStore.mjs", { global: "current" });

  Services.scriptloader.loadSubScript("chrome://browser/content/zen-components/ZenDragAndDrop.js", this);
}
