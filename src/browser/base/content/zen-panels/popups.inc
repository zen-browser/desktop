# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

<menupopup id="zenCreateNewPopup">
  <menuitem data-l10n-id="zen-panel-ui-workspaces-create" command="cmd_zenOpenWorkspaceCreation" image="chrome://browser/skin/zen-icons/duplicate-tab.svg" />
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
  <menuitem id="context_zenUnloadWorkspace" data-l10n-id="zen-workspaces-panel-unload" command="cmd_zenUnloadWorkspace"/>
  <menuitem id="context_zenUnloadAllOtherWorkspace" data-l10n-id="zen-workspaces-panel-unload-others" command="cmd_zenUnloadAllOtherWorkspace"/>
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
  id="PanelUI-zen-india-services"
  position="bottomright topright"
  side="bottom">
  <vbox id="PanelUI-zen-india-services-container">
    <label id="PanelUI-zen-india-services-title" value="India Services 🇮🇳" />
    <vbox id="PanelUI-zen-india-services-list">
      <toolbarbutton
        class="toolbarbutton-1 zen-india-services-item"
        label="IRCTC — Train booking"
        oncommand="openTrustedLinkIn('https://www.irctc.co.in','tab');" />
      <toolbarbutton
        class="toolbarbutton-1 zen-india-services-item"
        label="DigiLocker — Documents"
        oncommand="openTrustedLinkIn('https://www.digilocker.gov.in','tab');" />
      <toolbarbutton
        class="toolbarbutton-1 zen-india-services-item"
        label="BHIM UPI — Payments"
        oncommand="openTrustedLinkIn('https://www.bhimupi.org.in','tab');" />
      <toolbarbutton
        class="toolbarbutton-1 zen-india-services-item"
        label="UMANG — Government services"
        oncommand="openTrustedLinkIn('https://web.umang.gov.in','tab');" />
      <toolbarbutton
        class="toolbarbutton-1 zen-india-services-item"
        label="Income Tax"
        oncommand="openTrustedLinkIn('https://www.incometax.gov.in','tab');" />
      <toolbarbutton
        class="toolbarbutton-1 zen-india-services-item"
        label="Aadhaar"
        oncommand="openTrustedLinkIn('https://myaadhaar.uidai.gov.in','tab');" />
      <toolbarbutton
        class="toolbarbutton-1 zen-india-services-item"
        label="Passport Seva"
        oncommand="openTrustedLinkIn('https://passportindia.gov.in','tab');" />
      <toolbarbutton
        class="toolbarbutton-1 zen-india-services-item"
        label="EPFO"
        oncommand="openTrustedLinkIn('https://www.epfindia.gov.in','tab');" />
      <toolbarbutton
        class="toolbarbutton-1 zen-india-services-item"
        label="GST Portal — Tax filing"
        oncommand="openTrustedLinkIn('https://www.gst.gov.in','tab');" />
      <toolbarbutton
        class="toolbarbutton-1 zen-india-services-item"
        label="NPCI — Payments"
        oncommand="openTrustedLinkIn('https://www.npci.org.in','tab');" />
      <toolbarbutton
        class="toolbarbutton-1 zen-india-services-item"
        label="Scholarships — NSP"
        oncommand="openTrustedLinkIn('https://scholarships.gov.in','tab');" />
      <toolbarbutton
        class="toolbarbutton-1 zen-india-services-item"
        label="PM-KISAN — Farmers"
        oncommand="openTrustedLinkIn('https://pmkisan.gov.in','tab');" />
    </vbox>
  </vbox>
</panel>

