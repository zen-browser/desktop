// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import checkForZenUpdates, {
  createWindowUpdateAnimation,
} from "chrome://browser/content/ZenUpdates.mjs";

class ZenStartup {
  #watermarkIgnoreElements = ["zen-toast-container", "zen-browser-background"];
  #hasInitializedLayout = false;

  isReady = false;
  promiseInitialized = new Promise(resolve => {
    this.promiseInitializedResolve = resolve;
  });

  init() {
    this.openWatermark();
    this.#zenInitBrowserLayout();
  }

  get #shouldUseWatermark() {
    return (
      Services.prefs.getBoolPref("zen.watermark.enabled", false) &&
      gZenWorkspaces.shouldHaveWorkspaces
    );
  }

  #zenInitBrowserLayout() {
    if (this.#hasInitializedLayout) {
      return;
    }
    this.#hasInitializedLayout = true;
    gZenKeyboardShortcutsManager.beforeInit();
    try {
      const kNavbarItems = ["nav-bar", "PersonalToolbar"];
      const kNewContainerId = "zen-appcontent-navbar-container";
      let newContainer = document.getElementById(kNewContainerId);
      for (let id of kNavbarItems) {
        const node = document.getElementById(id);
        if (!node) {
          console.error("Could not find node with id: " + id);
          continue;
        }
        newContainer.appendChild(node);
      }
      // Fix notification deck
      const deckTemplate =
        document.getElementById("tab-notification-deck-template") ||
        document.getElementById("tab-notification-deck");

      // overlap and interaction issues with vertical tabs
      document.getElementById("browser").prepend(deckTemplate);

      gZenWorkspaces.init().then(() => {
        gZenUIManager.init();
        this.#initUIComponents();
        this.#checkForWelcomePage();
      });
    } catch (e) {
      console.error("AstraThemeModifier: Error initializing browser layout", e);
    }
    if (gBrowserInit.delayedStartupFinished) {
      this.delayedStartupFinished();
    } else {
      Services.obs.addObserver(this, "browser-delayed-startup-finished");
    }
  }

  observe(aSubject, aTopic) {
    // This nsIObserver method allows us to defer initialization until after
    // this window has finished painting and starting up.
    if (aTopic == "browser-delayed-startup-finished" && aSubject == window) {
      Services.obs.removeObserver(this, "browser-delayed-startup-finished");
      this.delayedStartupFinished();
    }
  }

  delayedStartupFinished() {
    gZenWorkspaces.promiseInitialized.then(async () => {
      await delayedStartupPromise;
      await SessionStore.promiseAllWindowsRestored;
      delete gZenUIManager.promiseInitialized;
      gZenCompactModeManager.init();
      // Fix for https://github.com/zen-browser/desktop/issues/7605, specially in compact mode
      if (gURLBar.hasAttribute("breakout-extend")) {
        gURLBar.focus();
      }
      // A bit of a hack to make sure the tabs toolbar is updated.
      // Just in case we didn't get the right size.
      gZenUIManager.updateTabsToolbar();
      this.closeWatermark();
      document
        .getElementById("tabbrowser-arrowscrollbox")
        .setAttribute("orient", "vertical");
      // Welcome's finish() recovers overflow after unhiding chrome. When welcome
      // never runs (seen=true / skipped / headless), settle here so App Hub and
      // Suraksha are not left parked in #widget-overflow-list from early layout.
      if (!document.documentElement.hasAttribute("zen-welcome-stage")) {
        await gZenUIManager.settleToolbarOverflow();
      }
      this.isReady = true;
      this.promiseInitializedResolve();
      delete this.promiseInitializedResolve;
      this.#initRamSaver();
      this.#initAiWindowBookmarksFix();
      this.#initSidebarLauncherAutoHide();

      setTimeout(() => {
        // Wait for the natural PlacesToolbar rebuild before invalidating, so
        // the two async rebuilds don't interleave and duplicate bookmarks.
        // promiseRebuilt() returns undefined when no rebuild is in flight.
        const rebuilt =
          document
            .getElementById("PlacesToolbar")
            ?._placesView?.promiseRebuilt() ?? Promise.resolve();
        rebuilt
          .catch(console.error)
          .then(() => gZenWorkspaces._invalidateBookmarkContainers());
      });
    });
  }

  openWatermark() {
    if (!this.#shouldUseWatermark) {
      document.documentElement.removeAttribute("zen-before-loaded");
      return;
    }
    for (let elem of document.querySelectorAll(
      `#browser > *:not(${this.#watermarkIgnoreElements.map(id => "#" + id).join(", ")}), #urlbar`
    )) {
      elem.style.opacity = 0;
    }
  }

  closeWatermark() {
    document.documentElement.removeAttribute("zen-before-loaded");
    if (this.#shouldUseWatermark) {
      let elementsToIgnore = this.#watermarkIgnoreElements
        .map(id => "#" + id)
        .join(", ");
      gZenUIManager.motion
        .animate(
          "#browser > *:not(" +
            elementsToIgnore +
            "), #urlbar, #tabbrowser-tabbox > *",
          {
            opacity: [0, 1],
          },
          {
            duration: 0.1,
          }
        )
        .then(() => {
          for (let elem of document.querySelectorAll(
            "#browser > *, #urlbar, #tabbrowser-tabbox > *"
          )) {
            elem.style.removeProperty("opacity");
          }
        });
    }
    window.requestAnimationFrame(() => {
      window.dispatchEvent(new window.Event("resize")); // To recalculate the layout
    });
  }

  #initUIComponents() {
    const kUIComponents = ["ZenProgressBar", "ZenSpaceRoutingNavigation"];
    for (let component of kUIComponents) {
      const module = ChromeUtils.importESModule(
        "resource:///modules/zen/ui/" + component + ".sys.mjs"
      );
      new module[component](window);
    }
  }

  #checkForWelcomePage() {
    const kWelcomeScreenSeenPref = "zen.welcome-screen.seen";
    if (Services.env.get("MOZ_HEADLESS")) {
      Services.prefs.setBoolPref(kWelcomeScreenSeenPref, true);
      return;
    }
    if (!Services.prefs.getBoolPref(kWelcomeScreenSeenPref, false)) {
      Services.prefs.setBoolPref(kWelcomeScreenSeenPref, true);
      Services.prefs.setStringPref(
        "astra.updates.last-build-id",
        Services.appinfo.appBuildID
      );
      Services.prefs.setStringPref(
        "astra.updates.last-version",
        Services.appinfo.version
      );
      try {
        Services.scriptloader.loadSubScript(
          "chrome://browser/content/zen-components/ZenWelcome.mjs",
          window
        );
      } catch (e) {
        console.error("[Astra] Failed to load welcome script:", e);
        Services.prefs.setBoolPref(kWelcomeScreenSeenPref, false);
      }
    } else {
      this.#createUpdateAnimation();
    }
  }

  async #createUpdateAnimation() {
    checkForZenUpdates();
    return await createWindowUpdateAnimation();
  }

  #ramSaverIdleObserver = {
    observe: (subject, topic) => {
      if (topic !== "idle") {
        return;
      }
      try {
        const mgr = Cc["@mozilla.org/memory-reporter-manager;1"].getService(
          Ci.nsIMemoryReporterManager
        );
        mgr.minimizeMemoryUsage(() => {
          console.info("[Astra RAM Saver]: Minimized memory usage during idle.");
        });
      } catch (e) {
        console.warn("[Astra RAM Saver]: Failed to minimize memory usage", e);
      }
    },
  };

  #ramSaverLastNotifiedAt = 0;

  #checkRamSaverThreshold() {
    try {
      if (!Services.prefs.getBoolPref("astra.ramsaver.enabled", true)) {
        return;
      }
      const thresholdMB = Services.prefs.getIntPref(
        "astra.ramsaver.threshold-mb",
        3072
      );
      const mgr = Cc["@mozilla.org/memory-reporter-manager;1"].getService(
        Ci.nsIMemoryReporterManager
      );
      const residentMB = mgr.resident / (1024 * 1024);
      if (residentMB < thresholdMB) {
        return;
      }
      const now = Date.now();
      if (now - this.#ramSaverLastNotifiedAt < 30 * 60 * 1000) {
        return;
      }
      this.#ramSaverLastNotifiedAt = now;
      const { default: createSidebarNotification } = ChromeUtils.importESModule(
        "chrome://browser/content/zen-components/ZenSidebarNotification.mjs"
      );
      createSidebarNotification({
        headingL10nId: "zen-ramsaver-high-memory-heading",
        links: [
          {
            action: () => {
              Services.startup.quit(
                Services.startup.eAttemptQuit | Services.startup.eRestart
              );
            },
            l10nId: "zen-ramsaver-restart-action",
            special: true,
          },
        ],
      });
    } catch (e) {
      console.warn("[Astra RAM Saver]: Threshold check failed", e);
    }
  }

  #initRamSaver() {
    try {
      if (!Services.prefs.getBoolPref("astra.ramsaver.enabled", true)) {
        return;
      }
      const idleService = Cc["@mozilla.org/user-idle-service;1"].getService(
        Ci.nsIUserIdleService
      );
      idleService.addIdleObserver(this.#ramSaverIdleObserver, 180);
      setInterval(() => this.#checkRamSaverThreshold(), 5 * 60 * 1000);
    } catch (e) {
      console.warn("[Astra RAM Saver]: Failed to initialize", e);
    }
  }

  /**
   * With sidebar.visibility="hide-sidebar", opening a sidebar panel (AI chat,
   * history, bookmarks) forces Firefox's revamp launcher rail (#sidebar-main)
   * visible — a hard requirement inside SidebarState.panelOpen. That 50px rail
   * shoves Compact Mode / App Hub / Suraksha right in Collapsed and
   * Sidebar+Top Toolbar layouts, and the panel close path only hides the
   * panel, leaving the rail stuck forever.
   *
   * Fold the rail back on both show and hide. The panel can stay open with the
   * launcher hidden (Firefox already pads that case). Intentional launcher-only
   * toggles via the sidebar toolbar button (no panel) are left alone.
   */
  #initSidebarLauncherAutoHide() {
    try {
      const box = document.getElementById("sidebar-box");
      if (!box || !SidebarController?.sidebarRevampEnabled) {
        return;
      }
      const foldLauncher = () => {
        if (
          SidebarController.sidebarRevampVisibility !== "hide-sidebar" ||
          !SidebarController.launcherVisible
        ) {
          return;
        }
        SidebarController._state.updateVisibility(false);
        SidebarController.updateToolbarButton();
      };
      // sidebar-show/hide can race panelOpen / isOpen; settle next frame.
      box.addEventListener("sidebar-show", () => {
        requestAnimationFrame(() => {
          if (SidebarController.isOpen) {
            foldLauncher();
          }
        });
      });
      box.addEventListener("sidebar-hide", () => {
        requestAnimationFrame(() => {
          if (!SidebarController.isOpen) {
            foldLauncher();
          }
        });
      });
      // Settle stale launcher left visible from a previous session.
      if (!SidebarController.isOpen) {
        foldLauncher();
      }
    } catch (e) {
      console.warn("[Astra]: Failed to init sidebar launcher auto-hide", e);
    }
  }

  #initAiWindowBookmarksFix() {
    try {
      ChromeUtils.defineESModuleGetters(this, {
        AIWindowUI:
          "moz-src:///browser/components/aiwindow/ui/modules/AIWindowUI.sys.mjs",
      });
      const sidebarBox = document.getElementById("sidebar-box");
      if (!sidebarBox) {
        return;
      }
      new MutationObserver(mutations => {
        for (const mutation of mutations) {
          if (mutation.attributeName !== "sidebarcommand") {
            continue;
          }
          const command = sidebarBox.getAttribute("sidebarcommand");
          if (command && command !== "viewGenaiChatSidebar") {
            try {
              this.AIWindowUI.closeSidebar(window);
            } catch (e) {
              console.warn(
                "[Astra]: Failed to close AI window split pane on sidebar switch",
                e
              );
            }
          }
        }
      }).observe(sidebarBox, { attributes: true, attributeFilter: ["sidebarcommand"] });
    } catch (e) {
      console.warn("[Astra]: Failed to initialize AI window/bookmarks fix", e);
    }
  }
}

window.gZenStartup = new ZenStartup();

window.addEventListener(
  "MozBeforeInitialXULLayout",
  () => {
    gZenStartup.init();
  },
  { once: true }
);
