# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

<menupopup id="zenSpaceQuickMenu">
  <menuitem data-l10n-id="zen-spaces-preset-study" command="cmd_zenCreateSpaceFromPreset" zen-space-preset="study" />
  <menuitem data-l10n-id="zen-spaces-preset-work" command="cmd_zenCreateSpaceFromPreset" zen-space-preset="work" />
  <menuitem data-l10n-id="zen-spaces-preset-personal" command="cmd_zenCreateSpaceFromPreset" zen-space-preset="personal" />
  <menuitem data-l10n-id="zen-spaces-preset-fun" command="cmd_zenCreateSpaceFromPreset" zen-space-preset="fun" />
  <menuitem data-l10n-id="zen-spaces-preset-banking" command="cmd_zenCreateSpaceFromPreset" zen-space-preset="banking" />
  <menuseparator/>
  <menuitem data-l10n-id="zen-panel-ui-workspaces-create" command="cmd_zenOpenWorkspaceCreation" image="chrome://browser/skin/zen-icons/duplicate-tab.svg" />
</menupopup>

<menupopup id="zenCreateNewPopup">
  <menuitem disabled="true" data-l10n-id="zen-create-new-section-spaces" />
  <menuitem data-l10n-id="zen-spaces-preset-study" command="cmd_zenCreateSpaceFromPreset" zen-space-preset="study" />
  <menuitem data-l10n-id="zen-spaces-preset-work" command="cmd_zenCreateSpaceFromPreset" zen-space-preset="work" />
  <menuitem data-l10n-id="zen-spaces-preset-personal" command="cmd_zenCreateSpaceFromPreset" zen-space-preset="personal" />
  <menuitem data-l10n-id="zen-spaces-preset-fun" command="cmd_zenCreateSpaceFromPreset" zen-space-preset="fun" />
  <menuitem data-l10n-id="zen-spaces-preset-banking" command="cmd_zenCreateSpaceFromPreset" zen-space-preset="banking" />
  <menuitem data-l10n-id="zen-panel-ui-workspaces-create-custom" command="cmd_zenOpenWorkspaceCreation" image="chrome://browser/skin/zen-icons/duplicate-tab.svg" />
  <menuseparator/>
  <menuitem disabled="true" data-l10n-id="zen-create-new-section-tabs" />
  <menuitem data-l10n-id="zen-panel-ui-folder-create" command="cmd_zenOpenFolderCreation" image="chrome://browser/skin/zen-icons/folder.svg" />
  <menu id="zen-panel-ui-folder-templates" data-l10n-id="zen-panel-ui-folder-templates" hidden="true">
    <menupopup>
      <menuitem
        id="zen-folder-template-workday"
        data-l10n-id="zen-folder-template-workday"
        command="cmd_zenCreateFolderFromTemplate"
        zen-folder-template="workday" />
      <menuitem
        id="zen-folder-template-research"
        data-l10n-id="zen-folder-template-research"
        command="cmd_zenCreateFolderFromTemplate"
        zen-folder-template="research" />
      <menuitem
        id="zen-folder-template-shopping"
        data-l10n-id="zen-folder-template-shopping"
        command="cmd_zenCreateFolderFromTemplate"
        zen-folder-template="shopping" />
    </menupopup>
  </menu>
  <menuseparator/>
  <menuitem data-l10n-id="zen-panel-ui-search-open-tabs" command="cmd_zenSearchOpenTabs" image="chrome://browser/skin/zen-icons/search-glass.svg" />
  <menuitem data-l10n-id="zen-panel-ui-new-empty-split" command="cmd_zenNewEmptySplit" image="chrome://browser/skin/zen-icons/split.svg" />
  <menuitem data-l10n-id="tabs-toolbar-new-tab" command="cmd_newNavigatorTab" image="chrome://browser/skin/zen-icons/plus.svg" />
</menupopup>

<menupopup id="zenWorkspaceMoreActions">
  <menuitem id="context_zenPeekWorkspace"
            data-l10n-id="astra-space-peek-open"
            oncommand="gZenWorkspaces.openAstraSpacePeek();"/>
  <menuitem id="context_zenEditWorkspace" data-l10n-id="zen-workspaces-panel-change-name" command="cmd_zenChangeWorkspaceName"/>
  <menuitem id="context_zenEditWorkspaceIcon" data-l10n-id="zen-workspaces-panel-change-icon" command="cmd_zenChangeWorkspaceIcon"/>
  <menuitem class="zenToolbarThemePicker"
          id="context_zenChangeWorkspaceTheme"
          data-l10n-id="zen-workspaces-change-theme"
          command="cmd_zenOpenZenThemePicker"/>
  <menuseparator/>
  <menuitem id="context_zenSetWorkspaceBg"
            label="Set Background Image 🖼️"
            command="cmd_zenSetWorkspaceBg"/>
  <menuitem id="context_zenRemoveWorkspaceBg"
            label="Remove Background Image"
            command="cmd_zenRemoveWorkspaceBg"/>
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
  <menuitem id="context_zenUnloadWorkspace" data-l10n-id="zen-workspaces-panel-unload" command="cmd_zenUnloadWorkspace"/>
  <menuitem id="context_zenUnloadAllOtherWorkspace" data-l10n-id="zen-workspaces-panel-unload-others" command="cmd_zenUnloadAllOtherWorkspace"/>
  <menuitem id="context_zenSmartSuspendNow" data-l10n-id="zen-workspaces-panel-smart-suspend" command="cmd_zenSmartSuspendNow"/>
  <menuitem id="context_zenUndoWorkspaceMove" data-l10n-id="zen-workspaces-panel-undo-last-move" command="cmd_zenUndoLastWorkspaceMove"/>
  <menuseparator/>
  <menuitem data-l10n-id="zen-panel-ui-workspaces-create" command="cmd_zenOpenWorkspaceCreation"/>
  <menuitem id="context_zenDeleteWorkspace" data-l10n-id="zen-workspaces-panel-context-delete" command="cmd_zenCtxDeleteWorkspace"/>
</menupopup>

<menupopup id="zenFolderActions">
  <menu id="context_zenLiveFolderOptions"
    data-l10n-id="zen-live-folder-options"
    hidden="true">
    <menupopup />
  </menu>
  <menuseparator id="live-folder-separator" hidden="true"/>
  <menuitem id="context_zenFolderRename" data-l10n-id="zen-folders-panel-rename-folder"/>
  <menuitem id="context_zenFolderChangeIcon" data-l10n-id="tab-context-zen-edit-icon"/>
  <menuseparator />
  <menuitem id="context_zenFolderUnloadAll" data-l10n-id="zen-folders-unload-folder"/>
  <menuitem id="context_zenFolderNewSubfolder" data-l10n-id="zen-folders-new-subfolder"/>
  <menuitem id="context_zenFolderOpenAll" data-l10n-id="zen-folders-open-all-tabs" hidden="true"/>
  <menuitem id="context_zenFolderDuplicate" data-l10n-id="zen-folders-duplicate-folder" hidden="true"/>
  <menuitem id="context_zenFolderCopyLinks" data-l10n-id="zen-folders-copy-links" hidden="true"/>
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

