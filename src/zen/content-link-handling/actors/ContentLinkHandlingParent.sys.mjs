// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/* eslint-disable consistent-return */

export class ContentLinkHandlingParent extends JSWindowActorParent {
  constructor() {
    super();
  }

  async receiveMessage(message) {
    if (
      message.name !== "ContentLinkHandling:OpenSplitLink" &&
      !Services.prefs.getBoolPref("zen.glance.enabled", true)
    ) {
      return;
    }
    switch (message.name) {
      case "ContentLinkHandling:OpenSplitLink": {
        this.openSplitLink(message.data);
        break;
      }
      case "ContentLinkHandling:OpenGlance": {
        this.openGlance(this.browsingContext.topChromeWindow, message.data);
        break;
      }
      case "ContentLinkHandling:CloseGlance": {
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
      case "ContentLinkHandling:RecordLinkClickData": {
        this.browsingContext.topChromeWindow.gZenGlanceManager.lastLinkClickData =
          message.data;
        break;
      }
      default:
        console.warn(
          `[content-link-handling]: Unknown message: ${message.name}`
        );
    }
  }

  openSplitLink(data) {
    const url = data?.url;
    try {
      if (
        typeof url !== "string" ||
        Services.io.extractScheme(url) === "javascript"
      ) {
        return;
      }
    } catch {
      return;
    }
    const window = this.browsingContext.topChromeWindow;
    const browser = this.browsingContext.top.embedderElement;
    const sourceTab = window?.gBrowser?.getTabForBrowser(browser);
    if (!sourceTab || !window.gZenViewSplitter) {
      return;
    }
    window.gZenViewSplitter.openLinkInSplit(
      url,
      this.manager.documentPrincipal,
      sourceTab
    );
  }

  openGlance(window, data) {
    return window.gZenGlanceManager.openGlance(data);
  }
}
