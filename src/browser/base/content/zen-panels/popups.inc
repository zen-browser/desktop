# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

<menupopup id="zenCreateNewPopup">
  <menuitem data-l10n-id="zen-panel-ui-workspaces-create" command="cmd_zenOpenWorkspaceCreation" image="chrome://browser/skin/zen-icons/duplicate-tab.svg" />
  <menuitem data-l10n-id="zen-panel-ui-folder-create" command="cmd_zenOpenFolderCreation" image="chrome://browser/skin/zen-icons/folder.svg" />
  <menuseparator/>
  <menuitem data-l10n-id="zen-panel-ui-new-empty-split" command="cmd_zenNewEmptySplit" image="chrome://browser/skin/zen-icons/split.svg" />
  <menuitem data-l10n-id="tabs-toolbar-new-tab" command="cmd_newNavigatorTab" image="chrome://browser/skin/zen-icons/plus.svg" />
</menupopup>

<menupopup id="zenWorkspaceMoreActions">
  <menuitem id="context_zenEditWorkspace" data-l10n-id="zen-workspaces-panel-change-name" command="cmd_zenChangeWorkspaceName"/>
  <menuitem id="context_zenEditWorkspaceIcon" data-l10n-id="zen-workspaces-panel-change-icon" command="cmd_zenChangeWorkspaceIcon"/>
  <menuitem class="zenToolbarThemePicker"
          id="context_zenChangeWorkspaceTheme"
          data-l10n-id="zen-workspaces-change-theme"
          command="cmd_zenOpenZenThemePicker"/>
  <menu id="context_zenWorkspacesOpenInContainerTab"
    data-l10n-id="zen-workspaces-panel-context-default-profile"
    selection-type="single"
    node-type="link"
    hide-if-private-browsing="true"
    hide-if-usercontext-disabled="true">
    <menupopup />
  </menu>
  <menuseparator id="context_zenWorkspacesSeparator"/>
  <menuseparator/>
  <menuitem id="context_zenReorderWorkspaces" data-l10n-id="zen-workspaces-panel-context-reorder" command="cmd_zenReorderWorkspaces"/>
  <menuseparator/>
  <menuitem data-l10n-id="zen-panel-ui-workspaces-create" command="cmd_zenOpenWorkspaceCreation"/>
  <menuitem id="context_zenDeleteWorkspace" data-l10n-id="zen-workspaces-panel-context-delete" command="cmd_zenCtxDeleteWorkspace"/>
</menupopup>

<menupopup id="zenFolderActions">
  <menuitem id="context_zenFolderRename" data-l10n-id="zen-folders-panel-rename-folder"/>
  <menuitem id="context_zenFolderChangeIcon" data-l10n-id="zen-folders-panel-change-icon-folder"/>
  <menuseparator />
  <menuitem id="context_zenFolderUnloadAll" data-l10n-id="zen-folders-unload-folder"/>
  <menuitem id="context_zenFolderNewSubfolder" data-l10n-id="zen-folders-new-subfolder"/>
  <menuseparator />
  <menu id="context_zenChangeFolderSpace"
    data-l10n-id="zen-folders-panel-change-folder-space">
    <menupopup />
  </menu>
  <menuitem id="context_zenFolderToSpace" data-l10n-id="zen-folders-panel-convert-folder-to-space" />
  <menuseparator />
  <menuitem id="context_zenFolderUnpack" data-l10n-id="zen-folders-panel-unpack-folder"/>
  <menuitem id="context_zenFolderDelete" data-l10n-id="zen-folders-panel-delete-folder"/>
</menupopup>