<menupopup id="zenSiteDataActions">
  <menuitem id="context_zenClearSiteData" data-l10n-id="identity-clear-site-data"/>
  <menuseparator />
  <menuitem command="Tools:Addons" data-l10n-id="zen-site-data-manage-addons"/>
  <menuitem id="context_zenOpenGetAddons" data-l10n-id="zen-site-data-get-addons"/>
  <menuseparator />
  <menuitem command="cmd_zenSmartGuardDetails" data-l10n-id="zen-smart-open-details"/>
  <menuseparator />
  <menuitem id="context_zenOpenSiteSettings" data-l10n-id="zen-site-data-site-settings"/>
</menupopup>

<menupopup id="zenMoveTabsToSyncedWorkspacePopup">
# Popup to move tabs to a synced workspace.
# This would be automatically populated with the list of available synced workspaces.
</menupopup>

<panel
  type="arrow"
  orient="vertical"
  id="PanelUI-astra-space-peek"
  class="astra-space-peek-panel"
  position="topcenter bottomleft"
  noautofocus="false"
  role="dialog"
  aria-labelledby="astra-space-peek-title">
  <vbox id="astra-space-peek-container" class="astra-space-peek-container">
    <hbox id="astra-space-peek-header" align="center">
      <label id="astra-space-peek-icon" class="astra-space-peek-icon"/>
      <vbox flex="1">
        <label id="astra-space-peek-title" class="astra-space-peek-title" crop="end"/>
        <label id="astra-space-peek-meta" class="astra-space-peek-meta" crop="end"/>
      </vbox>
    </hbox>
    <html:input
      type="search"
      id="astra-space-peek-search"
      class="astra-space-peek-search"
      data-l10n-id="astra-space-peek-search"/>
    <vbox id="astra-space-peek-list" class="astra-space-peek-list" flex="1"/>
    <hbox id="astra-space-peek-actions" class="astra-space-peek-actions">
      <toolbarbutton
        id="astra-space-peek-switch"
        class="subviewbutton"
        data-l10n-id="astra-space-peek-switch"/>
      <toolbarbutton
        id="astra-space-peek-move"
        class="subviewbutton"
        data-l10n-id="astra-space-peek-move"/>
      <toolbarbutton
        id="astra-space-peek-newtab"
        class="subviewbutton"
        data-l10n-id="astra-space-peek-newtab"/>
    </hbox>
  </vbox>
</panel>

