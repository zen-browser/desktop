# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

<panel id="PanelUI-zen-boost-editor" type="arrow" orient="vertical">
  <panelmultiview id="PanelUI-zen-boost-editor-multiview" mainViewId="PanelUI-zen-boost-editor-view">
    <panelview id="PanelUI-zen-boost-editor-view" class="PanelUI-subView zen-theme-picker" role="document" mainview-with-header="true" has-custom-header="true">
      <vbox flex="1" id="PanelUI-zen-boost-filter-wrapper">

        <hbox flex="1" id="PanelUI-zen-boost-font-wrapper">
          <html:input data-l10n="PanelUI-zen-boost-name" type="text" value="New Boost" minlength="1" maxlength="12" width="50" id="PanelUI-zen-boost-name"/>
          <button data-l10n="PanelUI-zen-boost-delete" id="PanelUI-zen-boost-delete" class="subviewbutton"></button>
        </hbox>

        <hbox class="zen-boost-color-picker-gradient">
          <div class="zen-boost-color-picker-dot"></div>
        </hbox>

        <!-- <html:input type="range" max="1" value="1" step="0.05" id="PanelUI-zen-boost-contrast" min="0.5"/>
        <html:input type="range" max="360" value="0" step="5" id="PanelUI-zen-boost-hue-shift" min="0"/>
        <html:input type="range" max="1" value="1" step="0.1" id="PanelUI-zen-boost-saturation" min="0"/> -->
        
        <hbox flex="1" id="PanelUI-zen-boost-toolbar-wrapper">
          <button data-l10n="PanelUI-zen-boost-invert" id="PanelUI-zen-boost-invert" class="subviewbutton"></button>
          <button data-l10n="PanelUI-zen-boost-zap" id="PanelUI-zen-boost-zap" class="subviewbutton"></button>
          <button data-l10n="PanelUI-zen-boost-disable" id="PanelUI-zen-boost-disable" class="subviewbutton"></button>
        </hbox>

        <separator/>

        <hbox flex="1" id="PanelUI-zen-boost-font-wrapper">
          <button data-l10n="PanelUI-zen-boost-font-arial" id="PanelUI-zen-boost-font-arial" class="subviewbutton">Aa</button>
          <button data-l10n="PanelUI-zen-boost-font-serif" id="PanelUI-zen-boost-font-serif" class="subviewbutton">Aa</button>
          <button data-l10n="PanelUI-zen-boost-font-mono" id="PanelUI-zen-boost-font-mono" class="subviewbutton">Aa</button>
          <button data-l10n="PanelUI-zen-boost-font-georgia" id="PanelUI-zen-boost-font-georgia" class="subviewbutton">Aa</button>
        </hbox>
        <hbox flex="1" id="PanelUI-zen-boost-font-wrapper">
          <button data-l10n="PanelUI-zen-boost-font-comic" id="PanelUI-zen-boost-font-comic" class="subviewbutton">Aa</button>
          <button data-l10n="PanelUI-zen-boost-font-tahoma" id="PanelUI-zen-boost-font-tahoma" class="subviewbutton">Aa</button>
          <button data-l10n="PanelUI-zen-boost-font-verdana" id="PanelUI-zen-boost-font-verdana" class="subviewbutton">Aa</button>
          <button data-l10n="PanelUI-zen-boost-font-corsiva" id="PanelUI-zen-boost-font-corsiva" class="subviewbutton">Aa</button>
        </hbox>
        
      </vbox>
    </panelview>
  </panelmultiview>
</panel>