# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

<panel id="zen-unified-site-data-panel"
        role="group"
        type="arrow"
        noautofocus="true"
        position="bottomright topright">
  <panelmultiview mainViewId="unified-extensions-view">
# We'll keep the view with this name/id in order to prevent
# any sort of future issues we may have if firefox decides
# to change the functionality of this view
    <panelview id="unified-extensions-view"
                class="cui-widget-panelview"
                mainview-with-header="true">
      <hbox id="zen-site-data-header">
        <toolbarbutton id="zen-site-data-header-share"
                        data-l10n-id="zen-site-data-share"
                        flex="1" />
        <toolbarbutton id="zen-site-data-header-reader-mode"
                        command="View:ReaderView"
                        flex="1" />
        <toolbarbutton id="zen-site-data-header-screenshot"
                        command="Browser:Screenshot"
                        flex="1" />
        <toolbarbutton id="zen-site-data-header-bookmark"
                        command="Browser:AddBookmarkAs"
                        flex="1" />
      </hbox>
      <vbox class="zen-site-data-section">
        <hbox class="zen-site-data-section-header">
          <label data-l10n-id="unified-extensions-header-title" flex="1" />
          <label data-l10n-id="zen-generic-manage" id="zen-site-data-manage-addons" />
        </hbox>
        <hbox class="panel-subview-body" context="unified-extensions-context-menu" id="zen-site-data-addons">
          <html:div id="unified-extensions-messages-container">
            <!-- messages will be inserted here -->
          </html:div>

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
    </panelview>
  </panelmultiview>
</panel>