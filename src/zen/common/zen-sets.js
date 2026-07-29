// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

console.log("Astra: zen-sets.js loaded");

const { gZenEnergySaver } = ChromeUtils.importESModule(
  "chrome://browser/content/ZenEnergySaver.mjs"
);

function isAstraSafeUrl(url) {
  try {
    const parsed = Services.io.newURI(url);
    const scheme = parsed?.scheme?.toLowerCase();
    return scheme === "http" || scheme === "https";
  } catch (error) {
    console.error("Astra: invalid URL provided:", url, error);
    return false;
  }
}

function reportAstraActionError(message, error) {
  console.error(message, error);
  try {
    window.gZenUIManager?.showToast?.("zen-general-error");
  } catch (_ignored) {
    // Keep console error as the guaranteed fallback.
  }
}

/**
 * Prefer a visible, layout-stable chrome node for the native protections popup.
 * Do not use #tracking-protection-icon-container — Zen hides it by default
 * (zen.urlbar.show-protections-icon=false), which breaks openPopup from
 * toolbar overflow on Windows.
 */
function resolveAstraSurakshaAnchor() {
  const isUsable = node => {
    if (
      !node ||
      !node.isConnected ||
      typeof node.getBoundingClientRect !== "function"
    ) {
      return false;
    }
    try {
      const rect = node.getBoundingClientRect();
      return rect.width > 0 || rect.height > 0;
    } catch {
      return false;
    }
  };
  const candidates = [
    document.getElementById("identity-icon-box"),
    document.getElementById("identity-box"),
    document.getElementById("urlbar-input-container"),
    document.getElementById("urlbar"),
    document.getElementById("nav-bar"),
    document.documentElement,
  ];
  for (const node of candidates) {
    if (isUsable(node)) {
      return node;
    }
  }
  return document.documentElement;
}

/**
 * Open native #protections-popup anchored to identity/urlbar chrome.
 * Mirrors gProtectionsHandler.showProtectionsPopup setup, but never anchors
 * to the (often display:none) tracking-protection icon container.
 * Defers when #widget-overflow is still open/hiding to avoid the Windows
 * "open while another popup is hiding" PanelMultiView failure.
 */
function openAstraSurakshaProtectionsPopup(triggerEvent) {
  const handler = window.gProtectionsHandler;
  if (!handler) {
    return false;
  }
  if (handler.trustPanelEnabledPref) {
    return false;
  }
  if (typeof handler._initializePopup !== "function") {
    return false;
  }
  if (typeof PanelMultiView?.openPopup !== "function") {
    return false;
  }

  const runOpen = () => {
    try {
      handler._initializePopup();
      handler._protectionsPopupOpeningReason = "astraSuraksha";

      if (Object.prototype.hasOwnProperty.call(handler, "_lastEvent")) {
        handler.updatePanelForBlockingEvent(handler._lastEvent);
        delete handler._lastEvent;
      }

      if (handler._toastPanelTimer) {
        clearTimeout(handler._toastPanelTimer);
        delete handler._toastPanelTimer;
      }

      const popup = handler._protectionsPopup;
      if (!popup) {
        return;
      }
      popup.toggleAttribute("toast", false);
      if (typeof handler.refreshProtectionsPopup === "function") {
        handler.refreshProtectionsPopup();
      }

      for (const panel of document.querySelectorAll("panel[openpanel]")) {
        try {
          PanelMultiView.hidePopup(panel);
        } catch {
          // ignore
        }
      }

      const anchor = resolveAstraSurakshaAnchor();
      PanelMultiView.openPopup(popup, anchor, {
        position: "bottomleft topleft",
        triggerEvent: triggerEvent || undefined,
      }).catch(console.error);
    } catch (error) {
      console.error("[AstraSuraksha] protections popup open failed:", error);
    }
  };

  const overflow = document.getElementById("widget-overflow");
  const overflowBusy =
    overflow &&
    (overflow.state === "open" ||
      overflow.state === "showing" ||
      overflow.state === "hiding");

  if (overflowBusy) {
    let opened = false;
    let fallbackTimer = 0;
    const finish = () => {
      if (opened) {
        return;
      }
      opened = true;
      overflow.removeEventListener("popuphidden", onHidden);
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
        fallbackTimer = 0;
      }
      runOpen();
    };
    const onHidden = () => finish();
    overflow.addEventListener("popuphidden", onHidden, { once: true });
    // Fallback if popuphidden never fires (detached / already closed).
    fallbackTimer = setTimeout(finish, 350);
    try {
      PanelMultiView.hidePopup(overflow);
    } catch {
      // runOpen still scheduled via popuphidden or timeout
    }
    return true;
  }

  runOpen();
  return true;
}

