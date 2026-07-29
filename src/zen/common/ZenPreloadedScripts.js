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
  // Sidebar secondary nav: install after delayed startup so chrome XUL exists.
  try {
    const { installAstraSidebarNavigation } = ChromeUtils.importESModule(
      "chrome://browser/content/zen-components/AstraSidebarNavigation.mjs"
    );
    const install = () => {
      try {
        installAstraSidebarNavigation(window);
      } catch (error) {
        console.warn("[AstraSidebarNavigation] install failed", error);
      }
    };
    if (window.gBrowserInit?.delayedStartupFinished) {
      install();
    } else {
      const observer = {
        observe(subject, topic) {
          if (topic === "browser-delayed-startup-finished" && subject === window) {
            Services.obs.removeObserver(observer, topic);
            install();
          }
        },
      };
      Services.obs.addObserver(observer, "browser-delayed-startup-finished");
    }
  } catch (error) {
    console.warn("[AstraSidebarNavigation] failed to initialize; browser remains usable", error);
  }
  // Migration Center: bootstrap only — center module lazy-loads on first open.
  try {
    ChromeUtils.importESModule("chrome://browser/content/zen-components/AstraMigrationBootstrap.mjs", { global: "current" });
  } catch (error) {
    console.warn("[AstraMigration] bootstrap failed to initialize; browser remains usable", error);
  }
  ChromeUtils.importESModule("chrome://browser/content/zen-components/ZenKeyboardShortcuts.mjs", { global: "current" });
  ChromeUtils.importESModule("chrome://browser/content/zen-components/ZenSessionStore.mjs", { global: "current" });

  Services.scriptloader.loadSubScript("chrome://browser/content/zen-components/ZenDragAndDrop.js", this);
}