<panel
  type="arrow"
  orient="vertical"
  id="PanelUI-zen-app-launcher"
  class="astra-app-hub-panel"
  position="bottomright topright"
  side="bottom"
  noautofocus="true"
  role="dialog"
  aria-labelledby="astra-app-hub-title"
  app-hub-mode="fallback">
  <vbox id="PanelUI-zen-app-launcher-container" class="astra-app-hub-container">
    <!-- Known-good static fallback (legacy 145f29e apps). Used when advanced manager is unavailable. -->
    <vbox id="PanelUI-zen-app-launcher-fallback">
      <label id="PanelUI-zen-app-launcher-title" value="Astra App Hub" />
      <vbox id="PanelUI-zen-app-launcher-fallback-list">


      <label class="zen-app-launcher-section-title" value="📧 Mail"/>
      <hbox class="zen-app-launcher-grid">
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://gmail.com"
          data-app-id="gmail"
          data-monogram="G"
          data-accent="mail"
          label="Gmail">
          <vbox class="zen-app-launcher-item-content">
            <stack class="zen-app-launcher-item-icon-stack">
              <html:img class="zen-app-launcher-item-icon"
                src="chrome://browser/content/zen-components/app-hub-icons/gmail.svg"
                alt="" draggable="false"/>
              <label class="zen-app-launcher-item-monogram" value="G"/>
            </stack>
            <label class="zen-app-launcher-item-name" value="Gmail"/>
          </vbox>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://outlook.com"
          data-app-id="outlook"
          data-monogram="O"
          data-accent="mail"
          label="Outlook">
          <vbox class="zen-app-launcher-item-content">
            <stack class="zen-app-launcher-item-icon-stack">
              <html:img class="zen-app-launcher-item-icon"
                src="chrome://browser/content/zen-components/app-hub-icons/outlook.svg"
                alt="" draggable="false"/>
              <label class="zen-app-launcher-item-monogram" value="O"/>
            </stack>
            <label class="zen-app-launcher-item-name" value="Outlook"/>
          </vbox>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://mail.zoho.in"
          data-app-id="zoho-mail"
          data-monogram="ZM"
          data-accent="mail"
          label="Zoho Mail">
          <vbox class="zen-app-launcher-item-content">
            <stack class="zen-app-launcher-item-icon-stack">
              <html:img class="zen-app-launcher-item-icon"
                src="chrome://browser/content/zen-components/app-hub-icons/zoho-mail.svg"
                alt="" draggable="false"/>
              <label class="zen-app-launcher-item-monogram" value="ZM"/>
            </stack>
            <label class="zen-app-launcher-item-name" value="Zoho Mail"/>
          </vbox>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://mail.yahoo.com"
          data-app-id="yahoo-mail"
          data-monogram="Y"
          data-accent="mail"
          label="Yahoo Mail">
          <vbox class="zen-app-launcher-item-content">
            <stack class="zen-app-launcher-item-icon-stack">
              <html:img class="zen-app-launcher-item-icon"
                src="chrome://browser/content/zen-components/app-hub-icons/yahoo-mail.svg"
                alt="" draggable="false"/>
              <label class="zen-app-launcher-item-monogram" value="Y"/>
            </stack>
            <label class="zen-app-launcher-item-name" value="Yahoo Mail"/>
          </vbox>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://proton.me"
          data-app-id="protonmail"
          data-monogram="P"
          data-accent="mail"
          label="ProtonMail">
          <vbox class="zen-app-launcher-item-content">
            <stack class="zen-app-launcher-item-icon-stack">
              <html:img class="zen-app-launcher-item-icon"
                src="chrome://browser/content/zen-components/app-hub-icons/proton-mail.svg"
                alt="" draggable="false"/>
              <label class="zen-app-launcher-item-monogram" value="P"/>
            </stack>
            <label class="zen-app-launcher-item-name" value="ProtonMail"/>
          </vbox>
        </toolbarbutton>
      </hbox>

      <label class="zen-app-launcher-section-title" value="📹 Meetings"/>
      <hbox class="zen-app-launcher-grid">
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://meet.google.com"
          data-app-id="google-meet"
          data-monogram="GM"
          data-accent="meetings"
          label="Google Meet">
          <vbox class="zen-app-launcher-item-content">
            <stack class="zen-app-launcher-item-icon-stack">
              <html:img class="zen-app-launcher-item-icon"
                src="chrome://browser/content/zen-components/app-hub-icons/google-meet.svg"
                alt="" draggable="false"/>
              <label class="zen-app-launcher-item-monogram" value="GM"/>
            </stack>
            <label class="zen-app-launcher-item-name" value="Google Meet"/>
          </vbox>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://zoom.us/join"
          data-app-id="zoom"
          data-monogram="Z"
          data-accent="meetings"
          label="Zoom">
          <vbox class="zen-app-launcher-item-content">
            <stack class="zen-app-launcher-item-icon-stack">
              <html:img class="zen-app-launcher-item-icon"
                src="chrome://browser/content/zen-components/app-hub-icons/zoom.svg"
                alt="" draggable="false"/>
              <label class="zen-app-launcher-item-monogram" value="Z"/>
            </stack>
            <label class="zen-app-launcher-item-name" value="Zoom"/>
          </vbox>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://teams.microsoft.com"
          data-app-id="ms-teams"
          data-monogram="MT"
          data-accent="meetings"
          label="MS Teams">
          <vbox class="zen-app-launcher-item-content">
            <stack class="zen-app-launcher-item-icon-stack">
              <html:img class="zen-app-launcher-item-icon"
                src="chrome://browser/content/zen-components/app-hub-icons/microsoft-teams.svg"
                alt="" draggable="false"/>
              <label class="zen-app-launcher-item-monogram" value="MT"/>
            </stack>
            <label class="zen-app-launcher-item-name" value="MS Teams"/>
          </vbox>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://webex.com"
          data-app-id="webex"
          data-monogram="W"
          data-accent="meetings"
          label="Webex">
          <vbox class="zen-app-launcher-item-content">
            <stack class="zen-app-launcher-item-icon-stack">
              <html:img class="zen-app-launcher-item-icon"
                src="chrome://browser/content/zen-components/app-hub-icons/webex.svg"
                alt="" draggable="false"/>
              <label class="zen-app-launcher-item-monogram" value="W"/>
            </stack>
            <label class="zen-app-launcher-item-name" value="Webex"/>
          </vbox>
        </toolbarbutton>
      </hbox>

      <label class="zen-app-launcher-section-title" value="💾 Storage"/>
      <hbox class="zen-app-launcher-grid">
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://drive.google.com"
          data-app-id="google-drive"
          data-monogram="GD"
          data-accent="storage"
          label="Google Drive">
          <vbox class="zen-app-launcher-item-content">
            <stack class="zen-app-launcher-item-icon-stack">
              <html:img class="zen-app-launcher-item-icon"
                src="chrome://browser/content/zen-components/app-hub-icons/google-drive.svg"
                alt="" draggable="false"/>
              <label class="zen-app-launcher-item-monogram" value="GD"/>
            </stack>
            <label class="zen-app-launcher-item-name" value="Google Drive"/>
          </vbox>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://onedrive.live.com"
          data-app-id="onedrive"
          data-monogram="OD"
          data-accent="storage"
          label="OneDrive">
          <vbox class="zen-app-launcher-item-content">
            <stack class="zen-app-launcher-item-icon-stack">
              <html:img class="zen-app-launcher-item-icon"
                src="chrome://browser/content/zen-components/app-hub-icons/onedrive.svg"
                alt="" draggable="false"/>
              <label class="zen-app-launcher-item-monogram" value="OD"/>
            </stack>
            <label class="zen-app-launcher-item-name" value="OneDrive"/>
          </vbox>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://dropbox.com"
          data-app-id="dropbox"
          data-monogram="D"
          data-accent="storage"
          label="Dropbox">
          <vbox class="zen-app-launcher-item-content">
            <stack class="zen-app-launcher-item-icon-stack">
              <html:img class="zen-app-launcher-item-icon"
                src="chrome://browser/content/zen-components/app-hub-icons/dropbox.svg"
                alt="" draggable="false"/>
              <label class="zen-app-launcher-item-monogram" value="D"/>
            </stack>
            <label class="zen-app-launcher-item-name" value="Dropbox"/>
          </vbox>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://workdrive.zoho.in"
          data-app-id="zoho-drive"
          data-monogram="ZD"
          data-accent="storage"
          label="Zoho Drive">
          <vbox class="zen-app-launcher-item-content">
            <stack class="zen-app-launcher-item-icon-stack">
              <html:img class="zen-app-launcher-item-icon"
                src="chrome://browser/content/zen-components/app-hub-icons/zoho-drive.svg"
                alt="" draggable="false"/>
              <label class="zen-app-launcher-item-monogram" value="ZD"/>
            </stack>
            <label class="zen-app-launcher-item-name" value="Zoho Drive"/>
          </vbox>
        </toolbarbutton>
      </hbox>

      <label class="zen-app-launcher-section-title" value="📝 Productivity"/>
      <hbox class="zen-app-launcher-grid">
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://docs.google.com"
          data-app-id="google-docs"
          data-monogram="Do"
          data-accent="productivity"
          label="Google Docs">
          <vbox class="zen-app-launcher-item-content">
            <stack class="zen-app-launcher-item-icon-stack">
              <html:img class="zen-app-launcher-item-icon"
                src="chrome://browser/content/zen-components/app-hub-icons/google-docs.svg"
                alt="" draggable="false"/>
              <label class="zen-app-launcher-item-monogram" value="Do"/>
            </stack>
            <label class="zen-app-launcher-item-name" value="Google Docs"/>
          </vbox>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://microsoft365.com"
          data-app-id="microsoft-365"
          data-monogram="M"
          data-accent="productivity"
          label="Microsoft 365">
          <vbox class="zen-app-launcher-item-content">
            <stack class="zen-app-launcher-item-icon-stack">
              <html:img class="zen-app-launcher-item-icon"
                src="chrome://browser/content/zen-components/app-hub-icons/microsoft-365.svg"
                alt="" draggable="false"/>
              <label class="zen-app-launcher-item-monogram" value="M"/>
            </stack>
            <label class="zen-app-launcher-item-name" value="Microsoft 365"/>
          </vbox>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://notion.so"
          data-app-id="notion"
          data-monogram="N"
          data-accent="productivity"
          label="Notion">
          <vbox class="zen-app-launcher-item-content">
            <stack class="zen-app-launcher-item-icon-stack">
              <html:img class="zen-app-launcher-item-icon"
                src="chrome://browser/content/zen-components/app-hub-icons/notion.svg"
                alt="" draggable="false"/>
              <label class="zen-app-launcher-item-monogram" value="N"/>
            </stack>
            <label class="zen-app-launcher-item-name" value="Notion"/>
          </vbox>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://canva.com"
          data-app-id="canva"
          data-monogram="C"
          data-accent="productivity"
          label="Canva">
          <vbox class="zen-app-launcher-item-content">
            <stack class="zen-app-launcher-item-icon-stack">
              <html:img class="zen-app-launcher-item-icon"
                src="chrome://browser/content/zen-components/app-hub-icons/canva.svg"
                alt="" draggable="false"/>
              <label class="zen-app-launcher-item-monogram" value="C"/>
            </stack>
            <label class="zen-app-launcher-item-name" value="Canva"/>
          </vbox>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://sheet.zoho.in"
          data-app-id="zoho-docs"
          data-monogram="Zo"
          data-accent="productivity"
          label="Zoho Docs">
          <vbox class="zen-app-launcher-item-content">
            <stack class="zen-app-launcher-item-icon-stack">
              <html:img class="zen-app-launcher-item-icon"
                src="chrome://browser/content/zen-components/app-hub-icons/zoho-docs.svg"
                alt="" draggable="false"/>
              <label class="zen-app-launcher-item-monogram" value="Zo"/>
            </stack>
            <label class="zen-app-launcher-item-name" value="Zoho Docs"/>
          </vbox>
        </toolbarbutton>
      </hbox>

      <label class="zen-app-launcher-section-title" value="🎓 Education"/>
      <hbox class="zen-app-launcher-grid">
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://classroom.google.com"
          data-app-id="classroom"
          data-monogram="Cl"
          data-accent="education"
          label="Classroom">
          <vbox class="zen-app-launcher-item-content">
            <stack class="zen-app-launcher-item-icon-stack">
              <html:img class="zen-app-launcher-item-icon"
                src="chrome://browser/content/zen-components/app-hub-icons/classroom.svg"
                alt="" draggable="false"/>
              <label class="zen-app-launcher-item-monogram" value="Cl"/>
            </stack>
            <label class="zen-app-launcher-item-name" value="Classroom"/>
          </vbox>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://teams.microsoft.com"
          data-app-id="teams-edu"
          data-monogram="TE"
          data-accent="education"
          label="Teams EDU">
          <vbox class="zen-app-launcher-item-content">
            <stack class="zen-app-launcher-item-icon-stack">
              <html:img class="zen-app-launcher-item-icon"
                src="chrome://browser/content/zen-components/app-hub-icons/teams-edu.svg"
                alt="" draggable="false"/>
              <label class="zen-app-launcher-item-monogram" value="TE"/>
            </stack>
            <label class="zen-app-launcher-item-name" value="Teams EDU"/>
          </vbox>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://zoom.us/education"
          data-app-id="zoom-edu"
          data-monogram="ZE"
          data-accent="education"
          label="Zoom EDU">
          <vbox class="zen-app-launcher-item-content">
            <stack class="zen-app-launcher-item-icon-stack">
              <html:img class="zen-app-launcher-item-icon"
                src="chrome://browser/content/zen-components/app-hub-icons/zoom-edu.svg"
                alt="" draggable="false"/>
              <label class="zen-app-launcher-item-monogram" value="ZE"/>
            </stack>
            <label class="zen-app-launcher-item-name" value="Zoom EDU"/>
          </vbox>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://swayam.gov.in"
          data-app-id="swayam"
          data-monogram="S"
          data-accent="education"
          label="SWAYAM">
          <vbox class="zen-app-launcher-item-content">
            <stack class="zen-app-launcher-item-icon-stack">
              <html:img class="zen-app-launcher-item-icon"
                src="chrome://browser/content/zen-components/app-hub-icons/swayam.svg"
                alt="" draggable="false"/>
              <label class="zen-app-launcher-item-monogram" value="S"/>
            </stack>
            <label class="zen-app-launcher-item-name" value="SWAYAM"/>
          </vbox>
        </toolbarbutton>
      </hbox>

      <label class="zen-app-launcher-section-title" value="🎵 Entertainment"/>
      <hbox class="zen-app-launcher-grid">
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://youtube.com"
          data-app-id="youtube"
          data-monogram="YT"
          data-accent="entertainment"
          label="YouTube">
          <vbox class="zen-app-launcher-item-content">
            <stack class="zen-app-launcher-item-icon-stack">
              <html:img class="zen-app-launcher-item-icon"
                src="chrome://browser/content/zen-components/app-hub-icons/youtube.svg"
                alt="" draggable="false"/>
              <label class="zen-app-launcher-item-monogram" value="YT"/>
            </stack>
            <label class="zen-app-launcher-item-name" value="YouTube"/>
          </vbox>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://spotify.com"
          data-app-id="spotify"
          data-monogram="Sp"
          data-accent="entertainment"
          label="Spotify">
          <vbox class="zen-app-launcher-item-content">
            <stack class="zen-app-launcher-item-icon-stack">
              <html:img class="zen-app-launcher-item-icon"
                src="chrome://browser/content/zen-components/app-hub-icons/spotify.svg"
                alt="" draggable="false"/>
              <label class="zen-app-launcher-item-monogram" value="Sp"/>
            </stack>
            <label class="zen-app-launcher-item-name" value="Spotify"/>
          </vbox>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://jiosaavn.com"
          data-app-id="jiosaavn"
          data-monogram="JS"
          data-accent="entertainment"
          label="JioSaavn">
          <vbox class="zen-app-launcher-item-content">
            <stack class="zen-app-launcher-item-icon-stack">
              <html:img class="zen-app-launcher-item-icon"
                src="chrome://browser/content/zen-components/app-hub-icons/jiosaavn.svg"
                alt="" draggable="false"/>
              <label class="zen-app-launcher-item-monogram" value="JS"/>
            </stack>
            <label class="zen-app-launcher-item-name" value="JioSaavn"/>
          </vbox>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://jiohotstar.com"
          data-app-id="jiohotstar"
          data-monogram="JH"
          data-accent="entertainment"
          label="JioHotstar">
          <vbox class="zen-app-launcher-item-content">
            <stack class="zen-app-launcher-item-icon-stack">
              <html:img class="zen-app-launcher-item-icon"
                src="chrome://browser/content/zen-components/app-hub-icons/jiohotstar.svg"
                alt="" draggable="false"/>
              <label class="zen-app-launcher-item-monogram" value="JH"/>
            </stack>
            <label class="zen-app-launcher-item-name" value="JioHotstar"/>
          </vbox>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://netflix.com"
          data-app-id="netflix"
          data-monogram="Nf"
          data-accent="entertainment"
          label="Netflix">
          <vbox class="zen-app-launcher-item-content">
            <stack class="zen-app-launcher-item-icon-stack">
              <html:img class="zen-app-launcher-item-icon"
                src="chrome://browser/content/zen-components/app-hub-icons/netflix.svg"
                alt="" draggable="false"/>
              <label class="zen-app-launcher-item-monogram" value="Nf"/>
            </stack>
            <label class="zen-app-launcher-item-name" value="Netflix"/>
          </vbox>
        </toolbarbutton>
      </hbox>

      <label class="zen-app-launcher-section-title" value="🛒 Shopping"/>
      <hbox class="zen-app-launcher-grid">
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://amazon.in"
          data-app-id="amazon"
          data-monogram="A"
          data-accent="shopping"
          label="Amazon">
          <vbox class="zen-app-launcher-item-content">
            <stack class="zen-app-launcher-item-icon-stack">
              <html:img class="zen-app-launcher-item-icon"
                src="chrome://browser/content/zen-components/app-hub-icons/amazon.svg"
                alt="" draggable="false"/>
              <label class="zen-app-launcher-item-monogram" value="A"/>
            </stack>
            <label class="zen-app-launcher-item-name" value="Amazon"/>
          </vbox>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://flipkart.com"
          data-app-id="flipkart"
          data-monogram="F"
          data-accent="shopping"
          label="Flipkart">
          <vbox class="zen-app-launcher-item-content">
            <stack class="zen-app-launcher-item-icon-stack">
              <html:img class="zen-app-launcher-item-icon"
                src="chrome://browser/content/zen-components/app-hub-icons/flipkart.svg"
                alt="" draggable="false"/>
              <label class="zen-app-launcher-item-monogram" value="F"/>
            </stack>
            <label class="zen-app-launcher-item-name" value="Flipkart"/>
          </vbox>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://meesho.com"
          data-app-id="meesho"
          data-monogram="Me"
          data-accent="shopping"
          label="Meesho">
          <vbox class="zen-app-launcher-item-content">
            <stack class="zen-app-launcher-item-icon-stack">
              <html:img class="zen-app-launcher-item-icon"
                src="chrome://browser/content/zen-components/app-hub-icons/meesho.svg"
                alt="" draggable="false"/>
              <label class="zen-app-launcher-item-monogram" value="Me"/>
            </stack>
            <label class="zen-app-launcher-item-name" value="Meesho"/>
          </vbox>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://myntra.com"
          data-app-id="myntra"
          data-monogram="My"
          data-accent="shopping"
          label="Myntra">
          <vbox class="zen-app-launcher-item-content">
            <stack class="zen-app-launcher-item-icon-stack">
              <html:img class="zen-app-launcher-item-icon"
                src="chrome://browser/content/zen-components/app-hub-icons/myntra.svg"
                alt="" draggable="false"/>
              <label class="zen-app-launcher-item-monogram" value="My"/>
            </stack>
            <label class="zen-app-launcher-item-name" value="Myntra"/>
          </vbox>
        </toolbarbutton>
      </hbox>

      <label class="zen-app-launcher-section-title" value="🇮🇳 Government"/>
      <hbox class="zen-app-launcher-grid">
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://irctc.co.in"
          data-app-id="irctc"
          data-monogram="I"
          data-accent="government"
          label="IRCTC">
          <vbox class="zen-app-launcher-item-content">
            <stack class="zen-app-launcher-item-icon-stack">
              <html:img class="zen-app-launcher-item-icon"
                src="chrome://browser/content/zen-components/app-hub-icons/irctc.svg"
                alt="" draggable="false"/>
              <label class="zen-app-launcher-item-monogram" value="I"/>
            </stack>
            <label class="zen-app-launcher-item-name" value="IRCTC"/>
          </vbox>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://incometax.gov.in"
          data-app-id="income-tax"
          data-monogram="IT"
          data-accent="government"
          label="Income Tax">
          <vbox class="zen-app-launcher-item-content">
            <stack class="zen-app-launcher-item-icon-stack">
              <html:img class="zen-app-launcher-item-icon"
                src="chrome://browser/content/zen-components/app-hub-icons/income-tax.svg"
                alt="" draggable="false"/>
              <label class="zen-app-launcher-item-monogram" value="IT"/>
            </stack>
            <label class="zen-app-launcher-item-name" value="Income Tax"/>
          </vbox>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://digilocker.gov.in"
          data-app-id="digilocker"
          data-monogram="DL"
          data-accent="government"
          label="DigiLocker">
          <vbox class="zen-app-launcher-item-content">
            <stack class="zen-app-launcher-item-icon-stack">
              <html:img class="zen-app-launcher-item-icon"
                src="chrome://browser/content/zen-components/app-hub-icons/digilocker.svg"
                alt="" draggable="false"/>
              <label class="zen-app-launcher-item-monogram" value="DL"/>
            </stack>
            <label class="zen-app-launcher-item-name" value="DigiLocker"/>
          </vbox>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://gst.gov.in"
          data-app-id="gst-portal"
          data-monogram="GST"
          data-accent="government"
          label="GST Portal">
          <vbox class="zen-app-launcher-item-content">
            <stack class="zen-app-launcher-item-icon-stack">
              <html:img class="zen-app-launcher-item-icon"
                src="chrome://browser/content/zen-components/app-hub-icons/gst-portal.svg"
                alt="" draggable="false"/>
              <label class="zen-app-launcher-item-monogram" value="GST"/>
            </stack>
            <label class="zen-app-launcher-item-name" value="GST Portal"/>
          </vbox>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://epfindia.gov.in"
          data-app-id="epfo"
          data-monogram="E"
          data-accent="government"
          label="EPFO">
          <vbox class="zen-app-launcher-item-content">
            <stack class="zen-app-launcher-item-icon-stack">
              <html:img class="zen-app-launcher-item-icon"
                src="chrome://browser/content/zen-components/app-hub-icons/epfo.svg"
                alt="" draggable="false"/>
              <label class="zen-app-launcher-item-monogram" value="E"/>
            </stack>
            <label class="zen-app-launcher-item-name" value="EPFO"/>
          </vbox>
        </toolbarbutton>
      </hbox>

      <label class="zen-app-launcher-section-title" value="📰 News"/>
      <hbox class="zen-app-launcher-grid">
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://inshorts.com"
          data-app-id="inshorts"
          data-monogram="In"
          data-accent="news"
          label="Inshorts">
          <vbox class="zen-app-launcher-item-content">
            <stack class="zen-app-launcher-item-icon-stack">
              <html:img class="zen-app-launcher-item-icon"
                src="chrome://browser/content/zen-components/app-hub-icons/inshorts.svg"
                alt="" draggable="false"/>
              <label class="zen-app-launcher-item-monogram" value="In"/>
            </stack>
            <label class="zen-app-launcher-item-name" value="Inshorts"/>
          </vbox>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://ndtv.com"
          data-app-id="ndtv"
          data-monogram="ND"
          data-accent="news"
          label="NDTV">
          <vbox class="zen-app-launcher-item-content">
            <stack class="zen-app-launcher-item-icon-stack">
              <html:img class="zen-app-launcher-item-icon"
                src="chrome://browser/content/zen-components/app-hub-icons/ndtv.svg"
                alt="" draggable="false"/>
              <label class="zen-app-launcher-item-monogram" value="ND"/>
            </stack>
            <label class="zen-app-launcher-item-name" value="NDTV"/>
          </vbox>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://timesofindia.com"
          data-app-id="toi"
          data-monogram="T"
          data-accent="news"
          label="TOI">
          <vbox class="zen-app-launcher-item-content">
            <stack class="zen-app-launcher-item-icon-stack">
              <html:img class="zen-app-launcher-item-icon"
                src="chrome://browser/content/zen-components/app-hub-icons/toi.svg"
                alt="" draggable="false"/>
              <label class="zen-app-launcher-item-monogram" value="T"/>
            </stack>
            <label class="zen-app-launcher-item-name" value="TOI"/>
          </vbox>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://news.google.com"
          data-app-id="google-news"
          data-monogram="GN"
          data-accent="news"
          label="Google News">
          <vbox class="zen-app-launcher-item-content">
            <stack class="zen-app-launcher-item-icon-stack">
              <html:img class="zen-app-launcher-item-icon"
                src="chrome://browser/content/zen-components/app-hub-icons/google-news.svg"
                alt="" draggable="false"/>
              <label class="zen-app-launcher-item-monogram" value="GN"/>
            </stack>
            <label class="zen-app-launcher-item-name" value="Google News"/>
          </vbox>
        </toolbarbutton>
      </hbox>

      <label class="zen-app-launcher-section-title" value="💼 Business"/>
      <hbox class="zen-app-launcher-grid">
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://linkedin.com"
          data-app-id="linkedin"
          data-monogram="L"
          data-accent="business"
          label="LinkedIn">
          <vbox class="zen-app-launcher-item-content">
            <stack class="zen-app-launcher-item-icon-stack">
              <html:img class="zen-app-launcher-item-icon"
                src="chrome://browser/content/zen-components/app-hub-icons/linkedin.svg"
                alt="" draggable="false"/>
              <label class="zen-app-launcher-item-monogram" value="L"/>
            </stack>
            <label class="zen-app-launcher-item-name" value="LinkedIn"/>
          </vbox>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://slack.com"
          data-app-id="slack"
          data-monogram="Sl"
          data-accent="business"
          label="Slack">
          <vbox class="zen-app-launcher-item-content">
            <stack class="zen-app-launcher-item-icon-stack">
              <html:img class="zen-app-launcher-item-icon"
                src="chrome://browser/content/zen-components/app-hub-icons/slack.svg"
                alt="" draggable="false"/>
              <label class="zen-app-launcher-item-monogram" value="Sl"/>
            </stack>
            <label class="zen-app-launcher-item-name" value="Slack"/>
          </vbox>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://freshdesk.com"
          data-app-id="freshdesk"
          data-monogram="Fr"
          data-accent="business"
          label="Freshdesk">
          <vbox class="zen-app-launcher-item-content">
            <stack class="zen-app-launcher-item-icon-stack">
              <html:img class="zen-app-launcher-item-icon"
                src="chrome://browser/content/zen-components/app-hub-icons/freshdesk.svg"
                alt="" draggable="false"/>
              <label class="zen-app-launcher-item-monogram" value="Fr"/>
            </stack>
            <label class="zen-app-launcher-item-name" value="Freshdesk"/>
          </vbox>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://trello.com"
          data-app-id="trello"
          data-monogram="Tr"
          data-accent="business"
          label="Trello">
          <vbox class="zen-app-launcher-item-content">
            <stack class="zen-app-launcher-item-icon-stack">
              <html:img class="zen-app-launcher-item-icon"
                src="chrome://browser/content/zen-components/app-hub-icons/trello.svg"
                alt="" draggable="false"/>
              <label class="zen-app-launcher-item-monogram" value="Tr"/>
            </stack>
            <label class="zen-app-launcher-item-name" value="Trello"/>
          </vbox>
        </toolbarbutton>
      </hbox>

    </vbox>
      </vbox>
    <!-- Advanced UI shell: header/search/footer built by AstraAppHubManager; list rendered from catalog. -->
    <vbox id="PanelUI-zen-app-launcher-list" class="astra-app-hub-list">
      <!-- Categories and apps rendered by AstraAppHubManager. -->
    </vbox>
  </vbox>