function openAstraTrustedUrl(url, panelId, contextLabel) {
  try {
    if (!isAstraSafeUrl(url)) {
      reportAstraActionError(`Astra: ${contextLabel} blocked invalid URL: ${url}`);
      return;
    }

    const panel = document.getElementById(panelId);
    panel?.hidePopup();

    const win = Services.wm.getMostRecentWindow("navigator:browser");
    if (!win) {
      reportAstraActionError(`Astra: ${contextLabel} no browser window found`);
      return;
    }

    if (typeof win.openTrustedLinkIn === "function") {
      win.openTrustedLinkIn(url, "tab", {
        triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
        inBackground: false,
      });
      win.focus();
      return;
    }

    if (win.gBrowser) {
      win.gBrowser.selectedTab = win.gBrowser.addTrustedTab(url, {
        triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
        inBackground: false,
      });
      win.focus();
      return;
    }

    reportAstraActionError(`Astra: ${contextLabel} could not open URL (no gBrowser/openTrustedLinkIn)`);
  } catch (error) {
    reportAstraActionError(`Astra: ${contextLabel} open failed`, error);
  }
}

window.gZenIndiaGov = {
  open(event, win = window) {
    try {
      const doc = win.document || document;
      const panel = doc.getElementById("PanelUI-zen-india-gov");
      if (!panel) return;
      const anchor =
        doc.getElementById("zen-sidebar-top-buttons-separator") ||
        doc.getElementById("zen-sidebar-top-buttons") ||
        doc.getElementById("nav-bar") ||
        doc.getElementById("browser");
      panel.openPopup(anchor, "after_start", 0, 0, false, false);
    } catch(e) {
      console.error("Astra: India Gov open error:", e);
    }
  },
  openApp(url) {
    openAstraTrustedUrl(url, "PanelUI-zen-india-gov", "India Gov");
  },
};

// CSP-safe event delegation with robust popup lifecycle binding.
const gAstraDelegationState = {
  commandHandlers: new WeakMap(),
  popupHandlers: new WeakMap(),
  hiddenHandlers: new WeakMap(),
};

function bindAstraCommandHandler(panel, panelName, resolver) {
  try {
    const oldHandler = gAstraDelegationState.commandHandlers.get(panel);
    if (oldHandler) {
      panel.removeEventListener("command", oldHandler);
      console.log(`Astra: removed old ${panelName} command handler`);
    }

    const handler = event => {
      try {
        const target = event.target;
        if (!target || typeof target.closest !== "function") {
          return;
        }
        const item = target.closest("[data-url], [data-action]");
        if (!item) {
          return;
        }
        resolver(item, panel);
      } catch (error) {
        console.error(`Astra: ${panelName} command handler error:`, error);
      }
    };

    panel.addEventListener("command", handler);
    gAstraDelegationState.commandHandlers.set(panel, handler);
    console.log(`Astra: ${panelName} command handler attached`);
  } catch (error) {
    console.error(`Astra: failed to bind ${panelName} handler:`, error);
  }
}

function attachAstraPanelDelegation() {
  try {
    // App Hub command handling is owned by AstraAppHubManager.

    const indiaGovPanel = document.getElementById("PanelUI-zen-india-gov");
    if (indiaGovPanel) {
      bindAstraCommandHandler(
        indiaGovPanel,
        "India Gov",
        (item, panel) => {
          const url = item.getAttribute("data-url");
          console.log("Astra: India Gov command detected", { url });
          if (url && window.gZenIndiaGov) {
            window.gZenIndiaGov.openApp(url);
            panel.hidePopup();
          }
        }
      );
    } else {
      console.log("Astra: India Gov panel not found during delegation attach");
    }

    const tabNotesPanel = document.getElementById("PanelUI-zen-tab-notes");
    if (tabNotesPanel) {
      bindAstraCommandHandler(
        tabNotesPanel,
        "Tab Notes",
        (item, panel) => {
          const action = item.getAttribute("data-action");
          console.log("Astra: Tab Notes command detected", { action });
          if (action === "saveNote") {
            window.gZenTabNotes?.saveNote();
            panel.hidePopup();
          }
          if (action === "clearNote") {
            window.gZenTabNotes?.clearNote();
            panel.hidePopup();
          }
        }
      );
    } else {
      console.log("Astra: Tab Notes panel not found during delegation attach");
    }
  } catch (error) {
    console.error("Astra: attachAstraPanelDelegation failed:", error);
  }
}

