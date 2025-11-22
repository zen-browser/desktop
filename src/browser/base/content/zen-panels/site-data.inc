# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

<panel id="zen-unified-site-data-panel"
        role="group"
        type="arrow"
        noautofocus="true">
  <panelmultiview mainViewId="unified-extensions-view">
# We'll keep the view with this name/id in order to prevent
# any sort of future issues we may have if firefox decides
# to change the functionality of this view
    <panelview id="unified-extensions-view"
                class="cui-widget-panelview"
                mainview-with-header="true">
      <hbox id="zen-site-data-header">
        <toolbarbutton id="zen-site-data-header-share"
                        data-l10n-id="zen-site-data-header-share"
                        flex="1"
                        closemenu="none" />
        <toolbarbutton id="zen-site-data-header-reader-mode"
                        data-l10n-id="zen-site-data-header-reader-mode"
                        command="View:ReaderView"
                        tooltip="dynamic-shortcut-tooltip"
                        flex="1" />
        <toolbarbutton id="zen-site-data-header-screenshot"
                        data-l10n-id="zen-site-data-header-screenshot"
                        command="Browser:Screenshot"
                        flex="1" />
        <toolbarbutton id="zen-site-data-header-bookmark"
                        data-l10n-id="zen-site-data-header-bookmark"
                        command="Browser:AddBookmarkAs"
                        flex="1" />
      </hbox>
      <vbox class="zen-site-data-section">
        <hbox class="zen-site-data-section-header">
          <label data-l10n-id="unified-extensions-header-title" flex="1" />
          <label data-l10n-id="zen-generic-manage" id="zen-site-data-manage-addons" />
        </hbox>
        <hbox class="panel-subview-body" context="unified-extensions-context-menu" id="zen-site-data-addons">
          <vbox id="overflowed-extensions-list">
            <!-- overflowed extension buttons from the nav-bar will go here -->
          </vbox>

          <vbox id="unified-extensions-area">
            <!-- default area for extension browser action buttons -->
          </vbox>

          <vbox class="unified-extensions-list">
            <!-- active visible extensions go here -->
          </vbox>

          <vbox id="zen-site-data-new-addon-button-container">
            <toolbarbutton id="zen-site-data-new-addon-button"
                  class="subviewbutton toolbarbutton-1" />
          </vbox>

# We don't really use this, but again, to keep firefox happy
# in case they decide to change something for this specific
# empty state, we keep it on the DOM
# https://searchfox.org/firefox-main/rev/e613f4df351a21871cfeadf7d5b4043ffad157b1/browser/components/customizableui/content/panelUI.inc.xhtml#101-106
          <vbox id="unified-extensions-empty-state" context="">
            <!-- Shown when no extensions are listed. -->
            <html:img src="chrome://browser/skin/addons/extensions-panel-empty-illustration.svg" loading="lazy" />
            <html:h2 class="subview-subheader" />
            <description />
          </vbox>
        </hbox>

# Keep this button on the DOM even though we hide it for ever,
# again, to keep firefox happy if they decide to change functionality
# for this specific button / id
        <toolbarbutton id="unified-extensions-manage-extensions"
                        class="subviewbutton panel-subview-footer-button unified-extensions-manage-extensions"
                        data-l10n-id="unified-extensions-manage-extensions" 
                        hidden="true" />
      </vbox>
      <vbox class="zen-site-data-section">
        <hbox class="zen-site-data-section-header">
          <label data-l10n-id="zen-site-data-settings" flex="1" />
          <label data-l10n-id="zen-generic-more" id="zen-site-data-settings-more" />
        </hbox>
        <vbox id="zen-site-data-settings-list">
          <!-- settings will be inserted here -->
        </vbox>
      </vbox>
      <hbox id="zen-site-data-footer">
        <toolbarbutton id="zen-site-data-security-info" 
                       class="subviewbutton zen-interactive-button" />
        <toolbarbutton id="zen-site-data-actions"
                       class="subviewbutton zen-interactive-button"
                       closemenu="none"
                       context="zenSiteDataActions" />
      </hbox>
# Messages will be inserted here.
# Dont write anything directly here, even comments, as this may break the layout
      <html:div id="unified-extensions-messages-container"></html:div>
    </panelview>
  </panelmultiview>
</panel>