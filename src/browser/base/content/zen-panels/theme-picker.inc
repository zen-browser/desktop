# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

<panel flip="side" type="arrow"
    opupalign="center" 
    orient="vertical" 
    id="PanelUI-zen-gradient-generator" 
    position="bottomright topright" 
    mainview="true" 
    hidepopovertail="true"
    side="left">
  <panelmultiview id="PanelUI-zen-gradient-generator-multiview" mainViewId="PanelUI-zen-gradient-generator-view">
    <panelview id="PanelUI-zen-gradient-generator-view" class="PanelUI-subView zen-theme-picker" role="document" mainview-with-header="true" has-custom-header="true">
      <hbox class="zen-theme-picker-gradient">
        <hbox id="PanelUI-zen-gradient-generator-scheme">
          <button id="PanelUI-zen-gradient-generator-scheme-auto" class="no-squircles subviewbutton"/>
          <button id="PanelUI-zen-gradient-generator-scheme-light" class="no-squircles subviewbutton"/>
          <button id="PanelUI-zen-gradient-generator-scheme-dark" class="no-squircles subviewbutton"/> 
        </hbox>
        <hbox id="PanelUI-zen-gradient-generator-color-actions">
          <button id="PanelUI-zen-gradient-generator-color-add" class="no-squircles subviewbutton" />
          <button id="PanelUI-zen-gradient-generator-color-remove" class="no-squircles subviewbutton" />
          <button id="PanelUI-zen-gradient-generator-color-toggle-algo" class="no-squircles subviewbutton" />
        </hbox>
        <label data-l10n-id="zen-panel-ui-gradient-click-to-add" id="PanelUI-zen-gradient-generator-color-click-to-add"></label>
      </hbox>
      <hbox>
        <toolbarbutton id="PanelUI-zen-gradient-generator-color-page-left" class="toolbarbutton-1" disabled="true" />
        <hbox id="PanelUI-zen-gradient-generator-color-pages">
          <hbox>
            <box class="no-squircles" data-lightness="95" data-algo="float" data-num-dots="1" data-position="330,248" data-color="242, 234, 228" style="background: rgb(242, 234, 228);"></box>
            <box class="no-squircles" data-lightness="95" data-algo="float" data-num-dots="1" data-position="282,127" data-color="242, 155, 187" style="background: rgb(242, 155, 187);"></box>
            <box class="no-squircles" data-lightness="65" data-algo="float" data-num-dots="1" data-position="255,75" data-color="166, 114, 157" style="background: rgb(166, 114, 157);"></box>
            <box class="no-squircles" data-lightness="95" data-algo="float" data-num-dots="1" data-position="244,165" data-color="242, 94, 107" style="background: rgb(242, 94, 107);"></box>
            <box class="no-squircles" data-lightness="100" data-algo="float" data-num-dots="1" data-position="234,190" data-color="255, 133, 88" style="background: rgb(255, 133, 88);"></box>
            <box class="no-squircles" data-lightness="97" data-algo="float" data-num-dots="1" data-position="217,220" data-color="248, 213, 88" style="background: rgb(248, 213, 88);"></box>
            <box class="no-squircles" data-lightness="91" data-algo="float" data-num-dots="1" data-position="135,191" data-color="52, 232, 149" style="background: rgb(52, 232, 149);"></box>
            <box class="no-squircles" data-lightness="85" data-algo="float" data-num-dots="1" data-position="84,145" data-color="108, 186, 217" style="background: rgb(108, 186, 217);"></box>
            <box class="no-squircles" data-lightness="54" data-algo="float" data-num-dots="1" data-position="99,54" data-color="102, 103, 137" style="background: rgb(102, 103, 137);"></box>
          </hbox>
          <hbox>
            <box class="no-squircles" data-lightness="95" data-algo="analogous" data-num-dots="3" data-position="330,248" data-color="242, 234, 228"
                style="--c1: rgb(242, 234, 228); --c2: rgb(238, 242, 228); --c3: rgb(242, 228, 234);" />
            <box class="no-squircles" data-lightness="95" data-algo="analogous" data-num-dots="3" data-position="282,127" data-color="242, 155, 187"
                style="--c1: rgb(242, 155, 187); --c2: rgb(242, 196, 155); --c3: rgb(224, 155, 242);" />
            <box class="no-squircles" data-lightness="65" data-algo="analogous" data-num-dots="3" data-position="255,75" data-color="166, 114, 157"
                style="--c1: rgb(166, 114, 157); --c2: rgb(166, 114, 114); --c3: rgb(132, 114, 166);" />
            <box class="no-squircles" data-lightness="95" data-algo="analogous" data-num-dots="3" data-position="244,165" data-color="242, 94, 107"
                style="--c1: rgb(242, 94, 107); --c2: rgb(242, 204, 94); --c3: rgb(242, 94, 230);" />
            <box class="no-squircles" data-lightness="100" data-algo="analogous" data-num-dots="3" data-position="234,190" data-color="255, 133, 88"
                style="--c1: rgb(255, 133, 88); --c2: rgb(238, 255, 88); --c3: rgb(255, 88, 182);" />
            <box class="no-squircles" data-lightness="97" data-algo="analogous" data-num-dots="3" data-position="217,220" data-color="248, 213, 88"
                style="--c1: rgb(248, 213, 88); --c2: rgb(150, 248, 88); --c3: rgb(248, 88, 96);" />
            <box class="no-squircles" data-lightness="91" data-algo="analogous" data-num-dots="3" data-position="135,191" data-color="52, 232, 149"
                style="--c1: rgb(52, 232, 149); --c2: rgb(52, 165, 232); --c3: rgb(105, 232, 52);" />
            <box class="no-squircles" data-lightness="85" data-algo="analogous" data-num-dots="3" data-position="84,145" data-color="108, 186, 217"
                style="--c1: rgb(108, 186, 217); --c2: rgb(121, 108, 217); --c3: rgb(108, 217, 157);" />
            <box class="no-squircles" data-lightness="54" data-algo="analogous" data-num-dots="3" data-position="99,54" data-color="102, 103, 137"
                style="--c1: rgb(102, 103, 137); --c2: rgb(130, 102, 137); --c3: rgb(102, 132, 137);" />
          </hbox>
          <hbox>
            <box class="no-squircles" data-lightness="100" data-algo="float" data-num-dots="1" data-position="349,219" data-color="254, 251, 250" style="background: rgb(254, 251, 250);"></box>
            <box class="no-squircles" data-lightness="100" data-algo="float" data-num-dots="1" data-position="323,94" data-color="255, 233, 243" style="background: rgb(255, 233, 243);"></box>
            <box class="no-squircles" data-lightness="95" data-algo="float" data-num-dots="1" data-position="274,47" data-color="241, 209, 236" style="background: rgb(241, 209, 236);"></box>
            <box class="no-squircles" data-lightness="100" data-algo="float" data-num-dots="1" data-position="319,154" data-color="255, 203, 209" style="background: rgb(255, 203, 209);"></box>
            <box class="no-squircles" data-lightness="100" data-algo="float" data-num-dots="1" data-position="319,219" data-color="255, 224, 211" style="background: rgb(255, 224, 211);"></box>
            <box class="no-squircles" data-lightness="100" data-algo="float" data-num-dots="1" data-position="288,292" data-color="255, 249, 229" style="background: rgb(255, 249, 229);"></box>
            <box class="no-squircles" data-lightness="99" data-algo="float" data-num-dots="1" data-position="38,265" data-color="222, 253, 235" style="background: rgb(222, 253, 235);"></box>
            <box class="no-squircles" data-lightness="99" data-algo="float" data-num-dots="1" data-position="17,125" data-color="220, 243, 252" style="background: rgb(220, 243, 252);"></box>
            <box class="no-squircles" data-lightness="90" data-algo="float" data-num-dots="1" data-position="88,36" data-color="197, 198, 229" style="background: rgb(197, 198, 229);"></box>
          </hbox>
          <hbox>
            <box class="no-squircles" data-lightness="100" data-algo="analogous" data-num-dots="3" data-position="349,219" data-color="254, 251, 250"
                style="--c1: rgb(254, 251, 250); --c2: rgb(254, 254, 250); --c3: rgb(254, 250, 252);" />
            <box class="no-squircles" data-lightness="100" data-algo="analogous" data-num-dots="3" data-position="323,94" data-color="255, 233, 243"
                style="--c1: rgb(255, 233, 243); --c2: rgb(255, 241, 233); --c3: rgb(249, 233, 255);" />
            <box class="no-squircles" data-lightness="95" data-algo="analogous" data-num-dots="3" data-position="274,47" data-color="241, 209, 236"
                style="--c1: rgb(241, 209, 236); --c2: rgb(241, 209, 209); --c3: rgb(219, 209, 241);" />
            <box class="no-squircles" data-lightness="100" data-algo="analogous" data-num-dots="3" data-position="319,154" data-color="255, 203, 209"
                style="--c1: rgb(255, 203, 209); --c2: rgb(255, 240, 203); --c3: rgb(255, 203, 252);" />
            <box class="no-squircles" data-lightness="100" data-algo="analogous" data-num-dots="3" data-position="319,219" data-color="255, 224, 211"
                style="--c1: rgb(255, 224, 211); --c2: rgb(249, 255, 211); --c3: rgb(255, 211, 235);" />
            <box class="no-squircles" data-lightness="100" data-algo="analogous" data-num-dots="3" data-position="288,292" data-color="255, 249, 229"
                style="--c1: rgb(255, 249, 229); --c2: rgb(239, 255, 229); --c3: rgb(255, 229, 231);" />
            <box class="no-squircles" data-lightness="99" data-algo="analogous" data-num-dots="3" data-position="38,265" data-color="222, 253, 235"
                style="--c1: rgb(222, 253, 235); --c2: rgb(222, 245, 253); --c3: rgb(235, 253, 222);" />
            <box class="no-squircles" data-lightness="99" data-algo="analogous" data-num-dots="3" data-position="17,125" data-color="220, 243, 252"
                style="--c1: rgb(220, 243, 252); --c2: rgb(224, 220, 252); --c3: rgb(220, 252, 234);" />
            <box class="no-squircles" data-lightness="90" data-algo="analogous" data-num-dots="3" data-position="88,36" data-color="197, 198, 229"
                style="--c1: rgb(197, 198, 229); --c2: rgb(223, 197, 229); --c3: rgb(197, 225, 229);" />
          </hbox>
          <hbox>
            <box class="no-squircles" data-lightness="35" data-algo="float" data-num-dots="1" data-position="188,53" data-color="78, 58, 90" style="background: rgb(78, 58, 90);"></box>
            <box class="no-squircles" data-lightness="41" data-algo="float" data-num-dots="1" data-position="244,111" data-color="105, 53, 88" style="background: rgb(105, 53, 88);"></box>
            <box class="no-squircles" data-lightness="56" data-algo="float" data-num-dots="1" data-position="255,170" data-color="143, 64, 66" style="background: rgb(143, 64, 66);"></box>
            <box class="no-squircles" data-lightness="69" data-algo="float" data-num-dots="1" data-position="233,199" data-color="177, 109, 64" style="background: rgb(177, 109, 64);"></box>
            <box class="no-squircles" data-lightness="84" data-algo="float" data-num-dots="1" data-position="232,226" data-color="215, 179, 93" style="background: rgb(215, 179, 93);"></box>
            <box class="no-squircles" data-lightness="80" data-algo="float" data-num-dots="1" data-position="250,299" data-color="205, 204, 164" style="background: rgb(205, 204, 164);"></box>
            <box class="no-squircles" data-lightness="66" data-algo="float" data-num-dots="1" data-position="85,275" data-color="122, 169, 130" style="background: rgb(122, 169, 130);"></box>
            <box class="no-squircles" data-lightness="38" data-algo="float" data-num-dots="1" data-position="112,197" data-color="34, 97, 73" style="background: rgb(34, 97, 73);"></box>
            <box class="no-squircles" data-lightness="42" data-algo="float" data-num-dots="1" data-position="117,136" data-color="38, 69, 107" style="background: rgb(38, 69, 107);"></box>
          </hbox>
          <hbox>
            <box class="no-squircles" data-lightness="35" data-algo="analogous" data-num-dots="3" data-position="188,53" data-color="78, 58, 90"
                style="--c1: rgb(78, 58, 90); --c2: rgb(90, 58, 75); --c3: rgb(58, 65, 90);" />
            <box class="no-squircles" data-lightness="41" data-algo="analogous" data-num-dots="3" data-position="244,111" data-color="105, 53, 88"
                style="--c1: rgb(105, 53, 88); --c2: rgb(105, 61, 53); --c3: rgb(79, 53, 105);" />
            <box class="no-squircles" data-lightness="56" data-algo="analogous" data-num-dots="3" data-position="255,170" data-color="143, 64, 66"
                style="--c1: rgb(143, 64, 66); --c2: rgb(143, 128, 64); --c3: rgb(143, 64, 132);" />
            <box class="no-squircles" data-lightness="69" data-algo="analogous" data-num-dots="3" data-position="233,199" data-color="177, 109, 64"
                style="--c1: rgb(177, 109, 64); --c2: rgb(151, 177, 64); --c3: rgb(177, 64, 113);" />
            <box class="no-squircles" data-lightness="84" data-algo="analogous" data-num-dots="3" data-position="232,226" data-color="215, 179, 93"
                style="--c1: rgb(215, 179, 93); --c2: rgb(149, 215, 93); --c3: rgb(215, 93, 109);" />
            <box class="no-squircles" data-lightness="80" data-algo="analogous" data-num-dots="3" data-position="250,299" data-color="205, 204, 164"
                style="--c1: rgb(205, 204, 164); --c2: rgb(172, 205, 164); --c3: rgb(205, 170, 164);" />
            <box class="no-squircles" data-lightness="66" data-algo="analogous" data-num-dots="3" data-position="85,275" data-color="122, 169, 130"
                style="--c1: rgb(122, 169, 130); --c2: rgb(122, 169, 169); --c3: rgb(153, 169, 122);" />
            <box class="no-squircles" data-lightness="38" data-algo="analogous" data-num-dots="3" data-position="112,197" data-color="34, 97, 73"
                style="--c1: rgb(34, 97, 73); --c2: rgb(34, 68, 97); --c3: rgb(47, 97, 34);" />
            <box class="no-squircles" data-lightness="42" data-algo="analogous" data-num-dots="3" data-position="117,136" data-color="38, 69, 107"
                style="--c1: rgb(38, 69, 107); --c2: rgb(64, 38, 107); --c3: rgb(38, 107, 87);" />
          </hbox>
          <hbox>