function bindAstraPopupShowingHook(panelId, panelName) {
  try {
    const panel = document.getElementById(panelId);
    if (!panel) {
      console.log(`Astra: ${panelName} popup hook skipped (panel missing)`);
      return;
    }

    const oldPopupHandler = gAstraDelegationState.popupHandlers.get(panel);
    if (oldPopupHandler) {
      panel.removeEventListener("popupshowing", oldPopupHandler);
      console.log(`Astra: removed old ${panelName} popupshowing hook`);
    }

    const popupHandler = () => {
      console.log(`Astra: ${panelName} popupshowing -> rebinding delegation`);
      attachAstraPanelDelegation();
    };
    panel.addEventListener("popupshowing", popupHandler);
    gAstraDelegationState.popupHandlers.set(panel, popupHandler);
    console.log(`Astra: ${panelName} popupshowing hook attached`);

    const oldHiddenHandler = gAstraDelegationState.hiddenHandlers.get(panel);
    if (oldHiddenHandler) {
      panel.removeEventListener("popuphidden", oldHiddenHandler);
      console.log(`Astra: removed old ${panelName} popuphidden hook`);
    }

    const hiddenHandler = () => {
      const commandHandler = gAstraDelegationState.commandHandlers.get(panel);
      if (commandHandler) {
        panel.removeEventListener("command", commandHandler);
        gAstraDelegationState.commandHandlers.delete(panel);
        console.log(`Astra: ${panelName} command handler cleaned on popuphidden`);
      }
    };
    panel.addEventListener("popuphidden", hiddenHandler);
    gAstraDelegationState.hiddenHandlers.set(panel, hiddenHandler);
    console.log(`Astra: ${panelName} popuphidden hook attached`);
  } catch (error) {
    console.error(`Astra: failed popupshowing hook for ${panelName}:`, error);
  }
}

function initAstraPanelDelegation() {
  try {
    console.log("Astra: initializing panel delegation");
    attachAstraPanelDelegation();
    bindAstraPopupShowingHook("PanelUI-zen-india-gov", "India Gov");
    bindAstraPopupShowingHook("PanelUI-zen-tab-notes", "Tab Notes");
  } catch (error) {
    console.error("Astra: initAstraPanelDelegation failed:", error);
  }
}

// Multiple init strategies for maximum reliability.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAstraPanelDelegation, {
    once: true,
  });
}
window.addEventListener("load", initAstraPanelDelegation, { once: true });
initAstraPanelDelegation();

