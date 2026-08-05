# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

<panel type="arrow" orient="vertical" id="PanelUI-zen-emojis-picker" position="bottomright topright" side="bottom">
  <hbox id="PanelUI-zen-picker-header">
    <toolbarbutton class="toolbarbutton-1" />
    <hbox id="PanelUI-zen-emojis-buttons-wrapper">
      <toolbarbutton id="PanelUI-zen-emojis-picker-change-emojis" class="selected" data-l10n-id="zen-icons-picker-emoji" />
      <toolbarbutton id="PanelUI-zen-emojis-picker-change-svg" data-l10n-id="zen-icons-picker-svg" />
      <toolbarbutton id="PanelUI-zen-emojis-picker-change-custom" data-l10n-id="zen-icons-picker-custom" />
    </hbox>
    <toolbarbutton id="PanelUI-zen-emojis-picker-none" class="toolbarbutton-1" />
  </hbox>
  <hbox id="PanelUI-zen-emojis-picker-pages">
    <vbox page="emojis">
      <hbox id="PanelUI-zen-emojis-picker-header">
        <html:input type="search" id="PanelUI-zen-emojis-picker-search" data-l10n-id="zen-emojis-picker-search" />
      </hbox>
      <hbox id="PanelUI-zen-emojis-picker-list" />
    </vbox>
    <hbox page="svg" id="PanelUI-zen-emojis-picker-svgs" />
    <vbox page="custom" id="PanelUI-zen-emojis-picker-custom">
      <html:img id="PanelUI-zen-emojis-picker-custom-preview" hidden="true" alt="" />
      <button id="PanelUI-zen-emojis-picker-custom-choose" class="footer-button" data-l10n-id="zen-icons-picker-custom-choose" />
      <description id="PanelUI-zen-emojis-picker-custom-hint" data-l10n-id="zen-icons-picker-custom-hint" />
    </vbox>
  </hbox>
</panel>
