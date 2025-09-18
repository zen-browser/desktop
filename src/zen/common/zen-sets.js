// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

document.addEventListener(
  'MozBeforeInitialXULLayout',
  () => {
    // <commandset id="mainCommandSet"> defined in browser-sets.inc
    document
      .getElementById('zenCommandSet')

      .addEventListener('command', (event) => {
        switch (event.target.id) {
          case 'cmd_zenCompactModeToggle':
            gZenCompactModeManager.toggle();
            break;
          case 'cmd_zenCompactModeShowSidebar':
            gZenCompactModeManager.toggleSidebar();
            break;
          case 'cmd_zenCompactModeHideSidebar':
            gZenCompactModeManager.hideSidebar();
            break;
          case 'cmd_zenCompactModeHideToolbar':
            gZenCompactModeManager.hideToolbar();
            break;
          case 'cmd_zenCompactModeHideBoth':
            gZenCompactModeManager.hideBoth();
            break;
          case 'cmd_zenCompactModeShowToolbar':
            gZenCompactModeManager.toggleToolbar();
            break;
          case 'cmd_zenWorkspaceForward':
            gZenWorkspaces.changeWorkspaceShortcut();
            break;
          case 'cmd_zenWorkspaceBackward':
            gZenWorkspaces.changeWorkspaceShortcut(-1);
            break;
          case 'cmd_zenSplitViewGrid':
            gZenViewSplitter.toggleShortcut('grid');
            break;
          case 'cmd_zenSplitViewVertical':
            gZenViewSplitter.toggleShortcut('vsep');
            break;
          case 'cmd_zenSplitViewHorizontal':
            gZenViewSplitter.toggleShortcut('hsep');
            break;
          case 'cmd_zenSplitViewUnsplit':
            gZenViewSplitter.toggleShortcut('unsplit');
            break;
          case 'cmd_zenSplitViewContextMenu':
            gZenViewSplitter.contextSplitTabs();
            break;
          case 'cmd_zenCopyCurrentURLMarkdown':
            gZenCommonActions.copyCurrentURLAsMarkdownToClipboard();
            break;
          case 'cmd_zenCopyCurrentURL':
            gZenCommonActions.copyCurrentURLToClipboard();
            break;
          case 'cmd_zenPinnedTabReset':
            gZenPinnedTabManager.resetPinnedTab(gBrowser.selectedTab);
            break;
          case 'cmd_zenPinnedTabResetNoTab':
            gZenPinnedTabManager.resetPinnedTab();
            break;
          case 'cmd_zenToggleSidebar':
            gZenVerticalTabsManager.toggleExpand();
            break;
          case 'cmd_zenOpenZenThemePicker':
            gZenThemePicker.openThemePicker(event);
            break;
          case 'cmd_zenChangeWorkspaceTab':
            gZenWorkspaces.changeTabWorkspace(
              event.sourceEvent.target.getAttribute('zen-workspace-id')
            );
            break;
          case 'cmd_zenToggleTabsOnRight':
            gZenVerticalTabsManager.toggleTabsOnRight();
            break;
          case 'cmd_zenSplitViewLinkInNewTab':
            gZenViewSplitter.splitLinkInNewTab();
            break;
          case 'cmd_zenNewEmptySplit':
            setTimeout(() => {
              gZenViewSplitter.createEmptySplit();
            }, 0);
            break;
          case 'cmd_zenReplacePinnedUrlWithCurrent':
            gZenPinnedTabManager.replacePinnedUrlWithCurrent();
            break;
          case 'cmd_contextZenAddToEssentials':
            gZenPinnedTabManager.addToEssentials();
            break;
          case 'cmd_contextZenRemoveFromEssentials':
            gZenPinnedTabManager.removeEssentials();
            break;
          case 'cmd_zenCtxDeleteWorkspace':
            gZenWorkspaces.contextDeleteWorkspace(event);
            break;
          case 'cmd_zenChangeWorkspaceName':
            gZenVerticalTabsManager.renameTabStart({
              target: gZenWorkspaces.activeWorkspaceIndicator.querySelector(
                '.zen-current-workspace-indicator-name'
              ),
            });
            break;
          case 'cmd_zenChangeWorkspaceIcon':
            gZenWorkspaces.changeWorkspaceIcon();
            break;
          case 'cmd_zenReorderWorkspaces':
            gZenUIManager.showToast('zen-workspaces-how-to-reorder-title', {
              timeout: 9000,
              descriptionId: 'zen-workspaces-how-to-reorder-desc',
            });
            break;
          case 'cmd_zenOpenWorkspaceCreation':
            gZenWorkspaces.openWorkspaceCreation(event);
            break;
          case 'cmd_zenOpenFolderCreation':
            gZenFolders.createFolder([], {
              renameFolder: true,
            });
            break;
          case 'cmd_zenTogglePinTab': {
            const currentTab = gBrowser.selectedTab;
            if (currentTab && !currentTab.hasAttribute('zen-empty-tab')) {
              if (currentTab.pinned) {
                gBrowser.unpinTab(currentTab);
              } else {
                gBrowser.pinTab(currentTab);
              }
            }
            break;
          }
          default:
            gZenGlanceManager.handleMainCommandSet(event);
            if (event.target.id.startsWith('cmd_zenWorkspaceSwitch')) {
              const index = parseInt(event.target.id.replace('cmd_zenWorkspaceSwitch', ''), 10) - 1;
              gZenWorkspaces.shortcutSwitchTo(index);
            }
            break;
        }
      });
  },
  { once: true }
);