</panel>

<panel
  type="arrow"
  orient="vertical"
  id="PanelUI-astra-suraksha"
  class="astra-suraksha-panel"
  position="bottomright topright"
  side="bottom"
  noautofocus="true"
  role="dialog"
  aria-labelledby="astra-suraksha-title"
  astra-suraksha-mode="fallback">
  <html:div id="PanelUI-astra-suraksha-container" class="astra-suraksha-shell astra-suraksha-container">
    <html:header id="astra-suraksha-header" class="astra-suraksha-header">
      <html:span id="astra-suraksha-header-icon" class="astra-suraksha-header-icon" role="presentation"/>
      <html:div class="astra-suraksha-header-text">
        <html:h1 id="astra-suraksha-title"
                  data-l10n-id="astra-suraksha-title">Astra Suraksha</html:h1>
        <html:p id="astra-suraksha-mode-label"
                data-l10n-id="astra-suraksha-subtitle">Protection overview for this site</html:p>
      </html:div>
      <html:button id="astra-suraksha-refresh"
                   type="button"
                   class="astra-suraksha-icon-btn"
                   data-l10n-id="astra-suraksha-refresh"
                   title="Refresh"/>
    </html:header>

    <!-- Static fallback: usable with no manager/adapters.
         Emergency label= text remains if Fluent fails to load. -->
    <vbox id="PanelUI-astra-suraksha-fallback">
      <label class="astra-suraksha-section-title"
             value="Quick actions"
             data-l10n-id="astra-suraksha-section-fallback"/>
      <toolbarbutton class="astra-suraksha-action astra-suraksha-action-compact"
                     data-suraksha-action="protections-panel"
                     label="Open Firefox protection panel"
                     data-l10n-id="astra-suraksha-action-protections-panel"/>
      <toolbarbutton class="astra-suraksha-action astra-suraksha-action-compact"
                     data-suraksha-action="site-info"
                     label="Open site information"
                     data-l10n-id="astra-suraksha-action-site-info"/>
      <toolbarbutton class="astra-suraksha-action astra-suraksha-action-compact"
                     data-suraksha-action="protections-dashboard"
                     label="Open protection dashboard"
                     data-l10n-id="astra-suraksha-action-protections-dashboard"/>
      <toolbarbutton class="astra-suraksha-action astra-suraksha-action-compact"
                     data-suraksha-action="addons"
                     label="Open Add-ons Manager"
                     data-l10n-id="astra-suraksha-action-addons"/>
    </vbox>

    <!-- Advanced cards: HTML layout populated by lazy manager. -->
    <html:div id="PanelUI-astra-suraksha-advanced" class="astra-suraksha-advanced" hidden="true">
      <html:div class="astra-suraksha-scroll">
        <html:section class="astra-suraksha-site-hero" aria-label="Connection">
          <html:article id="astra-suraksha-card-connection"
                        class="astra-suraksha-card astra-suraksha-card-hero"
                        data-state="loading"
                        data-variant="loading">
            <html:div class="astra-suraksha-card-head">
              <html:span class="astra-suraksha-card-icon" data-icon="connection" role="presentation"/>
              <html:span class="astra-suraksha-hostname" data-l10n-id="astra-suraksha-hostname-unknown"/>
              <html:span class="astra-suraksha-card-status" data-l10n-id="astra-suraksha-loading"/>
            </html:div>
            <html:p class="astra-suraksha-card-detail" hidden="true"/>
            <html:div class="astra-suraksha-card-actions"/>
          </html:article>
        </html:section>

        <html:section class="astra-suraksha-section" aria-labelledby="astra-suraksha-section-protection">
          <html:h2 id="astra-suraksha-section-protection"
                   class="astra-suraksha-section-title"
                   data-l10n-id="astra-suraksha-section-protection"/>

          <html:article id="astra-suraksha-card-protection"
                        class="astra-suraksha-card"
                        data-state="loading"
                        data-variant="loading">
            <html:div class="astra-suraksha-card-head">
              <html:span class="astra-suraksha-card-icon" data-icon="protection" role="presentation"/>
              <html:span class="astra-suraksha-card-title" data-l10n-id="astra-suraksha-card-title-protection"/>
              <html:span class="astra-suraksha-card-status" data-l10n-id="astra-suraksha-loading"/>
            </html:div>
            <html:p class="astra-suraksha-card-detail" hidden="true"/>
            <html:div class="astra-suraksha-card-actions"/>
          </html:article>

          <html:article id="astra-suraksha-card-ublock"
                        class="astra-suraksha-card"
                        data-state="loading"
                        data-variant="loading">
            <html:div class="astra-suraksha-card-head">
              <html:span class="astra-suraksha-card-icon" data-icon="ublock" role="presentation"/>
              <html:span class="astra-suraksha-card-title" data-l10n-id="astra-suraksha-card-title-ublock"/>
              <html:span class="astra-suraksha-card-status" data-l10n-id="astra-suraksha-loading"/>
            </html:div>
            <html:p class="astra-suraksha-card-detail" hidden="true"/>
            <html:div class="astra-suraksha-card-actions"/>
          </html:article>

          <html:article id="astra-suraksha-card-safebrowsing"
                        class="astra-suraksha-card"
                        data-state="loading"
                        data-variant="loading">
            <html:div class="astra-suraksha-card-head">
              <html:span class="astra-suraksha-card-icon" data-icon="safebrowsing" role="presentation"/>
              <html:span class="astra-suraksha-card-title" data-l10n-id="astra-suraksha-card-title-safebrowsing"/>
              <html:span class="astra-suraksha-card-status" data-l10n-id="astra-suraksha-loading"/>
            </html:div>
            <html:p class="astra-suraksha-card-detail" hidden="true"/>
            <html:div id="astra-suraksha-card-safebrowsing-details"
                      class="astra-suraksha-card-details"
                      hidden="true"/>
            <html:div class="astra-suraksha-card-actions"/>
          </html:article>

          <html:article id="astra-suraksha-card-passwords"
                        class="astra-suraksha-card"
                        data-state="loading"
                        data-variant="loading">
            <html:div class="astra-suraksha-card-head">
              <html:span class="astra-suraksha-card-icon" data-icon="passwords" role="presentation"/>
              <html:span class="astra-suraksha-card-title" data-l10n-id="astra-suraksha-card-title-passwords"/>
              <html:span class="astra-suraksha-card-status" data-l10n-id="astra-suraksha-loading"/>
            </html:div>
            <html:p class="astra-suraksha-card-detail" hidden="true"/>
            <html:div id="astra-suraksha-card-passwords-details"
                      class="astra-suraksha-card-details"
                      hidden="true"/>
            <html:div class="astra-suraksha-card-actions"/>
          </html:article>
        </html:section>

        <html:section class="astra-suraksha-section" aria-labelledby="astra-suraksha-section-site-controls">
          <html:h2 id="astra-suraksha-section-site-controls"
                   class="astra-suraksha-section-title"
                   data-l10n-id="astra-suraksha-section-site-controls"/>

          <html:article id="astra-suraksha-card-permissions"
                        class="astra-suraksha-card"
                        data-state="loading"
                        data-variant="loading">
            <html:div class="astra-suraksha-card-head">
              <html:span class="astra-suraksha-card-icon" data-icon="permissions" role="presentation"/>
              <html:span class="astra-suraksha-card-title" data-l10n-id="astra-suraksha-card-title-permissions"/>
              <html:span class="astra-suraksha-card-status" data-l10n-id="astra-suraksha-loading"/>
            </html:div>
            <html:div class="astra-suraksha-perm-list"/>
            <html:div class="astra-suraksha-card-actions"/>
          </html:article>

          <html:article id="astra-suraksha-card-site-data"
                        class="astra-suraksha-card"
                        data-state="loading"
                        data-variant="loading">
            <html:div class="astra-suraksha-card-head">
              <html:span class="astra-suraksha-card-icon" data-icon="site-data" role="presentation"/>
              <html:span class="astra-suraksha-card-title" data-l10n-id="astra-suraksha-card-title-site-data"/>
              <html:span class="astra-suraksha-card-status" data-l10n-id="astra-suraksha-loading"/>
            </html:div>
            <html:div class="astra-suraksha-card-actions"/>
          </html:article>

          <html:article id="astra-suraksha-card-clean-link"
                        class="astra-suraksha-card"
                        data-state="loading"
                        data-variant="loading">
            <html:div class="astra-suraksha-card-head">
              <html:span class="astra-suraksha-card-icon" data-icon="clean-link" role="presentation"/>
              <html:span class="astra-suraksha-card-title" data-l10n-id="astra-suraksha-card-title-clean-link"/>
              <html:span class="astra-suraksha-card-status" data-l10n-id="astra-suraksha-loading"/>
            </html:div>
            <html:div class="astra-suraksha-card-actions"/>
          </html:article>
        </html:section>
      </html:div>

      <html:footer id="astra-suraksha-footer" class="astra-suraksha-footer">
        <html:button type="button"
                     class="astra-suraksha-footer-btn"
                     data-suraksha-action="safebrowsing-settings"
                     data-l10n-id="astra-suraksha-footer-privacy">Privacy</html:button>
        <html:button type="button"
                     class="astra-suraksha-footer-btn"
                     data-suraksha-action="etp-dashboard"
                     data-l10n-id="astra-suraksha-footer-dashboard">Dashboard</html:button>
        <html:button type="button"
                     class="astra-suraksha-footer-btn"
                     data-suraksha-action="addons"
                     data-l10n-id="astra-suraksha-footer-addons">Add-ons</html:button>
        <html:button type="button"
                     class="astra-suraksha-footer-btn"
                     data-suraksha-action="site-info"
                     data-l10n-id="astra-suraksha-footer-more">More</html:button>
      </html:footer>
    </html:div>
  </html:div>
