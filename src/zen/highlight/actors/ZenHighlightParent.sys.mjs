
export class ZenHighlightParent extends JSWindowActorParent {
  debug(msg) {
    dump("ZEN_HIGHLIGHT_PARENT: " + msg + "\n");
    console.debug("ZenHighlightParent:", msg);
  }

  receiveMessage(message) {
    this.debug("receiveMessage: " + message.name);
    const browser = this.browsingContext.top.embedderElement || this.manager.rootFrameLoader?.ownerElement;
    if (!browser) {
      this.debug("No browser (embedderElement & rootFrameLoader are null)");
      return;
    }
    const win = browser.ownerGlobal || browser.ownerDocument?.defaultView;
    if (!win) {
      this.debug("browser found but win is null");
      return;
    }
    
    // Ensure manager is loaded and initialized on the window
    if (!win.gZenHighlightManager) {
      this.debug("gZenHighlightManager NOT FOUND on window!");
      return; // Not initialized or window is closing
    }
    
    this.debug("gZenHighlightManager FOUND! calling show/hide");
    if (message.name === "ZenHighlight:Selection") {
      win.gZenHighlightManager.show(message.data.text, message.data.rect, browser);
    } else if (message.name === "ZenHighlight:Hide") {
      win.gZenHighlightManager.hide();
    }
  }
}

