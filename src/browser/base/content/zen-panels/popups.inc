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
  position="after_start"
  side="bottom"
  noautofocus="true">
  <vbox id="PanelUI-zen-app-launcher-container">
    <label id="PanelUI-zen-app-launcher-title" value="Astra App Hub 🚀" />
    <vbox id="PanelUI-zen-app-launcher-list">

      <label class="zen-app-launcher-section-title" value="📧 Mail"/>
      <hbox class="zen-app-launcher-grid">
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="gZenAppLauncher.openApp('https://gmail.com');"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=gmail.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Gmail"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="gZenAppLauncher.openApp('https://outlook.com');"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=outlook.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Outlook"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="gZenAppLauncher.openApp('https://mail.zoho.in');"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=mail.zoho.in&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Zoho Mail"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="gZenAppLauncher.openApp('https://mail.yahoo.com');"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=mail.yahoo.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Yahoo Mail"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="gZenAppLauncher.openApp('https://proton.me');"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=proton.me&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="ProtonMail"/>
        </toolbarbutton>
      </hbox>

      <label class="zen-app-launcher-section-title" value="📹 Meetings"/>
      <hbox class="zen-app-launcher-grid">
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="gZenAppLauncher.openApp('https://meet.google.com');"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=meet.google.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Google Meet"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="gZenAppLauncher.openApp('https://zoom.us');"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=zoom.us&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Zoom"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="gZenAppLauncher.openApp('https://teams.microsoft.com');"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=teams.microsoft.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="MS Teams"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="gZenAppLauncher.openApp('https://webex.com');"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=webex.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Webex"/>
        </toolbarbutton>
      </hbox>

      <label class="zen-app-launcher-section-title" value="💾 Storage"/>
      <hbox class="zen-app-launcher-grid">
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="gZenAppLauncher.openApp('https://drive.google.com');"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=drive.google.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Google Drive"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="gZenAppLauncher.openApp('https://onedrive.live.com');"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=onedrive.live.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="OneDrive"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="gZenAppLauncher.openApp('https://dropbox.com');"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=dropbox.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Dropbox"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="gZenAppLauncher.openApp('https://workdrive.zoho.in');"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=workdrive.zoho.in&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Zoho Drive"/>
        </toolbarbutton>
      </hbox>

      <label class="zen-app-launcher-section-title" value="📝 Productivity"/>
      <hbox class="zen-app-launcher-grid">
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="gZenAppLauncher.openApp('https://docs.google.com');"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=docs.google.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Google Docs"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="gZenAppLauncher.openApp('https://microsoft365.com');"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=microsoft365.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Microsoft 365"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="gZenAppLauncher.openApp('https://notion.so');"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=notion.so&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Notion"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="gZenAppLauncher.openApp('https://canva.com');"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=canva.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Canva"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="gZenAppLauncher.openApp('https://sheet.zoho.in');"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=sheet.zoho.in&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Zoho Docs"/>
        </toolbarbutton>
      </hbox>

      <label class="zen-app-launcher-section-title" value="🎓 Education"/>
      <hbox class="zen-app-launcher-grid">
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="gZenAppLauncher.openApp('https://classroom.google.com');"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=classroom.google.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Classroom"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="gZenAppLauncher.openApp('https://teams.microsoft.com');"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=teams.microsoft.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Teams EDU"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="gZenAppLauncher.openApp('https://zoom.us/education');"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=zoom.us&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Zoom EDU"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="gZenAppLauncher.openApp('https://swayam.gov.in');"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=swayam.gov.in&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="SWAYAM"/>
        </toolbarbutton>
      </hbox>

      <label class="zen-app-launcher-section-title" value="🎵 Entertainment"/>
      <hbox class="zen-app-launcher-grid">
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="gZenAppLauncher.openApp('https://youtube.com');"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=youtube.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="YouTube"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="gZenAppLauncher.openApp('https://spotify.com');"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=spotify.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Spotify"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="gZenAppLauncher.openApp('https://jiosaavn.com');"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=jiosaavn.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="JioSaavn"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="gZenAppLauncher.openApp('https://jiohotstar.com');"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=jiohotstar.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="JioHotstar"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="gZenAppLauncher.openApp('https://netflix.com');"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=netflix.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Netflix"/>
        </toolbarbutton>
      </hbox>

      <label class="zen-app-launcher-section-title" value="🛒 Shopping"/>
      <hbox class="zen-app-launcher-grid">
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="gZenAppLauncher.openApp('https://amazon.in');"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=amazon.in&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Amazon"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="gZenAppLauncher.openApp('https://flipkart.com');"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=flipkart.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Flipkart"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="gZenAppLauncher.openApp('https://meesho.com');"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=meesho.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Meesho"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="gZenAppLauncher.openApp('https://myntra.com');"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=myntra.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Myntra"/>
        </toolbarbutton>
      </hbox>

      <label class="zen-app-launcher-section-title" value="🇮🇳 Government"/>
      <hbox class="zen-app-launcher-grid">
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="gZenAppLauncher.openApp('https://irctc.co.in');"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=irctc.co.in&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="IRCTC"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="gZenAppLauncher.openApp('https://incometax.gov.in');"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=incometax.gov.in&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Income Tax"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="gZenAppLauncher.openApp('https://digilocker.gov.in');"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=digilocker.gov.in&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="DigiLocker"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="gZenAppLauncher.openApp('https://gst.gov.in');"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=gst.gov.in&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="GST Portal"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="gZenAppLauncher.openApp('https://epfindia.gov.in');"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=epfindia.gov.in&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="EPFO"/>
        </toolbarbutton>
      </hbox>

      <label class="zen-app-launcher-section-title" value="📰 News"/>
      <hbox class="zen-app-launcher-grid">
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="gZenAppLauncher.openApp('https://inshorts.com');"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=inshorts.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Inshorts"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="gZenAppLauncher.openApp('https://ndtv.com');"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=ndtv.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="NDTV"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="gZenAppLauncher.openApp('https://timesofindia.com');"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=timesofindia.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="TOI"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="gZenAppLauncher.openApp('https://news.google.com');"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=news.google.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Google News"/>
        </toolbarbutton>
      </hbox>

      <label class="zen-app-launcher-section-title" value="💼 Business"/>
      <hbox class="zen-app-launcher-grid">
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="gZenAppLauncher.openApp('https://linkedin.com');"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=linkedin.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="LinkedIn"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="gZenAppLauncher.openApp('https://slack.com');"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=slack.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Slack"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="gZenAppLauncher.openApp('https://freshdesk.com');"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=freshdesk.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Freshdesk"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="gZenAppLauncher.openApp('https://trello.com');"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=trello.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Trello"/>
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
              oncommand="gZenTabNotes.saveNote();" />
      <button class="zen-tab-notes-clear footer-button"
              label="Clear"
              oncommand="gZenTabNotes.clearNote();" />
    </hbox>
  </vbox>
</panel>
