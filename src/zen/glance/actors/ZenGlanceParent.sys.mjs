// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/* eslint-disable consistent-return */

export class ZenGlanceParent extends JSWindowActorParent {
  constructor() {
    super();
  }

  async receiveMessage(message) {
    switch (message.name) {
      case "ZenGlance:OpenGlance": {
        this.openGlance(this.browsingContext.topChromeWindow, message.data);
        break;
      }
      case "ZenGlance:OpenInSplit": {
        this.openInSplit(this.browsingContext.topChromeWindow, message.data);
        break;
      }
      case "ZenGlance:CloseGlance": {
        // Explicitly allowlist fields from content; never forward
        // skipPermitUnload or other privileged flags.
        const { noAnimation, setNewID, hasFocused } = message.data ?? {};
        this.browsingContext.topChromeWindow.gZenGlanceManager.closeGlance({
          onTabClose: true,
          noAnimation: !!noAnimation,
          setNewID: typeof setNewID === "string" ? setNewID : null,
          hasFocused: !!hasFocused,
        });
        break;
      }
      case "ZenGlance:RecordLinkClickData": {
        this.browsingContext.topChromeWindow.gZenGlanceManager.lastLinkClickData =
          message.data;
        break;
      }
      default:
        console.warn(`[glance]: Unknown message: ${message.name}`);
    }
  }

  openGlance(window, data) {
    return window.gZenGlanceManager.openGlance(data);
  }

  openInSplit(window, data) {
    if (
      Services.prefs.getStringPref(
        "zen.splitView.link-activation-method",
        "none"
      ) === "none"
    ) {
      return;
    }
    // Only take the url from content. The principal comes from the
    // sender's window global, never from the message itself.
    const url = data?.url;
    const triggeringPrincipal = this.manager.documentPrincipal;
    if (typeof url !== "string" || !triggeringPrincipal?.isContentPrincipal) {
      return;
    }
    if (!window.gZenViewSplitter.canSplit) {
      // Windows without a tab bar can't split, behave like Glance there.
      this.openGlance(window, { url, triggeringPrincipal });
      return;
    }
    const browser = this.browsingContext.top.embedderElement;
    window.gZenViewSplitter.openLinkInSplit({
      url,
      triggeringPrincipal,
      sourceTab: browser ? window.gBrowser.getTabForBrowser(browser) : null,
    });
  }
}
