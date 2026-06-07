// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

// prettier-ignore
// eslint-disable-next-line no-lone-blocks
{
  ChromeUtils.defineESModuleGetters(this, {
    gZenSpaceRoutingManager:
      "resource:///modules/zen/spacerouting/ZenSpaceRoutingManager.sys.mjs",
  });

  Services.scriptloader.loadSubScript("chrome://browser/content/zen-components/ZenSpaceBookmarksStorage.js", this);

  let scripts = [
    "chrome://browser/content/ZenStartup.mjs",
    "resource:///modules/zen/ZenSpaceManager.mjs",
    "chrome://browser/content/zen-components/ZenCompactMode.mjs",
    "chrome://browser/content/ZenUIManager.mjs",
    "chrome://browser/content/zen-components/ZenMods.mjs",
    "chrome://browser/content/zen-components/ZenKeyboardShortcuts.mjs",
    "chrome://browser/content/zen-components/ZenSessionStore.mjs",
    "chrome://browser/content/zen-components/ZenMediaController.mjs",
    "chrome://browser/content/zen-components/ZenGlanceManager.mjs",
    "chrome://browser/content/zen-components/ZenPinnedTabManager.mjs",
    "chrome://browser/content/zen-components/ZenViewSplitter.mjs",
    "chrome://browser/content/zen-components/ZenFolders.mjs",
    "chrome://browser/content/zen-components/ZenEmojiPicker.mjs",
    "chrome://browser/content/zen-components/ZenLiveFoldersUI.mjs",
    "chrome://browser/content/zen-components/ZenDownloadAnimation.mjs",
  ];

  for (let script of scripts) {
    ChromeUtils.importESModule(script, { global: "current" });
  }

  let customZenElements = [
    ["zen-folder", "chrome://browser/content/zen-components/ZenFolder.mjs"],
    ["zen-workspace-creation", "resource:///modules/zen/ZenSpaceCreation.mjs"],
    ["zen-workspace", "resource:///modules/zen/ZenSpace.mjs"],
    ["zen-workspace-icons", "resource:///modules/zen/ZenSpaceIcons.mjs"]
  ];

  document.addEventListener(
    "DOMContentLoaded",
    () => {
      // Only sync-import widgets once the document has loaded. If a widget is
      // used before DOMContentLoaded it will be imported and upgraded when
      // registering the customElements.setElementCreationCallback().
      for (let [tag, script] of customZenElements) {
        customElements.setElementCreationCallback(
          tag,
          function customElementCreationCallback() {
            ChromeUtils.importESModule(script, { global: "current" });
          }
        );
      }
    },
    { once: true }
  );

  Services.scriptloader.loadSubScript("chrome://browser/content/zen-components/ZenDragAndDrop.js", this);
}