# Start from black to white in a span on 8 steps and.
# They must all go from the middle to the right side. They must always stay verically centered.
# And reach to 180 on the right side, meaning we must divide the width in 16 segments.
            <box class="no-squircles" data-type="explicit-black-white" data-algo="float" data-num-dots="1" 
                data-position="340,180" style="background: rgb(224, 224, 224);"></box>
            <box class="no-squircles" data-type="explicit-black-white" data-algo="float" data-num-dots="1" 
                data-position="337.5,180" style="background: rgb(224, 224, 224);"></box>
            <box class="no-squircles" data-type="explicit-black-white" data-algo="float" data-num-dots="1" 
                data-position="315,180" style="background: rgb(192, 192, 192);"></box>
            <box class="no-squircles" data-type="explicit-black-white" data-algo="float" data-num-dots="1" 
                data-position="292.5,180" style="background: rgb(160, 160, 160);"></box>
            <box class="no-squircles" data-type="explicit-black-white" data-algo="float" data-num-dots="1" 
                data-position="270,180" style="background: rgb(128, 128, 128);"></box>
            <box class="no-squircles" data-type="explicit-black-white" data-algo="float" data-num-dots="1" 
                data-position="247.5,180" style="background: rgb(96, 96, 96);"></box>
            <box class="no-squircles" data-type="explicit-black-white" data-algo="float" data-num-dots="1" 
                data-position="225,180" style="background: rgb(64, 64, 64);"></box>
            <box class="no-squircles" data-type="explicit-black-white" data-algo="float" data-num-dots="1" 
                data-position="202.5,180" style="background: rgb(32, 32, 32);"></box>
            <box class="no-squircles" data-type="explicit-black-white" data-algo="float" data-num-dots="1" 
                data-position="180,180" style="background: rgb(0, 0, 0);"></box>
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
            <html:input type="range" value="0.4" step="0.001" id="PanelUI-zen-gradient-generator-opacity"
#ifdef XP_MACOSX
              max="0.8"
              min="0.30"
#else
              max="0.8"
              min="0.25"
#endif
              />
          </vbox>
          <vbox id="PanelUI-zen-gradient-generator-texture-wrapper" data-l10n-id="zen-panel-ui-gradient-generator-texture">
          </vbox>
        </hbox>
      </hbox>
      <vbox id="PanelUI-zen-gradient-generator-custom-colors">
        <vbox id="zen-theme-picker-color">
          <label data-l10n-id="zen-panel-ui-gradient-generator-custom-color"></label>
          <hbox>
            <html:input type="color" id="PanelUI-zen-gradient-generator-custom-input" />
            <html:input type="number" value="1" min="0" max="1" step="0.01" id="PanelUI-zen-gradient-generator-custom-opacity" />
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
