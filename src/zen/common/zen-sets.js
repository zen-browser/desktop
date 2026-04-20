// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

document.addEventListener(
  "MozBeforeInitialXULLayout",
  () => {
    const openIndiaServicesPanel = (event, win = window) => {
      const panel = win.document.getElementById("PanelUI-zen-india-services");
      if (!panel) {
        console.error("India services panel not found");
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
        win.document.getElementById("urlbar-input-container") ||
        win.document.getElementById("urlbar") ||
        win.document.getElementById("nav-bar") ||
        win.document.getElementById("browser");
      panel.openPopup(anchor, "after_start", 0, 0, false, false);
    };
    window.gZenIndiaServices = {
      open: openIndiaServicesPanel,
    };

    const openAppLauncherPanel = (event, win = window) => {
      const panel = win.document.getElementById("PanelUI-zen-app-launcher");
      if (!panel) {
        console.error("App launcher panel not found");
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
        win.document.getElementById("zen-app-launcher-button") ||
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

    window.gZenAppLauncher = {
      open: openAppLauncherPanel,
      openApp(url) {
        try {
          const panel = document.getElementById("PanelUI-zen-app-launcher");
          panel?.hidePopup();
          openTrustedLinkIn(url, "tab");
        } catch(e) {
          console.error("Astra: App launcher open error:", e);
        }
      },
    };

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
            gZenThemePicker.openThemePicker(event);
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
            gZenWorkspaces.openWorkspaceCreation(event);
            break;
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
          case "cmd_zenOpenIndiaServices":
            openIndiaServicesPanel(event);
            break;
          case "cmd_zenOpenAppLauncher":
            openAppLauncherPanel(event);
            break;
          case "cmd_zenSmartGuardDetails": {
            const status = window.gZenSmartGuard?.getPanelStatus?.();
            if (!status || !window.gZenSmartGuard?.enabled) {
              gZenUIManager.showToast("zen-smart-status-safe", {
                timeout: 3500,
              });
              break;
            }
            gZenUIManager.showToast(
              status.level === "high"
                ? "zen-smart-download-warning"
                : status.level === "medium"
                  ? "zen-smart-screen-warning"
                  : status.level === "low"
                    ? "zen-smart-clipboard-warning"
                    : "zen-smart-status-safe",
              { timeout: 3500 }
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