</panel>

<panel
  type="arrow"
  orient="vertical"
  id="PanelUI-zen-india-gov"
  position="bottomright topright"
  side="bottom"
  noautofocus="true">
  <vbox id="PanelUI-zen-india-gov-container">
    <label id="PanelUI-zen-india-gov-title" value="🇮🇳 India Services" />
    <vbox id="PanelUI-zen-india-gov-list">
      <label class="zen-app-launcher-section-title" value="🚂 Travel"/>
      <hbox class="zen-app-launcher-grid">
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://www.irctc.co.in"
          oncommand="window.gZenIndiaGov.openApp('https://www.irctc.co.in');"
          style="list-style-image: url('https://www.irctc.co.in/favicon.ico')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="IRCTC"/>
        </toolbarbutton>
      </hbox>
      <label class="zen-app-launcher-section-title" value="🏛️ Government"/>
      <hbox class="zen-app-launcher-grid">
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://www.digilocker.gov.in"
          oncommand="window.gZenIndiaGov.openApp('https://www.digilocker.gov.in');"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=digilocker.gov.in&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="DigiLocker"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://www.incometax.gov.in"
          oncommand="window.gZenIndiaGov.openApp('https://www.incometax.gov.in');"
          style="list-style-image: url('https://www.incometax.gov.in/favicon.ico')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Income Tax"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://www.gst.gov.in"
          oncommand="window.gZenIndiaGov.openApp('https://www.gst.gov.in');"
          style="list-style-image: url('https://www.gst.gov.in/favicon.ico')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="GST Portal"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://epfindia.gov.in"
          oncommand="window.gZenIndiaGov.openApp('https://epfindia.gov.in');"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=epfindia.gov.in&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="EPFO"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://uidai.gov.in"
          oncommand="window.gZenIndiaGov.openApp('https://uidai.gov.in');"
          style="list-style-image: url('https://uidai.gov.in/images/logo/uidai_logo_english.svg')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Aadhaar"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://parivahan.gov.in"
          oncommand="window.gZenIndiaGov.openApp('https://parivahan.gov.in');"
          style="list-style-image: url('https://parivahan.gov.in/favicon.ico')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Parivahan/RTO"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://www.pan.utiitsl.com"
          oncommand="window.gZenIndiaGov.openApp('https://www.pan.utiitsl.com');"
          style="list-style-image: url('https://www.onlineservices.nsdl.com/favicon.ico')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="PAN Card"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://www.passportindia.gov.in"
          oncommand="window.gZenIndiaGov.openApp('https://www.passportindia.gov.in');"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=passportindia.gov.in&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Passport"/>
        </toolbarbutton>
      </hbox>
      <label class="zen-app-launcher-section-title" value="🎓 Education"/>
      <hbox class="zen-app-launcher-grid">
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://www.nta.ac.in"
          oncommand="window.gZenIndiaGov.openApp('https://www.nta.ac.in');"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=nta.ac.in&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="NTA"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://www.cbse.gov.in"
          oncommand="window.gZenIndiaGov.openApp('https://www.cbse.gov.in');"
          style="list-style-image: url('https://www.cbse.gov.in/favicon.ico')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="CBSE"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://www.upsc.gov.in"
          oncommand="window.gZenIndiaGov.openApp('https://www.upsc.gov.in');"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=upsc.gov.in&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="UPSC"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://ssc.gov.in"
          oncommand="window.gZenIndiaGov.openApp('https://ssc.gov.in');"
          style="list-style-image: url('https://ssc.nic.in/favicon.ico')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="SSC"/>
        </toolbarbutton>
      </hbox>
      <label class="zen-app-launcher-section-title" value="💼 Jobs"/>
      <hbox class="zen-app-launcher-grid">
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://www.ncs.gov.in"
          oncommand="window.gZenIndiaGov.openApp('https://www.ncs.gov.in');"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=ncs.gov.in&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="NCS Portal"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://unifiedportal-mem.epfindia.gov.in"
          oncommand="window.gZenIndiaGov.openApp('https://unifiedportal-mem.epfindia.gov.in');"
          style="list-style-image: url('https://unifiedportal-mem.epfindia.gov.in/favicon.ico')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="EPFO UAN"/>
        </toolbarbutton>
      </hbox>
      <label class="zen-app-launcher-section-title" value="🏥 Health"/>
      <hbox class="zen-app-launcher-grid">
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://pmjay.gov.in"
          oncommand="window.gZenIndiaGov.openApp('https://pmjay.gov.in');"
          style="list-style-image: url('https://pmjay.gov.in/favicon.ico')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Ayushman Bharat"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://janaushadhi.gov.in"
          oncommand="window.gZenIndiaGov.openApp('https://janaushadhi.gov.in');"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=janaushadhi.gov.in&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Jan Aushadhi"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://www.cowin.gov.in"
          oncommand="window.gZenIndiaGov.openApp('https://www.cowin.gov.in');"
          style="list-style-image: url('https://www.cowin.gov.in/favicon.ico')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="CoWIN"/>
        </toolbarbutton>
      </hbox>
    </vbox>
  </vbox>
