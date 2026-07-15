// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

// prettier-ignore
// eslint-disable-next-line no-lone-blocks
{
  Services.scriptloader.loadSubScript("chrome://browser/content/zen-components/ZenSpaceBookmarksStorage.js", this);

  ChromeUtils.importESModule("chrome://browser/content/ZenStartup.mjs", { global: "current" });
  ChromeUtils.importESModule("resource:///modules/zen/ZenSpaceManager.mjs", { global: "current" });
  ChromeUtils.importESModule("chrome://browser/content/zen-components/ZenCompactMode.mjs", { global: "current" });
  ChromeUtils.importESModule("chrome://browser/content/ZenUIManager.mjs", { global: "current" });
  ChromeUtils.importESModule("chrome://browser/content/zen-components/ZenMods.mjs", { global: "current" });
  ChromeUtils.importESModule("chrome://browser/content/zen-components/AstraTransparencyManager.mjs", { global: "current" });
  // App Hub: stable bootstrap only at startup. Advanced manager lazy-loads on
  // first open so catalog/profile IO does not compete with first navigation.
  ChromeUtils.importESModule("chrome://browser/content/zen-components/AstraAppHubBootstrap.mjs", { global: "current" });
  // Suraksha: bootstrap only — manager/adapters lazy-load on first open.
  try {
    ChromeUtils.importESModule("chrome://browser/content/zen-components/AstraSurakshaBootstrap.mjs", { global: "current" });
  } catch (error) {
    console.error("[AstraSuraksha] bootstrap failed to initialize", error);
  }
  ChromeUtils.importESModule("chrome://browser/content/zen-components/ZenKeyboardShortcuts.mjs", { global: "current" });
  ChromeUtils.importESModule("chrome://browser/content/zen-components/ZenSessionStore.mjs", { global: "current" });

  Services.scriptloader.loadSubScript("chrome://browser/content/zen-components/ZenDragAndDrop.js", this);
}
