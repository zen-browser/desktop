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
          <button id="PanelUI-zen-gradient-generator-scheme-auto" class="subviewbutton"/>
          <button id="PanelUI-zen-gradient-generator-scheme-light" class="subviewbutton"/>
          <button id="PanelUI-zen-gradient-generator-scheme-dark" class="subviewbutton"/> 
        </hbox>
        <hbox id="PanelUI-zen-gradient-generator-color-actions">
          <button id="PanelUI-zen-gradient-generator-color-add" class="subviewbutton" />
          <button id="PanelUI-zen-gradient-generator-color-remove" class="subviewbutton" />
          <button id="PanelUI-zen-gradient-generator-color-toggle-algo" class="subviewbutton" />
        </hbox>
        <label data-l10n-id="zen-panel-ui-gradient-click-to-add" id="PanelUI-zen-gradient-generator-color-click-to-add"></label>
      </hbox>
      <hbox id="PanelUI-zen-gradient-generator-pack-selector">
        <button id="PanelUI-zen-gradient-generator-pack-all" class="subviewbutton" data-pack="all" data-l10n-id="zen-panel-ui-gradient-pack-all"/>
        <button id="PanelUI-zen-gradient-generator-pack-minimal" class="subviewbutton" data-pack="minimal" data-l10n-id="zen-panel-ui-gradient-pack-minimal"/>
        <button id="PanelUI-zen-gradient-generator-pack-festive" class="subviewbutton" data-pack="festive" data-l10n-id="zen-panel-ui-gradient-pack-festive"/>
        <button id="PanelUI-zen-gradient-generator-pack-heritage" class="subviewbutton" data-pack="heritage" data-l10n-id="zen-panel-ui-gradient-pack-heritage"/>
      </hbox>
      <hbox>
        <toolbarbutton id="PanelUI-zen-gradient-generator-color-page-left" class="toolbarbutton-1" disabled="true" />
        <hbox id="PanelUI-zen-gradient-generator-color-pages">
          <hbox data-pack="all">
            <box data-lightness="90" data-algo="float" data-num-dots="1" data-position="240,240" style="background: #f4efdf;"></box>
            <box data-lightness="80" data-algo="float" data-num-dots="1" data-position="233,157" style="background: #f0b8cd;"></box>
            <box data-lightness="80" data-algo="float" data-num-dots="1" data-position="236,111" style="background: #e9c3e3;"></box>
            <box data-lightness="70" data-algo="float" data-num-dots="1" data-position="234,173" style="background: #da7682;"></box>
            <box data-lightness="70" data-algo="float" data-num-dots="1" data-position="220,187" style="background: #eb8570;"></box>
            <box data-lightness="60" data-algo="float" data-num-dots="1" data-position="225,237" style="background: #dcce7f;"></box>
            <box data-lightness="60" data-algo="float" data-num-dots="1" data-position="147,195" style="background: #5becad;"></box>
            <box data-lightness="50" data-algo="float" data-num-dots="1" data-position="81,84" style="background: #919bb5;"></box>
          </hbox>
          <hbox data-pack="all">
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
          <hbox data-pack="all">
            <box data-lightness="10" data-algo="float" data-num-dots="1" data-position="171,72" style="background:rgb(93, 86, 106);"></box>
            <box data-lightness="40" data-algo="float" data-num-dots="1" data-position="265,79" style="background: #997096;"></box>
            <box data-lightness="35" data-algo="float" data-num-dots="1" data-position="301,176" style="background: #956066;"></box>
            <box data-lightness="30" data-algo="float" data-num-dots="1" data-position="237,210" style="background: #9c6645;"></box>
            <box data-lightness="30" data-algo="float" data-num-dots="1" data-position="91,228" style="background: #517b6c;"></box>
            <box data-lightness="25" data-algo="float" data-num-dots="1" data-position="67,159" style="background: #576e75;"></box>
            <box data-lightness="20" data-algo="float" data-num-dots="1" data-position="314,235" style="background:rgb(131, 109, 95);"></box>
            <box data-lightness="20" data-algo="float" data-num-dots="1" data-position="118,215" style="background: #447464;"></box>
          </hbox>
          <hbox data-pack="all">
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
          <hbox data-pack="all">
