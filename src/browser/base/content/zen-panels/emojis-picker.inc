# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

<panel type="arrow" orient="vertical" id="PanelUI-zen-emojis-picker" position="bottomright topright" side="bottom">
  <hbox id="PanelUI-zen-picker-header">
    <toolbarbutton class="toolbarbutton-1" />
    <hbox id="PanelUI-zen-emojis-buttons-wrapper">
      <toolbarbutton id="PanelUI-zen-emojis-picker-change-emojis" class="selected" data-l10n-id="zen-icons-picker-emoji" />
      <toolbarbutton id="PanelUI-zen-emojis-picker-change-svg" data-l10n-id="zen-icons-picker-svg" />
    </hbox>
    <toolbarbutton id="PanelUI-zen-emojis-picker-none" class="toolbarbutton-1" />
  </hbox>
  <hbox id="PanelUI-zen-emojis-picker-pages">
    <vbox emojis="true">
      <hbox id="PanelUI-zen-emojis-picker-header">
        <html:input type="search" id="PanelUI-zen-emojis-picker-search" data-l10n-id="zen-icons-picker-search-placeholder" />
      </hbox>
      <hbox id="PanelUI-zen-emojis-picker-category-selector">
        <toolbarbutton id="PanelUI-zen-emojis-picker-category-all"
                       class="selected"
                       data-zen-category="all"
                       data-l10n-id="zen-icons-picker-category-all" />
        <toolbarbutton id="PanelUI-zen-emojis-picker-category-essentials"
                       data-zen-category="essentials"
                       data-l10n-id="zen-icons-picker-category-essentials" />
        <toolbarbutton id="PanelUI-zen-emojis-picker-category-productivity"
                       data-zen-category="productivity"
                       data-l10n-id="zen-icons-picker-category-productivity" />
        <toolbarbutton id="PanelUI-zen-emojis-picker-category-festivals"
                       data-zen-category="festivals"
                       data-l10n-id="zen-icons-picker-category-festivals" />
        <toolbarbutton id="PanelUI-zen-emojis-picker-category-fun"
                       data-zen-category="fun"
                       data-l10n-id="zen-icons-picker-category-fun" />
      </hbox>
      <hbox id="PanelUI-zen-emojis-picker-list" />
    </vbox>
    <hbox svgs="true" id="PanelUI-zen-emojis-picker-svgs" />
  </hbox>
</panel>
