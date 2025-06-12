# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

<menupopup id="zenCreateNewPopup">
  <menuitem data-l10n-id="tabs-toolbar-new-tab" command="cmd_newNavigatorTab" image="chrome://browser/skin/zen-icons/plus.svg" />
  <menuseparator/>
  <menuitem data-l10n-id="zen-panel-ui-workspaces-create" command="cmd_zenOpenWorkspaceCreation" image="chrome://browser/skin/zen-icons/duplicate-tab.svg" />
</menupopup>

<menupopup id="zenWorkspaceMoreActions">
  <menuitem id="context_zenEditWorkspace" data-l10n-id="zen-workspaces-panel-change-name" command="cmd_zenChangeWorkspaceName"/>
  <menuitem id="context_zenEditWorkspaceIcon" data-l10n-id="zen-workspaces-panel-change-icon" command="cmd_zenChangeWorkspaceIcon"/>
  <menuitem class="zenToolbarThemePicker"
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
  <menuseparator/>
  <menuitem id="context_zenReorderWorkspaces" data-l10n-id="zen-workspaces-panel-context-reorder" command="cmd_zenReorderWorkspaces"/>
  <menuseparator/>
  <menuitem id="context_zenDeleteWorkspace" data-l10n-id="zen-workspaces-panel-context-delete" command="cmd_zenCtxDeleteWorkspace"/>
</menupopup>