# Start from black to white in a span on 8 steps and.
# They must all go from the middle to the right side. They must always stay verically centered.
# And reach to 180 on the right side, meaning we must divide the width in 16 segments.
            <box data-type="explicit-black-white" data-algo="float" data-num-dots="1" 
                data-position="340,180" style="background: rgb(224, 224, 224);"></box>
            <box data-type="explicit-black-white" data-algo="float" data-num-dots="1" 
                data-position="337.5,180" style="background: rgb(224, 224, 224);"></box>
            <box data-type="explicit-black-white" data-algo="float" data-num-dots="1" 
                data-position="315,180" style="background: rgb(192, 192, 192);"></box>
            <box data-type="explicit-black-white" data-algo="float" data-num-dots="1" 
                data-position="292.5,180" style="background: rgb(160, 160, 160);"></box>
            <box data-type="explicit-black-white" data-algo="float" data-num-dots="1" 
                data-position="270,180" style="background: rgb(128, 128, 128);"></box>
            <box data-type="explicit-black-white" data-algo="float" data-num-dots="1" 
                data-position="247.5,180" style="background: rgb(96, 96, 96);"></box>
            <box data-type="explicit-black-white" data-algo="float" data-num-dots="1" 
                data-position="225,180" style="background: rgb(64, 64, 64);"></box>
            <box data-type="explicit-black-white" data-algo="float" data-num-dots="1" 
                data-position="202.5,180" style="background: rgb(32, 32, 32);"></box>
            <box data-type="explicit-black-white" data-algo="float" data-num-dots="1" 
                data-position="180,180" style="background: rgb(0, 0, 0);"></box>
          </hbox>
          <hbox data-pack="minimal">
            <box data-pack="minimal" data-preset-name="Saffron Mist" data-lightness="88" data-algo="float" data-num-dots="1" data-position="246,196" style="background: #ffd8a3;"></box>
            <box data-pack="minimal" data-preset-name="Tricolor Calm" data-lightness="80" data-algo="analogous" data-num-dots="3" data-position="210,208"
                style="--c1: rgb(255, 153, 51); --c2: rgb(255, 255, 255); --c3: rgb(19, 136, 8);" />
            <box data-pack="minimal" data-preset-name="Ashoka Indigo" data-lightness="60" data-algo="float" data-num-dots="1" data-position="72,130" style="background: #4a5faa;"></box>
            <box data-pack="minimal" data-preset-name="Lotus Dawn" data-lightness="84" data-algo="analogous" data-num-dots="3" data-position="232,164"
                style="--c1: rgb(255, 178, 132); --c2: rgb(248, 230, 194); --c3: rgb(140, 177, 139);" />
            <box data-pack="minimal" data-preset-name="Monsoon Grey" data-lightness="50" data-algo="float" data-num-dots="1" data-position="122,124" style="background: #8792a3;"></box>
            <box data-pack="minimal" data-preset-name="Tea Estate" data-lightness="55" data-algo="float" data-num-dots="1" data-position="126,230" style="background: #5f8a5d;"></box>
            <box data-pack="minimal" data-preset-name="Dune Stone" data-lightness="70" data-algo="float" data-num-dots="1" data-position="220,220" style="background: #c9b79d;"></box>
            <box data-pack="minimal" data-preset-name="Delhi Winter" data-lightness="52" data-algo="analogous" data-num-dots="3" data-position="92,96"
                style="--c1: rgb(129, 145, 174); --c2: rgb(145, 128, 167); --c3: rgb(120, 164, 165);" />
          </hbox>
          <hbox data-pack="festive">
            <box data-pack="festive" data-preset-name="Diwali Spark" data-lightness="72" data-algo="analogous" data-num-dots="3" data-position="288,166"
                style="--c1: rgb(255, 121, 76); --c2: rgb(255, 214, 75); --c3: rgb(214, 99, 255);" />
            <box data-pack="festive" data-preset-name="Holi Pop" data-lightness="76" data-algo="analogous" data-num-dots="3" data-position="160,120"
                style="--c1: rgb(250, 80, 118); --c2: rgb(70, 191, 255); --c3: rgb(104, 241, 154);" />
            <box data-pack="festive" data-preset-name="Garba Night" data-lightness="58" data-algo="analogous" data-num-dots="3" data-position="260,226"
                style="--c1: rgb(255, 100, 74); --c2: rgb(253, 176, 63); --c3: rgb(195, 70, 210);" />
            <box data-pack="festive" data-preset-name="Rangoli Bright" data-lightness="78" data-algo="analogous" data-num-dots="3" data-position="224,140"
                style="--c1: rgb(255, 143, 55); --c2: rgb(72, 186, 255); --c3: rgb(74, 207, 118);" />
            <box data-pack="festive" data-preset-name="Sangeet Glow" data-lightness="66" data-algo="float" data-num-dots="1" data-position="298,208" style="background: #eb6a82;"></box>
            <box data-pack="festive" data-preset-name="Festival Neon" data-lightness="62" data-algo="analogous" data-num-dots="3" data-position="120,246"
                style="--c1: rgb(101, 255, 191); --c2: rgb(84, 167, 255); --c3: rgb(244, 116, 226);" />
            <box data-pack="festive" data-preset-name="Mela Lights" data-lightness="70" data-algo="float" data-num-dots="1" data-position="238,92" style="background: #f48f43;"></box>
            <box data-pack="festive" data-preset-name="Jaipur Pop" data-lightness="74" data-algo="float" data-num-dots="1" data-position="314,140" style="background: #ec7294;"></box>
          </hbox>
          <hbox data-pack="heritage">
            <box data-pack="heritage" data-preset-name="Jaipur Stone" data-lightness="56" data-algo="float" data-num-dots="1" data-position="240,216" style="background: #ba7859;"></box>
            <box data-pack="heritage" data-preset-name="Temple Bronze" data-lightness="42" data-algo="analogous" data-num-dots="3" data-position="262,206"
                style="--c1: rgb(161, 86, 42); --c2: rgb(127, 102, 48); --c3: rgb(129, 67, 94);" />
            <box data-pack="heritage" data-preset-name="Sandalwood" data-lightness="65" data-algo="float" data-num-dots="1" data-position="222,238" style="background: #b89a74;"></box>
            <box data-pack="heritage" data-preset-name="Indus Night" data-lightness="28" data-algo="float" data-num-dots="1" data-position="92,132" style="background: #2f4f6e;"></box>
            <box data-pack="heritage" data-preset-name="Kalamkari" data-lightness="44" data-algo="analogous" data-num-dots="3" data-position="300,204"
                style="--c1: rgb(171, 83, 52); --c2: rgb(92, 116, 60); --c3: rgb(130, 67, 95);" />
            <box data-pack="heritage" data-preset-name="Mehndi Leaf" data-lightness="47" data-algo="float" data-num-dots="1" data-position="128,232" style="background: #4f7853;"></box>
            <box data-pack="heritage" data-preset-name="Mughal Indigo" data-lightness="40" data-algo="float" data-num-dots="1" data-position="78,102" style="background: #3e4f7d;"></box>
            <box data-pack="heritage" data-preset-name="Royal Zari" data-lightness="62" data-algo="analogous" data-num-dots="3" data-position="286,182"
                style="--c1: rgb(188, 124, 52); --c2: rgb(157, 99, 123); --c3: rgb(87, 122, 141);" />
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
              max="0.9"
              min="0.30"
