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
            <box data-lightness="90" data-algo="float" data-num-dots="1" data-position="240,240" style="background: #f4efdf;"></box>
            <box data-lightness="80" data-algo="float" data-num-dots="1" data-position="233,157" style="background: #f0b8cd;"></box>
            <box data-lightness="80" data-algo="float" data-num-dots="1" data-position="236,111" style="background: #e9c3e3;"></box>
            <box data-lightness="70" data-algo="float" data-num-dots="1" data-position="234,173" style="background: #da7682;"></box>
            <box data-lightness="70" data-algo="float" data-num-dots="1" data-position="220,187" style="background: #eb8570;"></box>
            <box data-lightness="60" data-algo="float" data-num-dots="1" data-position="225,237" style="background: #dcce7f;"></box>
            <box data-lightness="60" data-algo="float" data-num-dots="1" data-position="147,195" style="background: #5becad;"></box>
            <box data-lightness="50" data-algo="float" data-num-dots="1" data-position="81,84" style="background: #919bb5;"></box>
          </hbox>
          <hbox>
            <box data-lightness="90" data-algo="analogous" data-num-dots="3" data-position="240,240"
                style="--c1: rgb(245, 237, 214); --c2: rgb(221, 243, 216); --c3: rgb(243, 216, 225);" />
            <box data-lightness="85" data-algo="analogous" data-num-dots="3" data-position="233,157"
                style="--c1: rgb(243, 190, 222); --c2: rgb(247, 222, 186); --c3: rgb(223, 195, 238);" />
            <box data-lightness="80" data-algo="analogous" data-num-dots="3" data-position="236,111"
                style="--c1: rgb(229, 179, 228); --c2: rgb(236, 172, 178); --c3: rgb(197, 185, 223);" />
            <box data-lightness="70" data-algo="analogous" data-num-dots="3" data-position="234,173"
                style="--c1: rgb(235, 122, 159); --c2: rgb(239, 239, 118); --c3: rgb(210, 133, 224);" />
            <box data-lightness="70" data-algo="analogous" data-num-dots="3" data-position="220,187"
                style="--c1: rgb(242, 115, 123); --c2: rgb(175, 242, 115); --c3: rgb(230, 125, 232);" />
            <box data-lightness="60" data-algo="analogous" data-num-dots="3" data-position="225,237"
                style="--c1: rgb(221, 205, 85); --c2: rgb(97, 212, 94); --c3: rgb(215, 91, 124);" />
            <box data-lightness="60" data-algo="analogous" data-num-dots="3" data-position="147,195"
                style="--c1: rgb(75, 231, 210); --c2: rgb(84, 175, 222); --c3: rgb(62, 244, 112);" />
            <box data-lightness="55" data-algo="analogous" data-num-dots="3" data-position="81,84"
                style="--c1: rgb(122, 132, 158); --c2: rgb(137, 117, 164); --c3: rgb(116, 162, 164);" />
          </hbox>
          <hbox>
            <box data-lightness="10" data-algo="float" data-num-dots="1" data-position="171,72" style="background:rgb(93, 86, 106);"></box>
            <box data-lightness="40" data-algo="float" data-num-dots="1" data-position="265,79" style="background: #997096;"></box>
            <box data-lightness="35" data-algo="float" data-num-dots="1" data-position="301,176" style="background: #956066;"></box>
            <box data-lightness="30" data-algo="float" data-num-dots="1" data-position="237,210" style="background: #9c6645;"></box>
            <box data-lightness="30" data-algo="float" data-num-dots="1" data-position="91,228" style="background: #517b6c;"></box>
            <box data-lightness="25" data-algo="float" data-num-dots="1" data-position="67,159" style="background: #576e75;"></box>
            <box data-lightness="20" data-algo="float" data-num-dots="1" data-position="314,235" style="background:rgb(131, 109, 95);"></box>
            <box data-lightness="20" data-algo="float" data-num-dots="1" data-position="118,215" style="background: #447464;"></box>
          </hbox>
          <hbox>
            <box data-lightness="10" data-algo="analogous" data-num-dots="3" data-position="171,72"
                style="--c1: rgb(23, 17, 34); --c2: rgb(37, 14, 35); --c3: rgb(18, 22, 33);" />
            <box data-lightness="40" data-algo="analogous" data-num-dots="3" data-position="265,79"
                style="--c1: rgb(128, 76, 124); --c2: rgb(141, 63, 66); --c3: rgb(97, 88, 116);" />
            <box data-lightness="35" data-algo="analogous" data-num-dots="3" data-position="301,176"
                style="--c1: rgb(122, 56, 64); --c2: rgb(126, 121, 52); --c3: rgb(111, 68, 110);" />
            <box data-lightness="30" data-algo="analogous" data-num-dots="3" data-position="237,210"
                style="--c1: rgb(131, 65, 22); --c2: rgb(64, 128, 25); --c3: rgb(122, 31, 91);" />
            <box data-lightness="30" data-algo="analogous" data-num-dots="3" data-position="91,228"
                style="--c1: rgb(45, 108, 85); --c2: rgb(52, 85, 101); --c3: rgb(52, 118, 35);" />
            <box data-lightness="25" data-algo="analogous" data-num-dots="3" data-position="67,159"
                style="--c1: rgb(45, 74, 83); --c2: rgb(46, 50, 81); --c3: rgb(38, 90, 65);" />
            <box data-lightness="20" data-algo="analogous" data-num-dots="3" data-position="314,235"
                style="--c1: rgb(64, 47, 38); --c2: rgb(55, 64, 38); --c3: rgb(59, 43, 52);" />
            <box data-lightness="20" data-algo="analogous" data-num-dots="3" data-position="118,215"
                style="--c1: rgb(22, 80, 61); --c2: rgb(26, 60, 76); --c3: rgb(27, 87, 15);" />
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
                    <stop offset="0%" stop-color="light-dark(rgb(90, 90, 90), rgb(161, 161, 161))"/>
                    <stop offset="0%" stop-color="light-dark(rgb(90, 90, 90), rgba(161, 161, 161))"/>
                    <stop offset="100%" stop-color="light-dark(rgba(77, 77, 77, 0.5), rgba(161, 161, 161, 0.5))"/>
                  </linearGradient>
                </defs>
              </svg>
            </box>
            <html:input type="range" min="0.3" max="0.9" value="0.4" step="0.001" id="PanelUI-zen-gradient-generator-opacity" />
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
