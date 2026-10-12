// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

{
  const lazy = {};

  ChromeUtils.defineESModuleGetters(
    lazy,
    {
      ZenLibrary: "moz-src:///zen/library/ZenLibrary.mjs",
    },
    { global: "current" }
  );

  ChromeUtils.defineESModuleGetters(lazy, {
    ZenLiveFoldersManager:
      "resource:///modules/zen/ZenLiveFoldersManager.sys.mjs",
  });

  const ZEN_LIBRARY_TARGETS = {
    "Browser:ShowAllHistory": "history",
    key_gotoHistory: "history",
    "Tools:Downloads": "downloads",
  };

  const WORKSPACE_SWITCH_COMMAND_PREFIX = "cmd_zenWorkspaceSwitch";

  /**
   * Handlers for the <command> elements of <commandset id="zenCommandSet">
   */
  const ZEN_COMMANDS = {
    // Compact mode
    cmd_zenCompactModeToggle: () => gZenCompactModeManager.toggle(),
    cmd_toggleCompactModeIgnoreHover: () => gZenCompactModeManager.toggle(true),
    cmd_zenCompactModeShowSidebar: () => gZenCompactModeManager.toggleSidebar(),

    // Spaces
    cmd_zenWorkspaceForward: () => gZenWorkspaces.changeWorkspaceShortcut(),
    cmd_zenWorkspaceBackward: () => gZenWorkspaces.changeWorkspaceShortcut(-1),
    cmd_zenChangeWorkspaceTab: event =>
      gZenWorkspaces.changeTabWorkspace(
        event.sourceEvent.target.getAttribute("zen-workspace-id")
      ),
    cmd_zenCtxDeleteWorkspace: event =>
      gZenWorkspaces.contextDeleteWorkspace(event),
    cmd_zenCtxShareWorkspace: () => gZenWorkspaces.contextShareWorkspace(),
    cmd_zenChangeWorkspaceName: () =>
      gZenTabRenamer.start({
        target: gZenWorkspaces.activeWorkspaceIndicator.querySelector(
          ".zen-current-workspace-indicator-name"
        ),
      }),
    cmd_zenChangeWorkspaceIcon: () => gZenWorkspaces.changeWorkspaceIcon(),
    cmd_zenManageWorkspaces: () => lazy.ZenLibrary.toggle("spaces"),
    cmd_zenOpenWorkspaceCreation: () => gZenWorkspaces.openWorkspaceCreation(),
    cmd_zenCloseUnpinnedTabs: () => gZenWorkspaces.closeAllUnpinnedTabs(),
    cmd_zenUnloadWorkspace: () => gZenWorkspaces.unloadWorkspace(),
    cmd_zenUnloadAllOtherWorkspace: () =>
      gZenWorkspaces.unloadAllOtherWorkspaces(),
    cmd_zenOpenSpaceRoutingSettings: () =>
      gZenSpaceRoutingManager.openSpaceRoutingDialog(window),

    // Split view
    cmd_zenSplitViewGrid: () => gZenViewSplitter.toggleShortcut("grid"),
    cmd_zenSplitViewVertical: () => gZenViewSplitter.toggleShortcut("vsep"),
    cmd_zenSplitViewHorizontal: () => gZenViewSplitter.toggleShortcut("hsep"),
    cmd_zenSplitViewUnsplit: () => gZenViewSplitter.toggleShortcut("unsplit"),
    cmd_zenSplitViewContextMenu: () => gZenViewSplitter.contextSplitTabs(),
    cmd_zenCtxShareSplitView: () => gZenViewSplitter.contextShareSplitView(),
    cmd_zenSplitViewLinkInNewTab: () => gZenViewSplitter.splitLinkInNewTab(),
    cmd_zenNewEmptySplit: () => {
      setTimeout(() => {
        gZenViewSplitter.createEmptySplit();
      }, 0);
    },

    // Pinned tabs and essentials
    cmd_zenPinnedTabReset: () =>
      gZenPinnedTabManager.resetPinnedTab(gBrowser.selectedTab),
    cmd_zenPinnedTabResetNoTab: () => gZenPinnedTabManager.resetPinnedTab(),
    cmd_zenReplacePinnedUrlWithCurrent: () =>
      gZenPinnedTabManager.replacePinnedUrlWithCurrent(),
    cmd_zenEditPinnedUrl: () => gZenPinnedTabManager.editPinnedUrl(),
    cmd_contextZenAddToEssentials: () => gZenPinnedTabManager.addToEssentials(),
    cmd_contextZenRemoveFromEssentials: () =>
      gZenPinnedTabManager.removeEssentials(),
    cmd_zenTogglePinTab: () => {
      const currentTab = gZenGlanceManager.getTabOrGlanceParent(
        gBrowser.selectedTab
      );
      if (!currentTab || currentTab.hasAttribute("zen-empty-tab")) {
        return;
      }
      if (currentTab.pinned) {
        gBrowser.unpinTab(currentTab);
      } else {
        gBrowser.pinTab(currentTab);
      }
    },

    // Tabs
    cmd_zenDuplicateTab: () => {
      const selectedTabs = gBrowser.selectedTabs;
      let insertAt = selectedTabs.at(-1).index + 1;
      for (const tab of selectedTabs) {
        gBrowser.duplicateTab(tab, true, { tabIndex: insertAt++ });
      }
    },
    cmd_zenCopyCurrentURL: () => gZenCommonActions.copyCurrentURLToClipboard(),
    cmd_zenCopyCurrentURLMarkdown: () =>
      gZenCommonActions.copyCurrentURLAsMarkdownToClipboard(),

    // Folders
    cmd_zenOpenFolderCreation: () =>
      gZenFolders.createFolder([], { renameFolder: true }),
    cmd_zenNewLiveFolder: event =>
      lazy.ZenLiveFoldersManager.handleEvent(event),

    // Sidebar, theme and windows
    cmd_zenToggleSidebar: () => gZenVerticalTabsManager.toggleExpand(),
    cmd_zenToggleTabsOnRight: () => gZenVerticalTabsManager.toggleTabsOnRight(),
    cmd_zenOpenZenThemePicker: event => gZenThemePicker.openThemePicker(event),
    cmd_zenNewNavigatorUnsynced: () =>
      OpenBrowserWindow({ zenSyncedWindow: false }),
    cmd_zenToggleLibrary: () => lazy.ZenLibrary.toggle(),
  };

  function handleZenCommand(event) {
    const id = event.target.id;
    const handler = ZEN_COMMANDS[id];
    if (handler) {
      handler(event);
      return;
    }
    if (id.startsWith(WORKSPACE_SWITCH_COMMAND_PREFIX)) {
      const index =
        parseInt(id.replace(WORKSPACE_SWITCH_COMMAND_PREFIX, ""), 10) - 1;
      gZenWorkspaces.shortcutSwitchTo(index);
      return;
    }
    gZenGlanceManager.handleMainCommandSet(event);
  }

  document.addEventListener(
    "command",
    event => {
      const tab = ZEN_LIBRARY_TARGETS[event.target.id];
      if (!tab || !Services.prefs.getBoolPref("zen.library.enabled")) {
        return;
      }
      event.stopPropagation();
      lazy.ZenLibrary.toggle(tab);
    },
    true
  );

  document.addEventListener(
    "MozBeforeInitialXULLayout",
    () => {
      // <commandset id="mainCommandSet"> defined in browser-sets.inc
      document
        .getElementById("zenCommandSet")
        .addEventListener("command", handleZenCommand);
    },
    { once: true }
  );
}
