# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

<panel flip="side" type="arrow" popupalign="center" orient="vertical" id="PanelUI-zen-gradient-generator" position="bottomright topright" mainview="true" side="left">
  <panelmultiview id="PanelUI-zen-gradient-generator-multiview" mainViewId="PanelUI-zen-gradient-generator-view">
    <panelview id="PanelUI-zen-gradient-generator-view" class="PanelUI-subView zen-theme-picker" role="document" mainview-with-header="true" has-custom-header="true">
      <hbox class="zen-theme-picker-gradient">
        <hbox id="PanelUI-zen-gradient-generator-scheme">
          <button id="PanelUI-zen-gradient-generator-scheme-auto" class="subviewbutton"/>
          <button id="PanelUI-zen-gradient-generator-scheme-light" class="subviewbutton"/>
          <button id="PanelUI-zen-gradient-generator-scheme-dark" class="subviewbutton"/> 
        </hbox>
        <hbox id="PanelUI-zen-gradient-generator-color-actions">
          <button id="PanelUI-zen-gradient-generator-color-add" class="subviewbutton">
          </button>
          <button id="PanelUI-zen-gradient-generator-color-remove" class="subviewbutton">
          </button>
        </hbox>
        <label data-l10n-id="zen-panel-ui-gradient-click-to-add" id="PanelUI-zen-gradient-generator-color-click-to-add"></label>
      </hbox>
      <hbox>
        <toolbarbutton id="PanelUI-zen-gradient-generator-color-page-left" class="toolbarbutton-1" disabled="true" />
        <hbox id="PanelUI-zen-gradient-generator-color-pages">
          <hbox>
            <box data-lightness="90" data-algo="float" data-num-dots="1" data-position="196,176" style="background: #7bcbda;"></box>
            <box data-lightness="80" data-algo="float" data-num-dots="1" data-position="116,167" style="background: #be9ac9;"></box>
            <box data-lightness="70" data-algo="float" data-num-dots="1" data-position="122,110" style="background: #cdcea1;"></box>
            <box data-lightness="60" data-algo="float" data-num-dots="1" data-position="181,83" style="background: #6ac593;"></box>
            <box data-lightness="50" data-algo="analogous" data-num-dots="3" data-position="219,99" style="background: linear-gradient(135deg, rgb(117, 255, 136), rgb(60, 66, 58));"></box>
            <box data-lightness="40" data-algo="analogous" data-num-dots="3" data-position="167,201" style="background: linear-gradient(135deg, #a03fe0, #382b5c);"></box>
            <box data-lightness="30" data-algo="analogous" data-num-dots="3" data-position="90,170" style="background: linear-gradient(135deg, #c57aa3, #af824f);"></box>
            <box data-lightness="20" data-algo="splitComplementary" data-num-dots="3" data-position="83,103" style="background: linear-gradient(135deg, #1e90ff, #968a4a);"></box>
          </hbox>
          <hbox>
            <box data-lightness="90" data-algo="float" data-num-dots="1" data-position="196,176" style="background: red;"></box>
            <box data-lightness="80" data-algo="float" data-num-dots="1" data-position="116,167" style="background: #be9ac9;"></box>
            <box data-lightness="70" data-algo="float" data-num-dots="1" data-position="122,110" style="background: #cdcea1;"></box>
            <box data-lightness="60" data-algo="float" data-num-dots="1" data-position="181,83" style="background: #6ac593;"></box>
            <box data-lightness="50" data-algo="analogous" data-num-dots="3" data-position="219,99" style="background: linear-gradient(135deg, rgb(117, 255, 136), rgb(60, 66, 58));"></box>
            <box data-lightness="40" data-algo="analogous" data-num-dots="3" data-position="167,201" style="background: linear-gradient(135deg, #a03fe0, #382b5c);"></box>
            <box data-lightness="30" data-algo="analogous" data-num-dots="3" data-position="90,170" style="background: linear-gradient(135deg, #c57aa3, #af824f);"></box>
            <box data-lightness="20" data-algo="splitComplementary" data-num-dots="3" data-position="83,103" style="background: linear-gradient(135deg, #1e90ff, #968a4a);"></box>
          </hbox>
        </hbox>
        <toolbarbutton id="PanelUI-zen-gradient-generator-color-page-right" class="toolbarbutton-1" />
      </hbox>
      <hbox id="PanelUI-zen-gradient-generator-controls">
        <hbox id="PanelUI-zen-gradient-colors-wrapper">
          <vbox flex="1" id="PanelUI-zen-gradient-opacity-wrapper">
            <box id="PanelUI-zen-gradient-slider-wave">
              <svg viewBox="0 -7.605 455 70" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMinYMid meet">
                <path d="M 51.373 27.395 L 419.634 27.395" 
                      fill="none" 
                      stroke-linecap="round" 
                      stroke-linejoin="round" 
                      style="stroke-width: 8px;"/>
                <defs>
                  <linearGradient id="PanelUI-zen-gradient-generator-slider-wave-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="light-dark(rgb(77, 77, 77), rgb(161, 161, 161))"/>
                    <stop offset="0%" stop-color="light-dark(rgba(77, 77, 77), rgba(161, 161, 161))"/>
                    <stop offset="100%" stop-color="light-dark(rgba(77, 77, 77, 0.5), rgba(161, 161, 161, 0.5))"/>
                  </linearGradient>
                </defs>
              </svg>
            </box>
            <html:input type="range" min="0.15" max="0.85" value="0.5" step="0.01" id="PanelUI-zen-gradient-generator-opacity" />
          </vbox>
          <vbox id="PanelUI-zen-gradient-generator-texture-wrapper">
          </vbox>
        </hbox>
      </hbox>
      <vbox id="PanelUI-zen-gradient-generator-custom-colors">
        <vbox id="zen-theme-picker-color">
          <label data-l10n-id="zen-panel-ui-gradient-generator-custom-color"></label>
          <hbox>
            <html:input type="text" placeholder="#000000" id="PanelUI-zen-gradient-generator-custom-input" />
            <toolbarbutton id="PanelUI-zen-gradient-generator-color-custom-add" class="subviewbutton">
              <image></image>
            </toolbarbutton>
          </hbox>
        </vbox>
        <vbox id="PanelUI-zen-gradient-generator-custom-list">
        </vbox>
      </vbox>
    </panelview>
  </panelmultiview>
</panel>
