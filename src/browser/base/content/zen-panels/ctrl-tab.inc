# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

<panel id="zen-ctrl-tab-panel"
        role="group"
        type="arrow"
        hidepopovertail="true"
        noautofocus="true"
        consumeoutsideclicks="true"
        animate="false"
        nonnative="">
  <panelmultiview id="zen-ctrl-tab-panel-multiview"
                  mainViewId="zen-ctrl-tab-panel-view">
    <panelview id="zen-ctrl-tab-panel-view"
                class="cui-widget-panelview"
                mainview-with-header="true">
      <hbox id="zen-ctrl-tab-panel-cards" class="zen-ctrl-tab-panel-cards">
      </hbox>
    </panelview>
  </panelmultiview>
</panel>
