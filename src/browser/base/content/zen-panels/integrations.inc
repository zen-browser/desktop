# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

<panel id="zen-integrations-popup"
    nonnative=""
    type="arrow"
    orient="vertical"
    noautofocus="true"
    consumeoutsideclicks="never">
  <vbox id="zen-integrations-content-wrapper" flex="1">
    <vbox id="zen-integrations-meeting-card" hidden="true">
      <toolbarbutton id="zen-integrations-meeting-join-btn" class="zen-integrations-top-join" />
      <html:select id="zen-integrations-meeting-select" class="zen-integrations-top-select" hidden="true" />
    </vbox>
    <hbox id="zen-integrations-header-bar" align="center">
      <label class="zen-integrations-header" flex="1" />
      <toolbarbutton id="zen-integrations-compose-btn"
                     class="zen-integrations-header-btn zen-integrations-compose-action" />
      <toolbarbutton id="zen-integrations-settings-btn"
                     class="zen-integrations-header-btn zen-integrations-settings-action"
                     data-l10n-id="zen-integrations-settings-button" />
    </hbox>
    <vbox id="zen-integrations-list" flex="1" />
    <label class="zen-integrations-empty" hidden="true" />
  </vbox>
</panel>
