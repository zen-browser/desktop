# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

<panel id="zen-tab-switcher-panel"
        flip="side"
        type="arrow"
        opupalign="center"
        orient="vertical"
        position="bottomright topright"
        mainview="true"
        hidepopovertail="true"
        noautohide="true"
        noautofocus="true"
        level="top"
        side="left">
  <panelmultiview id="zen-tab-switcher-multiview"
                  mainViewId="zen-tab-switcher-view">
    <panelview id="zen-tab-switcher-view"
                class="cui-widget-panelview"
                mainview-with-header="true">
      <hbox id="zen-tab-switcher-tabs" class="zen-tab-switcher-tabs">
        <!-- Tab cards will be dynamically inserted here -->
      </hbox>
    </panelview>
  </panelmultiview>
</panel>