#else
              max="0.9"
              min="0.25"
#endif
              />
          </vbox>
          <vbox id="PanelUI-zen-gradient-generator-texture-wrapper">
          </vbox>
        </hbox>
      </hbox>
      <hbox id="PanelUI-zen-gradient-generator-theme-actions">
        <button id="PanelUI-zen-gradient-generator-action-preview" class="subviewbutton" data-l10n-id="zen-panel-ui-gradient-action-preview"/>
        <button id="PanelUI-zen-gradient-generator-action-apply" class="subviewbutton" data-l10n-id="zen-panel-ui-gradient-action-apply"/>
        <button id="PanelUI-zen-gradient-generator-action-reset" class="subviewbutton" data-l10n-id="zen-panel-ui-gradient-action-reset"/>
        <button id="PanelUI-zen-gradient-generator-action-favorite" class="subviewbutton" data-l10n-id="zen-panel-ui-gradient-action-favorite"/>
      </hbox>
      <vbox id="PanelUI-zen-gradient-generator-presets-state">
        <vbox id="PanelUI-zen-gradient-generator-favorites-section">
          <label class="zen-theme-picker-section-title" data-l10n-id="zen-panel-ui-gradient-favorites-title"></label>
          <hbox id="PanelUI-zen-gradient-generator-favorites-list"></hbox>
        </vbox>
        <vbox id="PanelUI-zen-gradient-generator-recents-section">
          <label class="zen-theme-picker-section-title" data-l10n-id="zen-panel-ui-gradient-recent-title"></label>
          <hbox id="PanelUI-zen-gradient-generator-recents-list"></hbox>
        </vbox>
      </vbox>
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