</panel>

<panel
  type="arrow"
  orient="vertical"
  id="PanelUI-zen-crash-recovery"
  position="bottomright topright"
  side="bottom"
  noautofocus="true">
  <vbox id="PanelUI-zen-crash-recovery-container">
    <label id="PanelUI-zen-crash-recovery-title" data-l10n-id="zen-crash-recovery-title" />
    <description id="PanelUI-zen-crash-recovery-description" data-l10n-id="zen-crash-recovery-description" />
    <hbox class="zen-crash-recovery-buttons">
      <button class="footer-button primary"
              command="cmd_zenCrashRestoreSession"
              data-l10n-id="zen-crash-recovery-restore-session" />
      <button class="footer-button"
              command="cmd_zenCrashRestoreWorkspace"
              data-l10n-id="zen-crash-recovery-restore-workspace" />
    </hbox>
  </vbox>
</panel>

<panel
  type="arrow"
  orient="vertical"
  id="PanelUI-zen-tab-notes"
  position="bottomright topright"
  side="bottom"
  noautofocus="false">
  <vbox id="PanelUI-zen-tab-notes-container">
    <hbox class="zen-tab-notes-header">
      <label id="zen-tab-notes-title" value="📝 Tab Note" />
    </hbox>
    <html:textarea
      id="zen-tab-notes-textarea"
      class="zen-tab-notes-textarea"
      rows="8"
      cols="30"
      placeholder="Write your note here..." />
    <hbox class="zen-tab-notes-buttons">
      <button class="zen-tab-notes-save footer-button primary"
              label="Save Note"
              data-action="saveNote" />
      <button class="zen-tab-notes-clear footer-button"
              label="Clear"
              data-action="clearNote" />
    </hbox>
  </vbox>
</panel>
