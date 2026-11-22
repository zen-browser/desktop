// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  ZenLittleWindow:
    "resource:///modules/zen/littlewindow/ZenLittleWindow.sys.mjs",
});

export class ZenContentHandlerParent extends JSWindowActorParent {
  receiveMessage(message) {
    const window = this.browsingContext.topChromeWindow;
    if (!window) {
      return;
    }
    switch (message.name) {
      case "ZenContentHandler:OpenGlance": {
        window.gZenGlanceManager.openGlance(message.data);
        break;
      }
      case "ZenContentHandler:OpenSplit": {
        window.gZenViewSplitter.splitLink({
          ...this.#linkData(message.data),
          tab: this.#tab(window),
        });
        break;
      }
      case "ZenContentHandler:OpenLittleWindow": {
        lazy.ZenLittleWindow.open({
          ...this.#linkData(message.data),
          openerWindow: window,
          userContextId: this.#tab(window)?.userContextId,
        });
        break;
      }
      case "ZenContentHandler:CloseGlance": {
        // Explicitly allowlist fields from content; never forward
        // skipPermitUnload or other privileged flags.
        const { noAnimation, setNewID, hasFocused } = message.data ?? {};
        window.gZenGlanceManager.closeGlance({
          onTabClose: true,
          noAnimation: !!noAnimation,
          setNewID: typeof setNewID === "string" ? setNewID : null,
          hasFocused: !!hasFocused,
        });
        break;
      }
      case "ZenContentHandler:RecordLinkClickData": {
        window.gZenGlanceManager.lastLinkClickData = message.data;
        break;
      }
      default:
        console.warn(`[ZenContentHandler]: Unknown message: ${message.name}`);
    }
  }

  #linkData({ url, triggeringPrincipal }) {
    return { url, triggeringPrincipal };
  }

  #tab(window) {
    const browser = this.browsingContext.top.embedderElement;
    return browser ? window.gBrowser.getTabForBrowser(browser) : null;
  }
}
