# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# The panel is opened over the keep control from ZenStandaloneWindowManager,
# which is where the control's measured box is known, so no static position is
# declared here. `flip="slide"` keeps it from jumping above the control when the
# window is short: sliding leaves the search row on the control's own row, which
# is the whole point of the placement.
#
# `nonnative` is what makes that placement possible on macOS. Zen turns on
# widget.macos.native-popovers, which renders every type="arrow" panel as a real
# NSPopover; AppKit then owns the geometry, draws a callout arrow and centres the
# popover on its anchor, so the offsets passed to openPopup are discarded. This
# panel is meant to read as the control expanding rather than as a callout
# pointing at it, so it opts back into Gecko's own popup positioning.
<panel type="arrow" nonnative="true" orient="vertical" id="PanelUI-zen-standalone-window-spaces" flip="slide" side="bottom">
  <hbox id="PanelUI-zen-standalone-window-spaces-header" align="center">
    <image id="PanelUI-zen-standalone-window-spaces-search-icon" src="chrome://global/skin/icons/search-glass.svg"/>
    <html:input type="search" id="PanelUI-zen-standalone-window-spaces-search" data-l10n-id="zen-standalone-window-spaces-search" />
    <toolbarbutton id="PanelUI-zen-standalone-window-spaces-collapse" data-l10n-id="zen-standalone-window-spaces-collapse" />
  </hbox>
  <vbox id="PanelUI-zen-standalone-window-spaces-list" />
  <hbox id="PanelUI-zen-standalone-window-spaces-empty" hidden="true" align="center">
    <label data-l10n-id="zen-standalone-window-spaces-empty" />
  </hbox>
</panel>
