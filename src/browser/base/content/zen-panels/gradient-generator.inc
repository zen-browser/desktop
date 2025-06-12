# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

<panel flip="side" type="arrow" popupalign="center" orient="vertical" id="PanelUI-zen-gradient-generator" position="bottomright topright" mainview="true" side="left">
  <panelmultiview id="PanelUI-zen-gradient-generator-multiview" mainViewId="PanelUI-zen-gradient-generator-view">
    <panelview id="PanelUI-zen-gradient-generator-view" class="PanelUI-subView zen-theme-picker" role="document" mainview-with-header="true" has-custom-header="true">
      <hbox>
        <hbox id="PanelUI-zen-gradient-generator-predefined">
          <box data-algo="analogous" data-num-dots="3" data-position="219,99" style="background: linear-gradient(135deg, rgb(117, 255, 136), rgb(60, 66, 58));"></box>
          <box data-algo="analogous" data-num-dots="3" data-position="167,201" style="background: linear-gradient(135deg, #a03fe0, #382b5c);"></box>
          <box data-algo="analogous" data-num-dots="3" data-position="90,170" style="background: linear-gradient(135deg, #c57aa3, #af824f);"></box>
          <box data-algo="splitComplementary" data-num-dots="3" data-position="83,103" style="background: linear-gradient(135deg, #1e90ff, #968a4a);"></box>
          <box data-algo="analogous" data-num-dots="3" data-position="186,186" style="background: linear-gradient(135deg, #a07a48, #ab80e4);"></box>
          <box data-algo="float" data-num-dots="1" data-position="196,176" style="background: #7bcbda;"></box>
          <box data-algo="float" data-num-dots="1" data-position="116,167" style="background: #be9ac9;"></box>
          <box data-algo="float" data-num-dots="1" data-position="122,110" style="background: #cdcea1;"></box>
          <box data-algo="float" data-num-dots="1" data-position="181,83" style="background: #6ac593;"></box>
          <box data-algo="complementary" data-num-dots="2" data-position="82,112" style="background: linear-gradient(135deg, #1e90ff, #cfb179);"></box>
        </hbox>
      </hbox>
      <hbox class="zen-theme-picker-gradient">
        <box id="PanelUI-zen-gradient-generator-rotation-dot"></box>
        <box id="PanelUI-zen-gradient-generator-rotation-line"></box>
        <box id="PanelUI-zen-gradient-generator-color-actions">
          <button id="PanelUI-zen-gradient-generator-color-add" class="subviewbutton">
          </button>
          <button id="PanelUI-zen-gradient-generator-color-remove" class="subviewbutton">
          </button>
          <html:div class="separator"></html:div>
          <button id="PanelUI-zen-gradient-generator-color-toggle-algo" class="subviewbutton" data-l10n-id="zen-panel-ui-gradient-generator-algo-floating">
          </button>
        </box>
        <label data-l10n-id="zen-panel-ui-gradient-click-to-add" id="PanelUI-zen-gradient-generator-color-click-to-add"></label>
      </hbox>
      <hbox id="PanelUI-zen-gradient-generator-controls">
        <hbox id="PanelUI-zen-gradient-colors-wrapper">
          <vbox flex="1">
            <label data-l10n-id="zen-panel-ui-gradient-generator-opacity-text"></label>
            <html:input type="range" min="0" max="1" value="0.5" step="0.05" id="PanelUI-zen-gradient-generator-opacity" />
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
