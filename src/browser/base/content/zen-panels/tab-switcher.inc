# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

<panel id="zen-tab-switcher-panel"
        role="group"
        type="arrow"
        noautohide="true"
        noautofocus="true"
        level="top">
  <panelmultiview id="zen-tab-switcher-multiview"
                  mainViewId="zen-tab-switcher-view">
    <panelview id="zen-tab-switcher-view"
                class="cui-widget-panelview">
      <hbox id="zen-tab-switcher-tabs" class="zen-tab-switcher-tabs">
        <!-- Tab cards will be dynamically inserted here -->
      </hbox>
    </panelview>
  </panelmultiview>
</panel>
