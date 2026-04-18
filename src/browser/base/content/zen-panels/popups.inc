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
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="openTrustedLinkIn('https://gmail.com','tab'); document.getElementById('PanelUI-zen-app-launcher').hidePopup();"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=gmail.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Gmail"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="openTrustedLinkIn('https://outlook.com','tab'); document.getElementById('PanelUI-zen-app-launcher').hidePopup();"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=outlook.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Outlook"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="openTrustedLinkIn('https://mail.zoho.in','tab'); document.getElementById('PanelUI-zen-app-launcher').hidePopup();"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=mail.zoho.in&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Zoho Mail"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="openTrustedLinkIn('https://mail.yahoo.com','tab'); document.getElementById('PanelUI-zen-app-launcher').hidePopup();"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=mail.yahoo.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Yahoo Mail"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="openTrustedLinkIn('https://proton.me','tab'); document.getElementById('PanelUI-zen-app-launcher').hidePopup();"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=proton.me&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="ProtonMail"/>
        </toolbarbutton>
      </hbox>

      <label class="zen-app-launcher-section-title" value="📹 Meetings"/>
      <hbox class="zen-app-launcher-grid">
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="openTrustedLinkIn('https://meet.google.com','tab'); document.getElementById('PanelUI-zen-app-launcher').hidePopup();"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=meet.google.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Google Meet"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="openTrustedLinkIn('https://zoom.us','tab'); document.getElementById('PanelUI-zen-app-launcher').hidePopup();"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=zoom.us&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Zoom"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="openTrustedLinkIn('https://teams.microsoft.com','tab'); document.getElementById('PanelUI-zen-app-launcher').hidePopup();"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=teams.microsoft.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="MS Teams"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="openTrustedLinkIn('https://webex.com','tab'); document.getElementById('PanelUI-zen-app-launcher').hidePopup();"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=webex.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Webex"/>
        </toolbarbutton>
      </hbox>

      <label class="zen-app-launcher-section-title" value="💾 Storage"/>
      <hbox class="zen-app-launcher-grid">
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="openTrustedLinkIn('https://drive.google.com','tab'); document.getElementById('PanelUI-zen-app-launcher').hidePopup();"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=drive.google.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Google Drive"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="openTrustedLinkIn('https://onedrive.live.com','tab'); document.getElementById('PanelUI-zen-app-launcher').hidePopup();"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=onedrive.live.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="OneDrive"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="openTrustedLinkIn('https://dropbox.com','tab'); document.getElementById('PanelUI-zen-app-launcher').hidePopup();"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=dropbox.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Dropbox"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="openTrustedLinkIn('https://workdrive.zoho.in','tab'); document.getElementById('PanelUI-zen-app-launcher').hidePopup();"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=workdrive.zoho.in&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Zoho Drive"/>
        </toolbarbutton>
      </hbox>

      <label class="zen-app-launcher-section-title" value="📝 Productivity"/>
      <hbox class="zen-app-launcher-grid">
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="openTrustedLinkIn('https://docs.google.com','tab'); document.getElementById('PanelUI-zen-app-launcher').hidePopup();"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=docs.google.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Google Docs"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="openTrustedLinkIn('https://microsoft365.com','tab'); document.getElementById('PanelUI-zen-app-launcher').hidePopup();"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=microsoft365.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Microsoft 365"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="openTrustedLinkIn('https://notion.so','tab'); document.getElementById('PanelUI-zen-app-launcher').hidePopup();"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=notion.so&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Notion"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="openTrustedLinkIn('https://canva.com','tab'); document.getElementById('PanelUI-zen-app-launcher').hidePopup();"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=canva.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Canva"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="openTrustedLinkIn('https://sheet.zoho.in','tab'); document.getElementById('PanelUI-zen-app-launcher').hidePopup();"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=sheet.zoho.in&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Zoho Docs"/>
        </toolbarbutton>
      </hbox>

      <label class="zen-app-launcher-section-title" value="🎓 Education"/>
      <hbox class="zen-app-launcher-grid">
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="openTrustedLinkIn('https://classroom.google.com','tab'); document.getElementById('PanelUI-zen-app-launcher').hidePopup();"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=classroom.google.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Classroom"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="openTrustedLinkIn('https://teams.microsoft.com','tab'); document.getElementById('PanelUI-zen-app-launcher').hidePopup();"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=teams.microsoft.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Teams EDU"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="openTrustedLinkIn('https://zoom.us/education','tab'); document.getElementById('PanelUI-zen-app-launcher').hidePopup();"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=zoom.us&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Zoom EDU"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="openTrustedLinkIn('https://swayam.gov.in','tab'); document.getElementById('PanelUI-zen-app-launcher').hidePopup();"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=swayam.gov.in&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="SWAYAM"/>
        </toolbarbutton>
      </hbox>

      <label class="zen-app-launcher-section-title" value="🎵 Entertainment"/>
      <hbox class="zen-app-launcher-grid">
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="openTrustedLinkIn('https://youtube.com','tab'); document.getElementById('PanelUI-zen-app-launcher').hidePopup();"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=youtube.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="YouTube"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="openTrustedLinkIn('https://spotify.com','tab'); document.getElementById('PanelUI-zen-app-launcher').hidePopup();"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=spotify.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Spotify"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="openTrustedLinkIn('https://jiosaavn.com','tab'); document.getElementById('PanelUI-zen-app-launcher').hidePopup();"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=jiosaavn.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="JioSaavn"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="openTrustedLinkIn('https://jiohotstar.com','tab'); document.getElementById('PanelUI-zen-app-launcher').hidePopup();"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=jiohotstar.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="JioHotstar"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="openTrustedLinkIn('https://netflix.com','tab'); document.getElementById('PanelUI-zen-app-launcher').hidePopup();"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=netflix.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Netflix"/>
        </toolbarbutton>
      </hbox>

      <label class="zen-app-launcher-section-title" value="🛒 Shopping"/>
      <hbox class="zen-app-launcher-grid">
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="openTrustedLinkIn('https://amazon.in','tab'); document.getElementById('PanelUI-zen-app-launcher').hidePopup();"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=amazon.in&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Amazon"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="openTrustedLinkIn('https://flipkart.com','tab'); document.getElementById('PanelUI-zen-app-launcher').hidePopup();"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=flipkart.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Flipkart"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="openTrustedLinkIn('https://meesho.com','tab'); document.getElementById('PanelUI-zen-app-launcher').hidePopup();"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=meesho.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Meesho"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="openTrustedLinkIn('https://myntra.com','tab'); document.getElementById('PanelUI-zen-app-launcher').hidePopup();"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=myntra.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Myntra"/>
        </toolbarbutton>
      </hbox>

      <label class="zen-app-launcher-section-title" value="🇮🇳 Government"/>
      <hbox class="zen-app-launcher-grid">
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="openTrustedLinkIn('https://irctc.co.in','tab'); document.getElementById('PanelUI-zen-app-launcher').hidePopup();"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=irctc.co.in&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="IRCTC"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="openTrustedLinkIn('https://incometax.gov.in','tab'); document.getElementById('PanelUI-zen-app-launcher').hidePopup();"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=incometax.gov.in&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Income Tax"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="openTrustedLinkIn('https://digilocker.gov.in','tab'); document.getElementById('PanelUI-zen-app-launcher').hidePopup();"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=digilocker.gov.in&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="DigiLocker"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="openTrustedLinkIn('https://gst.gov.in','tab'); document.getElementById('PanelUI-zen-app-launcher').hidePopup();"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=gst.gov.in&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="GST Portal"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="openTrustedLinkIn('https://epfindia.gov.in','tab'); document.getElementById('PanelUI-zen-app-launcher').hidePopup();"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=epfindia.gov.in&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="EPFO"/>
        </toolbarbutton>
      </hbox>

      <label class="zen-app-launcher-section-title" value="📰 News"/>
      <hbox class="zen-app-launcher-grid">
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="openTrustedLinkIn('https://inshorts.com','tab'); document.getElementById('PanelUI-zen-app-launcher').hidePopup();"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=inshorts.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Inshorts"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="openTrustedLinkIn('https://ndtv.com','tab'); document.getElementById('PanelUI-zen-app-launcher').hidePopup();"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=ndtv.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="NDTV"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="openTrustedLinkIn('https://timesofindia.com','tab'); document.getElementById('PanelUI-zen-app-launcher').hidePopup();"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=timesofindia.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="TOI"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="openTrustedLinkIn('https://news.google.com','tab'); document.getElementById('PanelUI-zen-app-launcher').hidePopup();"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=news.google.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Google News"/>
        </toolbarbutton>
      </hbox>

      <label class="zen-app-launcher-section-title" value="💼 Business"/>
      <hbox class="zen-app-launcher-grid">
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="openTrustedLinkIn('https://linkedin.com','tab'); document.getElementById('PanelUI-zen-app-launcher').hidePopup();"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=linkedin.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="LinkedIn"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="openTrustedLinkIn('https://slack.com','tab'); document.getElementById('PanelUI-zen-app-launcher').hidePopup();"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=slack.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Slack"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="openTrustedLinkIn('https://freshdesk.com','tab'); document.getElementById('PanelUI-zen-app-launcher').hidePopup();"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=freshdesk.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Freshdesk"/>
        </toolbarbutton>
        <toolbarbutton class="zen-app-launcher-item"
          oncommand="openTrustedLinkIn('https://trello.com','tab'); document.getElementById('PanelUI-zen-app-launcher').hidePopup();"
          style="list-style-image: url('https://www.google.com/s2/favicons?domain=trello.com&amp;sz=32')">
          <image class="zen-app-launcher-item-icon"/>
          <label class="zen-app-launcher-item-label" value="Trello"/>
        </toolbarbutton>
      </hbox>

    </vbox>
  </vbox>
</panel>
