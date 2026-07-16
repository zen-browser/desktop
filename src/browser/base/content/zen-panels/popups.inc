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
          data-url="https://gmail.com">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Gmail"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://outlook.com">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Outlook"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://mail.zoho.in">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Zoho Mail"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://mail.yahoo.com">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Yahoo Mail"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://proton.me">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="ProtonMail"/>
        </toolbarbutton>
      </hbox>

      <label class="zen-app-launcher-section-title" value="📹 Meetings"/>
      <hbox class="zen-app-launcher-grid">
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://meet.google.com">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Google Meet"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://zoom.us/join">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Zoom"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://teams.microsoft.com">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="MS Teams"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://webex.com">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Webex"/>
        </toolbarbutton>
      </hbox>

      <label class="zen-app-launcher-section-title" value="💾 Storage"/>
      <hbox class="zen-app-launcher-grid">
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://drive.google.com">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Google Drive"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://onedrive.live.com">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="OneDrive"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://dropbox.com">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Dropbox"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://workdrive.zoho.in">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Zoho Drive"/>
        </toolbarbutton>
      </hbox>

      <label class="zen-app-launcher-section-title" value="📝 Productivity"/>
      <hbox class="zen-app-launcher-grid">
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://docs.google.com">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Google Docs"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://microsoft365.com">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Microsoft 365"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://notion.so">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Notion"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://canva.com">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Canva"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://sheet.zoho.in">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Zoho Docs"/>
        </toolbarbutton>
      </hbox>

      <label class="zen-app-launcher-section-title" value="🎓 Education"/>
      <hbox class="zen-app-launcher-grid">
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://classroom.google.com">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Classroom"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://teams.microsoft.com">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Teams EDU"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://zoom.us/education">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Zoom EDU"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://swayam.gov.in">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="SWAYAM"/>
        </toolbarbutton>
      </hbox>

      <label class="zen-app-launcher-section-title" value="🎵 Entertainment"/>
      <hbox class="zen-app-launcher-grid">
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://youtube.com">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="YouTube"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://spotify.com">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Spotify"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://jiosaavn.com">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="JioSaavn"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://jiohotstar.com">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="JioHotstar"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://netflix.com">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Netflix"/>
        </toolbarbutton>
      </hbox>

      <label class="zen-app-launcher-section-title" value="🛒 Shopping"/>
      <hbox class="zen-app-launcher-grid">
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://amazon.in">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Amazon"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://flipkart.com">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Flipkart"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://meesho.com">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Meesho"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://myntra.com">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Myntra"/>
        </toolbarbutton>
      </hbox>

      <label class="zen-app-launcher-section-title" value="🇮🇳 Government"/>
      <hbox class="zen-app-launcher-grid">
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://irctc.co.in">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="IRCTC"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://incometax.gov.in">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Income Tax"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://digilocker.gov.in">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="DigiLocker"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://gst.gov.in">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="GST Portal"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://epfindia.gov.in">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="EPFO"/>
        </toolbarbutton>
      </hbox>

      <label class="zen-app-launcher-section-title" value="📰 News"/>
      <hbox class="zen-app-launcher-grid">
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://inshorts.com">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Inshorts"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://ndtv.com">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="NDTV"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://timesofindia.com">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="TOI"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://news.google.com">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Google News"/>
        </toolbarbutton>
      </hbox>

      <label class="zen-app-launcher-section-title" value="💼 Business"/>
      <hbox class="zen-app-launcher-grid">
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://linkedin.com">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="LinkedIn"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://slack.com">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Slack"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://freshdesk.com">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Freshdesk"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          data-url="https://trello.com">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Trello"/>
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
  <vbox id="PanelUI-astra-suraksha-container" class="astra-suraksha-container">
    <hbox id="astra-suraksha-header" class="astra-suraksha-header" align="center">
      <image id="astra-suraksha-header-icon" class="astra-suraksha-header-icon"/>
      <vbox flex="1" class="astra-suraksha-header-text">
        <label id="astra-suraksha-title"
               value="Astra Suraksha"
               data-l10n-id="astra-suraksha-title"/>
        <label id="astra-suraksha-mode-label"
               value="Protection overview for this site"
               data-l10n-id="astra-suraksha-subtitle"/>
      </vbox>
      <toolbarbutton id="astra-suraksha-refresh"
                     class="astra-suraksha-icon-btn"
                     data-l10n-id="astra-suraksha-refresh"/>
    </hbox>

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

    <!-- Advanced cards: populated by lazy manager. -->
    <vbox id="PanelUI-astra-suraksha-advanced" class="astra-suraksha-advanced" hidden="true">
      <vbox id="astra-suraksha-card-connection"
            class="astra-suraksha-card astra-suraksha-card-hero"
            data-state="loading"
            data-variant="loading">
        <hbox class="astra-suraksha-card-head" align="center">
          <image class="astra-suraksha-card-icon" data-icon="connection"/>
          <vbox flex="1" class="astra-suraksha-card-head-text">
            <label class="astra-suraksha-hostname" data-l10n-id="astra-suraksha-hostname-unknown"/>
            <label class="astra-suraksha-card-status" data-l10n-id="astra-suraksha-loading"/>
          </vbox>
        </hbox>
        <label class="astra-suraksha-card-detail" hidden="true"/>
        <hbox class="astra-suraksha-card-actions"/>
      </vbox>

      <label class="astra-suraksha-section-title" data-l10n-id="astra-suraksha-section-protection"/>
      <vbox id="astra-suraksha-card-protection" class="astra-suraksha-card" data-state="loading" data-variant="loading">
        <hbox class="astra-suraksha-card-head" align="center">
          <image class="astra-suraksha-card-icon" data-icon="protection"/>
          <label class="astra-suraksha-card-title" data-l10n-id="astra-suraksha-card-title-protection"/>
          <label class="astra-suraksha-card-status" data-l10n-id="astra-suraksha-loading"/>
        </hbox>
        <label class="astra-suraksha-card-detail" hidden="true"/>
        <hbox class="astra-suraksha-card-actions"/>
      </vbox>
      <vbox id="astra-suraksha-card-ublock" class="astra-suraksha-card" data-state="loading" data-variant="loading">
        <hbox class="astra-suraksha-card-head" align="center">
          <image class="astra-suraksha-card-icon" data-icon="ublock"/>
          <label class="astra-suraksha-card-title" data-l10n-id="astra-suraksha-card-title-ublock"/>
          <label class="astra-suraksha-card-status" data-l10n-id="astra-suraksha-loading"/>
        </hbox>
        <label class="astra-suraksha-card-detail" hidden="true"/>
        <hbox class="astra-suraksha-card-actions"/>
      </vbox>
      <vbox id="astra-suraksha-card-safebrowsing" class="astra-suraksha-card" data-state="loading" data-variant="loading">
        <hbox class="astra-suraksha-card-head" align="center">
          <image class="astra-suraksha-card-icon" data-icon="safebrowsing"/>
          <label class="astra-suraksha-card-title" data-l10n-id="astra-suraksha-card-title-safebrowsing"/>
          <label class="astra-suraksha-card-status" data-l10n-id="astra-suraksha-loading"/>
        </hbox>
        <label class="astra-suraksha-card-detail" hidden="true"/>
        <vbox id="astra-suraksha-card-safebrowsing-details"
              class="astra-suraksha-card-details"
              hidden="true"/>
        <hbox class="astra-suraksha-card-actions"/>
      </vbox>
      <vbox id="astra-suraksha-card-passwords" class="astra-suraksha-card" data-state="loading" data-variant="loading">
        <hbox class="astra-suraksha-card-head" align="center">
          <image class="astra-suraksha-card-icon" data-icon="passwords"/>
          <label class="astra-suraksha-card-title" data-l10n-id="astra-suraksha-card-title-passwords"/>
          <label class="astra-suraksha-card-status" data-l10n-id="astra-suraksha-loading"/>
        </hbox>
        <label class="astra-suraksha-card-detail" hidden="true"/>
        <vbox id="astra-suraksha-card-passwords-details"
              class="astra-suraksha-card-details"
              hidden="true"/>
        <hbox class="astra-suraksha-card-actions"/>
      </vbox>

      <label class="astra-suraksha-section-title" data-l10n-id="astra-suraksha-section-site-controls"/>
      <vbox id="astra-suraksha-card-permissions" class="astra-suraksha-card" data-state="loading" data-variant="loading">
        <hbox class="astra-suraksha-card-head" align="center">
          <image class="astra-suraksha-card-icon" data-icon="permissions"/>
          <label class="astra-suraksha-card-title" data-l10n-id="astra-suraksha-card-title-permissions"/>
          <label class="astra-suraksha-card-status" data-l10n-id="astra-suraksha-loading"/>
        </hbox>
        <vbox class="astra-suraksha-perm-list"/>
        <hbox class="astra-suraksha-card-actions"/>
      </vbox>
      <vbox id="astra-suraksha-card-site-data" class="astra-suraksha-card" data-state="loading" data-variant="loading">
        <hbox class="astra-suraksha-card-head" align="center">
          <image class="astra-suraksha-card-icon" data-icon="site-data"/>
          <label class="astra-suraksha-card-title" data-l10n-id="astra-suraksha-card-title-site-data"/>
          <label class="astra-suraksha-card-status" data-l10n-id="astra-suraksha-loading"/>
        </hbox>
        <hbox class="astra-suraksha-card-actions"/>
      </vbox>
      <vbox id="astra-suraksha-card-clean-link" class="astra-suraksha-card" data-state="loading" data-variant="loading">
        <hbox class="astra-suraksha-card-head" align="center">
          <image class="astra-suraksha-card-icon" data-icon="clean-link"/>
          <label class="astra-suraksha-card-title" data-l10n-id="astra-suraksha-card-title-clean-link"/>
          <label class="astra-suraksha-card-status" data-l10n-id="astra-suraksha-loading"/>
        </hbox>
        <hbox class="astra-suraksha-card-actions"/>
      </vbox>

      <hbox id="astra-suraksha-footer" class="astra-suraksha-footer">
        <toolbarbutton class="astra-suraksha-footer-btn"
                       data-suraksha-action="safebrowsing-settings"
                       data-l10n-id="astra-suraksha-footer-privacy"/>
        <toolbarbutton class="astra-suraksha-footer-btn"
                       data-suraksha-action="etp-dashboard"
                       data-l10n-id="astra-suraksha-footer-dashboard"/>
        <toolbarbutton class="astra-suraksha-footer-btn"
                       data-suraksha-action="addons"
                       data-l10n-id="astra-suraksha-footer-addons"/>
        <toolbarbutton class="astra-suraksha-footer-btn"
                       data-suraksha-action="site-info"
                       data-l10n-id="astra-suraksha-footer-more"/>
      </hbox>
    </vbox>
  </vbox>
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
