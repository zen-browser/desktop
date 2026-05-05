// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

export class ZenSplitViewParent extends JSWindowActorParent {
  async receiveMessage(message) {
    switch (message.name) {
      case "ZenSplitView:GetGlanceActivationMethod":
        return Services.prefs.getStringPref(
          "zen.glance.activation-method",
          "ctrl"
        );
      case "ZenSplitView:OpenInSplit":
        this.browsingContext.topChromeWindow.gZenViewSplitter?.splitLinkFromURL(
          message.data.url
        );
        return null;
      default:
        console.warn(`[split-view]: Unknown message: ${message.name}`);
        return null;
    }
  }
}
