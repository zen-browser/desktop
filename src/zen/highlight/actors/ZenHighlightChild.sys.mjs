
export class ZenHighlightChild extends JSWindowActorChild {
  handleEvent(event) {
    this.debug("handleEvent: " + event.type);
    if (event.type === "mouseup" || event.type === "selectionchange") {
      this.contentWindow.setTimeout(() => this.checkSelection(), 50);
    } else if (event.type === "scroll") {
      // On scroll, update position if selection still exists
      this.checkSelection();
    }
  }

  debug(msg) {
    dump("ZEN_HIGHLIGHT_CHILD: " + msg + "\n");
    console.debug("ZenHighlightChild:", msg);
  }

  checkSelection() {
    if (!this.document) return;
    const selection = this.document.getSelection();
    if (!selection || selection.isCollapsed) {
      this.debug("Selection empty or collapsed");
      this.sendAsyncMessage("ZenHighlight:Hide", {});
      return;
    }

    const text = selection.toString().trim();
    if (text.length > 0) {
      this.debug("Selection text found: " + text.substring(0, 10));
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      this.sendAsyncMessage("ZenHighlight:Selection", {
        text,
        rect: {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          bottom: rect.bottom,
          right: rect.right,
          screenX: this.contentWindow.mozInnerScreenX + rect.left,
          screenY: this.contentWindow.mozInnerScreenY + rect.top
        }
      });
    } else {
      this.sendAsyncMessage("ZenHighlight:Hide", {});
    }
  }
}

