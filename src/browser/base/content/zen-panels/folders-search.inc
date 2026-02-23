# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

<panel id="zen-folder-tabs-popup" hidepopovertail="true" type="arrow" orient="vertical" side="left">
  <hbox class="tabs-list-header" flex="1">
    <image class="zen-folder-tabs-list-search-icon" src="chrome://global/skin/icons/search-glass.svg"/>
    <html:input id="zen-folder-tabs-list-search" 
      data-l10n-id="zen-folders-search-placeholder" 
      data-l10n-args="{&quot;folder-name&quot;:&quot;&quot;}"
      type="search" />
  </hbox>
  <scrollbox class="zen-folder-tabs-list-scrollbox" flex="1">
    <vbox id="zen-folder-tabs-list"></vbox>
    <hbox id="zen-folder-tabs-search-no-results" hidden="true" flex="1" data-l10n-id="zen-folders-search-no-results" />
  </scrollbox>
</panel>