document.addEventListener(
  "MozBeforeInitialXULLayout",
  () => {
    const openCrashRecoveryPanel = (event, win = window) => {
      const panel = win.document.getElementById("PanelUI-zen-crash-recovery");
      if (!panel) {
        return;
      }
      const isUsableAnchor = node => {
        if (!node || !node.isConnected || typeof node.getBoundingClientRect !== "function") {
          return false;
        }
        const rect = node.getBoundingClientRect();
        return rect.width > 0 || rect.height > 0;
      };
      const eventAnchor = event?.sourceEvent?.target;
      const anchor =
        (isUsableAnchor(eventAnchor) && eventAnchor) ||
        win.document.getElementById("zen-site-data-icon-button") ||
        win.document.getElementById("urlbar-input-container") ||
        win.document.getElementById("nav-bar") ||
        win.document.getElementById("browser");
      panel.openPopup(anchor, "after_start", 0, 0, false, false);
    };

    const lazy = {};
    ChromeUtils.defineESModuleGetters(lazy, {
      TabStateCache: "resource:///modules/sessionstore/TabStateCache.sys.mjs",
    });

    /* Astra - Tab Loading Pill Indicator */
    window.addEventListener("TabAttrModified", (event) => {
      try {
        const tab = event.target;
        const wrapper = document.getElementById("zen-appcontent-wrapper");
        if (!wrapper) return;
        const selectedTab = gBrowser.selectedTab;
        if (selectedTab && selectedTab.hasAttribute("busy")) {
          wrapper.setAttribute("tab-loading", "true");
        } else {
          wrapper.removeAttribute("tab-loading");
        }
      } catch(e) {
        // ignore
      }
    });

    window.addEventListener("TabSelect", () => {
      try {
        const wrapper = document.getElementById("zen-appcontent-wrapper");
        if (!wrapper) return;
        const selectedTab = gBrowser.selectedTab;
        if (selectedTab && selectedTab.hasAttribute("busy")) {
          wrapper.setAttribute("tab-loading", "true");
        } else {
          wrapper.removeAttribute("tab-loading");
        }
      } catch(e) {
        // ignore
      }
    });

    window.gZenTabNotes = {
      _currentTab: null,

      openNotePanel(tab) {
        try {
          this._currentTab = tab;
          const panel = document.getElementById("PanelUI-zen-tab-notes");
          if (!panel) return;
          const textarea = document.getElementById("zen-tab-notes-textarea");
          if (textarea) {
            textarea.value = tab.zenNote || "";
          }
          const tabLabel = tab.zenStaticLabel || tab.label || "";
          const title = document.getElementById("zen-tab-notes-title");
          if (title) {
            title.value = `📝 ${tabLabel}`;
          }
          const anchor = tab.querySelector(".tab-icon-image")
            || document.getElementById("zen-app-launcher-button")
            || document.getElementById("nav-bar");
          panel.openPopup(anchor, "after_start", 0, 0, false, false);
        } catch(e) {
          console.error("Astra: Tab notes error:", e);
        }
      },

      saveNote() {
        try {
          const tab = this._currentTab;
          if (!tab) return;
          const textarea = document.getElementById("zen-tab-notes-textarea");
          if (!textarea) return;
          const note = textarea.value.trim();
          if (note) {
            tab.zenNote = note;
          } else {
            delete tab.zenNote;
          }
          lazy.TabStateCache?.update?.(tab.permanentKey, {});
          const panel = document.getElementById("PanelUI-zen-tab-notes");
          panel?.hidePopup();
          gZenUIManager.showToast("zen-tab-note-saved-toast");
        } catch(e) {
          console.error("Astra: Save note error:", e);
        }
      },

      clearNote() {
        try {
          const tab = this._currentTab;
          if (!tab) return;
          delete tab.zenNote;
          lazy.TabStateCache?.update?.(tab.permanentKey, {});
          const textarea = document.getElementById("zen-tab-notes-textarea");
          if (textarea) textarea.value = "";
          const panel = document.getElementById("PanelUI-zen-tab-notes");
          panel?.hidePopup();
          gZenUIManager.showToast("zen-tab-note-cleared-toast");
        } catch(e) {
          console.error("Astra: Clear note error:", e);
        }
      },
    };

    window.gZenCrashRecovery = {
      open: openCrashRecoveryPanel,
    };

    window.gZenStartup?.promiseInitialized?.then(() => {
      if (
        Services.prefs.getBoolPref("zen.crash-recovery.pending", false) &&
        !window.gZenWorkspaces?.privateWindowOrDisabled
      ) {
        Services.prefs.setBoolPref("zen.crash-recovery.pending", false);
        setTimeout(() => {
          openCrashRecoveryPanel();
        }, 350);
      }
    });

    window.gZenStartup?.promiseInitialized?.then(() => {
      void gZenEnergySaver.init().catch(console.warn);
      // init() is idempotent: first call registers observers; later calls reapply only.
      window.gAstraTransparency?.init?.();
      window.gAstraTransparency?.onStartupReady?.();
      window.gAstraTransparency?.syncThemePickerButton?.();
    });

    // <commandset id="mainCommandSet"> defined in browser-sets.inc
    document
      .getElementById("zenCommandSet")
      // eslint-disable-next-line complexity
      .addEventListener("command", event => {
        switch (event.target.id) {
          case "cmd_zenCompactModeToggle":
            gZenCompactModeManager.toggle();
            break;
          case "cmd_toggleCompactModeIgnoreHover":
            gZenCompactModeManager.toggle(true);
            break;
          case "cmd_zenCompactModeShowSidebar":
            gZenCompactModeManager.toggleSidebar();
            break;
          case "cmd_zenWorkspaceForward":
            gZenWorkspaces.changeWorkspaceShortcut();
            break;
          case "cmd_zenWorkspaceBackward":
            gZenWorkspaces.changeWorkspaceShortcut(-1);
            break;
          case "cmd_zenSplitViewGrid":
            gZenViewSplitter.toggleShortcut("grid");
            break;
          case "cmd_zenSplitViewVertical":
            gZenViewSplitter.toggleShortcut("vsep");
            break;
          case "cmd_zenSplitViewHorizontal":
            gZenViewSplitter.toggleShortcut("hsep");
            break;
          case "cmd_zenSplitViewUnsplit":
            gZenViewSplitter.toggleShortcut("unsplit");
            break;
          case "cmd_zenSplitViewContextMenu":
            gZenViewSplitter.contextSplitTabs();
            break;
          case "cmd_zenCopyCurrentURLMarkdown":
            gZenCommonActions.copyCurrentURLAsMarkdownToClipboard();
            break;
          case "cmd_zenCopyCurrentURL":
            gZenCommonActions.copyCurrentURLToClipboard();
            break;
          case "cmd_zenPinnedTabReset":
            gZenPinnedTabManager.resetPinnedTab(gBrowser.selectedTab);
            break;
          case "cmd_zenPinnedTabResetNoTab":
            gZenPinnedTabManager.resetPinnedTab();
            break;
          case "cmd_zenToggleSidebar":
            gZenVerticalTabsManager.toggleExpand();
            break;
          case "cmd_zenOpenZenThemePicker":
            // Astra: Edit Theme is pref-gated (astra.feature.editTheme.enabled,
            // default false). No-op when disabled; implementation kept intact.
            if (
              Services.prefs.getBoolPref(
                "astra.feature.editTheme.enabled",
                false
              )
            ) {
              gZenThemePicker.openThemePicker(event);
            }
            break;
          case "cmd_zenSetWorkspaceBg":
            gZenWorkspaces.openBackgroundImagePicker();
            break;
          case "cmd_zenRemoveWorkspaceBg":
            gZenWorkspaces.removeWorkspaceBackground();
            break;
          case "cmd_zenChangeWorkspaceTab":
            gZenWorkspaces.changeTabWorkspace(
              event.sourceEvent.target.getAttribute("zen-workspace-id")
            );
            break;
          case "cmd_zenToggleTabsOnRight":
            gZenVerticalTabsManager.toggleTabsOnRight();
            break;
          case "cmd_zenSplitViewLinkInNewTab":
            gZenViewSplitter.splitLinkInNewTab();
            break;
          case "cmd_zenNewEmptySplit":
            setTimeout(() => {
              gZenViewSplitter.createEmptySplit();
            }, 0);
            break;
          case "cmd_zenReplacePinnedUrlWithCurrent":
            gZenPinnedTabManager.replacePinnedUrlWithCurrent();
            break;
          case "cmd_contextZenAddToEssentials":
            gZenPinnedTabManager.addToEssentials();
            break;
          case "cmd_contextZenRemoveFromEssentials":
            gZenPinnedTabManager.removeEssentials();
            break;
          case "cmd_zenCtxDeleteWorkspace":
            gZenWorkspaces.contextDeleteWorkspace(event);
            break;
          case "cmd_zenChangeWorkspaceName":
            gZenVerticalTabsManager.renameTabStart({
              target: gZenWorkspaces.activeWorkspaceIndicator.querySelector(
                ".zen-current-workspace-indicator-name"
              ),
            });
            break;
          case "cmd_zenChangeWorkspaceIcon":
            gZenWorkspaces.changeWorkspaceIcon();
            break;
          case "cmd_zenReorderWorkspaces":
            gZenUIManager.showToast("zen-workspaces-how-to-reorder-title", {
              timeout: 9000,
              descriptionId: "zen-workspaces-how-to-reorder-desc",
            });
            break;
          case "cmd_zenOpenWorkspaceCreation":
            // Astra: Spaces UI is pref-gated (astra.feature.spaces.enabled,
            // default false → single-space mode). Creation no-ops when
            // disabled; the workspaces engine itself keeps running.
            if (
              Services.prefs.getBoolPref("astra.feature.spaces.enabled", false)
            ) {
              gZenWorkspaces.openWorkspaceCreation(event);
            }
            break;
          case "cmd_zenCreateSpaceFromPreset": {
            if (
              !Services.prefs.getBoolPref("astra.feature.spaces.enabled", false)
            ) {
              break;
            }
            const presetId =
              event.sourceEvent?.target?.getAttribute("zen-space-preset") ||
              event.target?.getAttribute("zen-space-preset");
            if (presetId) {
              gZenWorkspaces.createWorkspaceFromPreset(presetId);
            }
            break;
          }
          case "cmd_zenOpenFolderCreation":
            gZenFolders.createFolder([], {
              renameFolder: true,
            });
            break;
          case "cmd_zenCreateFolderFromTemplate": {
            const templateId =
              event.sourceEvent?.target?.getAttribute("zen-folder-template") ||
              event.target?.getAttribute("zen-folder-template");
            gZenFolders.createFolderFromTemplate(templateId);
            break;
          }
          case "cmd_zenFolderQuickSearch":
            gZenFolders.openSearchForActiveFolder();
            break;
          case "cmd_zenTogglePinTab": {
            const currentTab = gBrowser.selectedTab;
            if (currentTab && !currentTab.hasAttribute("zen-empty-tab")) {
              if (currentTab.pinned) {
                gBrowser.unpinTab(currentTab);
              } else {
                gBrowser.pinTab(currentTab);
              }
            }
            break;
          }
          case "cmd_zenCloseUnpinnedTabs":
            gZenWorkspaces.closeAllUnpinnedTabs();
            break;
          case "cmd_zenUnloadWorkspace": {
            gZenWorkspaces.unloadWorkspace();
            break;
          }
          case "cmd_zenUnloadAllOtherWorkspace": {
            gZenWorkspaces.unloadAllOtherWorkspaces();
            break;
          }
          case "cmd_zenNewNavigatorUnsynced":
            OpenBrowserWindow({ zenSyncedWindow: false });
            break;
          case "cmd_zenNewLiveFolder": {
            const { ZenLiveFoldersManager } = ChromeUtils.importESModule(
              "resource:///modules/zen/ZenLiveFoldersManager.sys.mjs"
            );
            ZenLiveFoldersManager.handleEvent(event);
            break;
          }
          case "cmd_zenDuplicateTab": {
            const selectedTabs = gBrowser.selectedTabs;
            let insertAt = selectedTabs.at(-1)._tPos + 1;
            for (const tab of selectedTabs) {
              gBrowser.duplicateTab(tab, true, { tabIndex: insertAt++ });
            }
            break;
          }
          case "cmd_zenToggleWindowScheme": {
            // Toggle between forced light (1) and dark (0). Auto (2) resolves
            // to the opposite of the currently effective scheme.
            const pref = "zen.view.window.scheme";
            const current = Services.prefs.getIntPref(pref, 2);
            let isDark;
            if (current === 0) {
              isDark = true;
            } else if (current === 1) {
              isDark = false;
            } else {
              isDark = window.matchMedia("(prefers-color-scheme: dark)")
                .matches;
            }
            Services.prefs.setIntPref(pref, isDark ? 1 : 0);
            break;
          }
          case "cmd_zenOpenAppLauncher": {
            // Always use the stable bootstrap facade (never call manager directly).
            // Feature-gated: astra.apphub.enabled (default true; set false to hide).
            if (!Services.prefs.getBoolPref("astra.apphub.enabled", true)) {
              break;
            }
            const hub = window.gZenAppLauncher;
            const sourceEvent = event?.sourceEvent;
            const sourceType = sourceEvent?.type;
            const source =
              sourceType === "keydown" ||
              sourceType === "keypress" ||
              sourceType === "keyup"
                ? "keyboard"
                : sourceType && String(sourceType).startsWith("mouse")
                  ? "mouse"
                  : "command";
            if (hub?.toggle) {
              void hub.toggle({ event, source });
            } else if (hub?.open) {
              void hub.open({ event, source });
            } else {
              console.error(
                "[AstraAppHub] command invoked but gZenAppLauncher is missing"
              );
            }
            break;
          }
          case "cmd_astraOpenSurakshaCenter": {
            // Custom Suraksha panel is retired. Open native #protections-popup
            // anchored to identity/urlbar chrome (not the hidden TP icon), and
            // defer past #widget-overflow hide to avoid Windows openPopup races.
            const trigger = event?.sourceEvent || event;
            if (openAstraSurakshaProtectionsPopup(trigger)) {
              break;
            }
            const handler = window.gProtectionsHandler;
            if (typeof handler?.openProtections === "function") {
              // Trust-panel builds / missing PanelMultiView path.
              handler.openProtections(true);
            } else if (typeof window.switchToTabHavingURI === "function") {
              window.switchToTabHavingURI("about:protections", true, {
                replaceQueryString: true,
                relatedToCurrent: true,
                triggeringPrincipal:
                  Services.scriptSecurityManager.getSystemPrincipal(),
              });
            }
            break;
          }
          case "cmd_zenOpenIndiaGov":
            gZenIndiaGov.open(event);
            break;
          case "cmd_zenSmartGuardDetails": {
            const status = window.gZenSmartGuard?.getPanelStatus?.();
            if (!window.gZenSmartGuard?.enabled) {
              gZenUIManager.showToast("zen-smart-status-safe", {
                timeout: 4200,
                descriptionId: "zen-smart-open-details",
              });
              break;
            }
            const toastId =
              status?.level === "high"
                ? "zen-smart-download-warning"
                : status?.level === "medium"
                  ? "zen-smart-screen-warning"
                  : status?.level === "low"
                    ? "zen-smart-clipboard-warning"
                    : "zen-smart-status-safe";
            gZenUIManager.showToast(toastId, {
              timeout: 4200,
              descriptionId: "zen-smart-open-details",
            });
            break;
          }
          case "cmd_zenSmartSuspendNow": {
            void gZenWorkspaces.runSmartTabSuspension({ force: true }).then(unloaded => {
              gZenUIManager.showToast("zen-smart-suspend-complete", {
                l10nArgs: { count: unloaded || 0 },
                timeout: 3500,
              });
            });
            break;
          }
          case "cmd_zenOpenCrashRecovery":
            openCrashRecoveryPanel(event);
            break;
          case "cmd_zenSearchOpenTabs": {
            const { searchOpenTabs } = ChromeUtils.importESModule(
              "chrome://browser/content/zen-components/AstraPhase1Actions.mjs"
            );
            searchOpenTabs(window);
            break;
          }
          case "cmd_zenReadAloud": {
            const { openReaderForReadAloud } = ChromeUtils.importESModule(
              "chrome://browser/content/zen-components/AstraPhase1Actions.mjs"
            );
            openReaderForReadAloud(window);
            break;
          }
          case "cmd_zenCrashRestoreSession": {
            document.getElementById("PanelUI-zen-crash-recovery")?.hidePopup();
            document
              .getElementById("History:RestoreLastClosedTabOrWindowOrSession")
              ?.doCommand();
            gZenUIManager.showToast("zen-crash-recovery-session-restore-started", {
              timeout: 3500,
            });
            break;
          }
          case "cmd_zenCrashRestoreWorkspace": {
            document.getElementById("PanelUI-zen-crash-recovery")?.hidePopup();
            const { ZenWindowSync } = ChromeUtils.importESModule(
              "resource:///modules/zen/ZenWindowSync.sys.mjs"
            );
            const workspaceId = gZenWorkspaces.activeWorkspace;
            if (workspaceId) {
              ZenWindowSync.moveTabsToSyncedWorkspace(window, workspaceId);
              gZenUIManager.showToast("zen-crash-recovery-workspace-restore-started", {
                timeout: 3500,
              });
            }
            break;
          }
          case "cmd_zenQuickAddCurrentTabToFolder": {
            const currentTab = gBrowser.selectedTab;
            if (
              window.gZenFolders?.createFolder &&
              currentTab &&
              !currentTab.hasAttribute("zen-empty-tab") &&
              !currentTab.hasAttribute("zen-essential")
            ) {
              gZenFolders.createFolder([currentTab], { renameFolder: true });
              gZenUIManager.showToast("zen-folder-quick-add-started");
            } else {
              gZenUIManager.showToast("zen-folder-quick-add-unavailable");
            }
            break;
          }
          case "cmd_zenUndoLastWorkspaceMove": {
            const didUndo = gZenWorkspaces.undoLastWorkspaceMove();
            gZenUIManager.showToast(
              didUndo
                ? "zen-workspace-undo-move-success"
                : "zen-workspace-undo-move-none",
              { timeout: 3200 }
            );
            break;
          }
          default:
            gZenGlanceManager.handleMainCommandSet(event);
            if (event.target.id.startsWith("cmd_zenWorkspaceSwitch")) {
              const index =
                parseInt(
                  event.target.id.replace("cmd_zenWorkspaceSwitch", ""),
                  10
                ) - 1;
              gZenWorkspaces.shortcutSwitchTo(index);
            }
            break;
        }
      });
  },
  { once: true }
);
