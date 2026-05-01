# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

<panel id="zen-spaces-popup"
    nonnativepopover="true"
    type="arrow"
    orient="vertical"
    side="bottom"
    hidden="true"
    consumeoutsideclicks="never">
  <hbox class="zen-spaces-list-header" flex="1">
    <image class="zen-spaces-list-search-icon" src="chrome://global/skin/icons/search-glass.svg"/>
    <html:input id="zen-spaces-list-search"
      data-l10n-id="zen-spaces-search-placeholder"
      type="search" />
  </hbox>
  <scrollbox class="zen-spaces-list-scrollbox" flex="1">
    <vbox id="zen-spaces-list"></vbox>
    <hbox id="zen-spaces-search-no-results" hidden="true" flex="1"
      data-l10n-id="zen-spaces-search-no-results" />
  </scrollbox>
</panel>