<panel
  type="arrow"
  orient="vertical"
  id="PanelUI-zen-app-launcher"
  position="bottomright topright"
  side="bottom">
  <vbox id="PanelUI-zen-app-launcher-container">
    <label id="PanelUI-zen-app-launcher-title" value="Bharat Apps" />
    <vbox id="PanelUI-zen-app-launcher-list">

      <label class="zen-app-launcher-section-title" value="📧 Mail"/>
      <hbox class="zen-app-launcher-grid">
        <toolbarbutton class="zen-app-launcher-item" label="Gmail"
          oncommand="openTrustedLinkIn('https://gmail.com','tab');"/>
        <toolbarbutton class="zen-app-launcher-item" label="Outlook"
          oncommand="openTrustedLinkIn('https://outlook.com','tab');"/>
        <toolbarbutton class="zen-app-launcher-item" label="Zoho Mail"
          oncommand="openTrustedLinkIn('https://mail.zoho.in','tab');"/>
        <toolbarbutton class="zen-app-launcher-item" label="Yahoo Mail"
          oncommand="openTrustedLinkIn('https://mail.yahoo.com','tab');"/>
        <toolbarbutton class="zen-app-launcher-item" label="ProtonMail"
          oncommand="openTrustedLinkIn('https://proton.me','tab');"/>
      </hbox>

      <label class="zen-app-launcher-section-title" value="📹 Meetings"/>
      <hbox class="zen-app-launcher-grid">
        <toolbarbutton class="zen-app-launcher-item" label="Google Meet"
          oncommand="openTrustedLinkIn('https://meet.google.com','tab');"/>
        <toolbarbutton class="zen-app-launcher-item" label="Zoom"
          oncommand="openTrustedLinkIn('https://zoom.us','tab');"/>
        <toolbarbutton class="zen-app-launcher-item" label="MS Teams"
          oncommand="openTrustedLinkIn('https://teams.microsoft.com','tab');"/>
        <toolbarbutton class="zen-app-launcher-item" label="Webex"
          oncommand="openTrustedLinkIn('https://webex.com','tab');"/>
      </hbox>

      <label class="zen-app-launcher-section-title" value="💾 Storage"/>
      <hbox class="zen-app-launcher-grid">
        <toolbarbutton class="zen-app-launcher-item" label="Google Drive"
          oncommand="openTrustedLinkIn('https://drive.google.com','tab');"/>
        <toolbarbutton class="zen-app-launcher-item" label="OneDrive"
          oncommand="openTrustedLinkIn('https://onedrive.live.com','tab');"/>
        <toolbarbutton class="zen-app-launcher-item" label="Dropbox"
          oncommand="openTrustedLinkIn('https://dropbox.com','tab');"/>
        <toolbarbutton class="zen-app-launcher-item" label="Zoho Drive"
          oncommand="openTrustedLinkIn('https://workdrive.zoho.in','tab');"/>
      </hbox>

      <label class="zen-app-launcher-section-title" value="📝 Productivity"/>
      <hbox class="zen-app-launcher-grid">
        <toolbarbutton class="zen-app-launcher-item" label="Google Docs"
          oncommand="openTrustedLinkIn('https://docs.google.com','tab');"/>
        <toolbarbutton class="zen-app-launcher-item" label="Microsoft 365"
          oncommand="openTrustedLinkIn('https://microsoft365.com','tab');"/>
        <toolbarbutton class="zen-app-launcher-item" label="Notion"
          oncommand="openTrustedLinkIn('https://notion.so','tab');"/>
        <toolbarbutton class="zen-app-launcher-item" label="Canva"
          oncommand="openTrustedLinkIn('https://canva.com','tab');"/>
        <toolbarbutton class="zen-app-launcher-item" label="Zoho Docs"
          oncommand="openTrustedLinkIn('https://sheet.zoho.in','tab');"/>
      </hbox>

      <label class="zen-app-launcher-section-title" value="🎓 Education"/>
      <hbox class="zen-app-launcher-grid">
        <toolbarbutton class="zen-app-launcher-item" label="Classroom"
          oncommand="openTrustedLinkIn('https://classroom.google.com','tab');"/>
        <toolbarbutton class="zen-app-launcher-item" label="Teams EDU"
          oncommand="openTrustedLinkIn('https://teams.microsoft.com','tab');"/>
        <toolbarbutton class="zen-app-launcher-item" label="Zoom EDU"
          oncommand="openTrustedLinkIn('https://zoom.us/education','tab');"/>
        <toolbarbutton class="zen-app-launcher-item" label="SWAYAM"
          oncommand="openTrustedLinkIn('https://swayam.gov.in','tab');"/>
      </hbox>

      <label class="zen-app-launcher-section-title" value="🎵 Entertainment"/>
      <hbox class="zen-app-launcher-grid">
        <toolbarbutton class="zen-app-launcher-item" label="YouTube"
          oncommand="openTrustedLinkIn('https://youtube.com','tab');"/>
        <toolbarbutton class="zen-app-launcher-item" label="Spotify"
          oncommand="openTrustedLinkIn('https://spotify.com','tab');"/>
        <toolbarbutton class="zen-app-launcher-item" label="JioSaavn"
          oncommand="openTrustedLinkIn('https://jiosaavn.com','tab');"/>
        <toolbarbutton class="zen-app-launcher-item" label="JioHotstar"
          oncommand="openTrustedLinkIn('https://jiohotstar.com','tab');"/>
        <toolbarbutton class="zen-app-launcher-item" label="Netflix"
          oncommand="openTrustedLinkIn('https://netflix.com','tab');"/>
      </hbox>

      <label class="zen-app-launcher-section-title" value="🛒 Shopping"/>
      <hbox class="zen-app-launcher-grid">
        <toolbarbutton class="zen-app-launcher-item" label="Amazon"
          oncommand="openTrustedLinkIn('https://amazon.in','tab');"/>
        <toolbarbutton class="zen-app-launcher-item" label="Flipkart"
          oncommand="openTrustedLinkIn('https://flipkart.com','tab');"/>
        <toolbarbutton class="zen-app-launcher-item" label="Meesho"
          oncommand="openTrustedLinkIn('https://meesho.com','tab');"/>
        <toolbarbutton class="zen-app-launcher-item" label="Myntra"
          oncommand="openTrustedLinkIn('https://myntra.com','tab');"/>
      </hbox>

      <label class="zen-app-launcher-section-title" value="🇮🇳 Government"/>
      <hbox class="zen-app-launcher-grid">
        <toolbarbutton class="zen-app-launcher-item" label="IRCTC"
          oncommand="openTrustedLinkIn('https://irctc.co.in','tab');"/>
        <toolbarbutton class="zen-app-launcher-item" label="Income Tax"
          oncommand="openTrustedLinkIn('https://incometax.gov.in','tab');"/>
        <toolbarbutton class="zen-app-launcher-item" label="DigiLocker"
          oncommand="openTrustedLinkIn('https://digilocker.gov.in','tab');"/>
        <toolbarbutton class="zen-app-launcher-item" label="GST Portal"
          oncommand="openTrustedLinkIn('https://gst.gov.in','tab');"/>
        <toolbarbutton class="zen-app-launcher-item" label="EPFO"
          oncommand="openTrustedLinkIn('https://epfindia.gov.in','tab');"/>
      </hbox>

      <label class="zen-app-launcher-section-title" value="📰 News"/>
      <hbox class="zen-app-launcher-grid">
        <toolbarbutton class="zen-app-launcher-item" label="Inshorts"
          oncommand="openTrustedLinkIn('https://inshorts.com','tab');"/>
        <toolbarbutton class="zen-app-launcher-item" label="NDTV"
          oncommand="openTrustedLinkIn('https://ndtv.com','tab');"/>
        <toolbarbutton class="zen-app-launcher-item" label="TOI"
          oncommand="openTrustedLinkIn('https://timesofindia.com','tab');"/>
        <toolbarbutton class="zen-app-launcher-item" label="Google News"
          oncommand="openTrustedLinkIn('https://news.google.com','tab');"/>
      </hbox>

      <label class="zen-app-launcher-section-title" value="💼 Business"/>
      <hbox class="zen-app-launcher-grid">
        <toolbarbutton class="zen-app-launcher-item" label="LinkedIn"
          oncommand="openTrustedLinkIn('https://linkedin.com','tab');"/>
        <toolbarbutton class="zen-app-launcher-item" label="Slack"
          oncommand="openTrustedLinkIn('https://slack.com','tab');"/>
        <toolbarbutton class="zen-app-launcher-item" label="Freshdesk"
          oncommand="openTrustedLinkIn('https://freshdesk.com','tab');"/>
        <toolbarbutton class="zen-app-launcher-item" label="Trello"
          oncommand="openTrustedLinkIn('https://trello.com','tab');"/>
      </hbox>

    </vbox>
  </vbox>
</panel>
