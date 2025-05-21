/* eslint-env mozilla/frame-script */
/* global content, Components */ // For linter

const { utils: Cu, interfaces: Ci } = Components;

function logChild(message) {
  dump("ZenEdgeScrollChild: " + message + "\n");
  // console.log("ZenEdgeScrollChild: " + message + "\n"); // Optional: for browser console
}

export class ZenEdgeScrollChild extends JSWindowActorChild {
  constructor() {
    super();
    // logChild("Constructor. Initial content URL: " + (this.contentWindow?.document?.location?.href || "unknown"));
  }

  receiveMessage(message) {
    logChild(`Received message in child: ${message.name} for URL: ${this.contentWindow?.document?.location?.href || "unknown"}`);
    switch (message.name) {
      case "ZenEdgeScroll:SynthesizeMouseEvent":
        this.handleSynthesizeMouseEvent(message.data);
        break;
      case "ZenEdgeScroll:DispatchWheel":
        this.handleDispatchWheel(message.data);
        break;
      default:
        logChild(`Unknown message received: ${message.name}`);
    }
  }

  handleSynthesizeMouseEvent(data) {
    if (!data || !data.type) {
      logChild("SynthesizeMouseEvent: Invalid data received.");
      return;
    }

    const contentWin = this.contentWindow;
    if (!contentWin || !contentWin.windowUtils) {
      logChild("SynthesizeMouseEvent: content.windowUtils is not available. URL: " + (contentWin?.document?.location?.href || "unknown"));
      return;
    }

    let modifiers = 0;
    if (data.altKey) modifiers |= Ci.nsIDOMWindowUtils.MODIFIER_ALT;
    if (data.ctrlKey) modifiers |= Ci.nsIDOMWindowUtils.MODIFIER_CONTROL;
    if (data.metaKey) modifiers |= Ci.nsIDOMWindowUtils.MODIFIER_META;
    if (data.shiftKey) modifiers |= Ci.nsIDOMWindowUtils.MODIFIER_SHIFT;

    if (data.type === "mousemove" && data.buttons === 1) {
      modifiers |= Ci.nsIDOMWindowUtils.BUTTON_PRIMARY_ACTION;
    }

    let clickCount = 0;
    if (data.type === "mousedown" || data.type === "mouseup") {
      clickCount = 1;
    }

    try {
      // logChild(`SynthesizeMouseEvent: Dispatching ${data.type} to ${contentWin.document.location.href} at X:${data.clientX}, Y:${data.clientY}`);
      contentWin.windowUtils.sendMouseEvent(
        data.type, data.clientX, data.clientY, data.button,
        clickCount, modifiers, false, 0.5,
        Ci.nsIDOMWindowUtils.INPUT_SOURCE_MOUSE, false
      );
    } catch (e) {
      logChild(`Error dispatching trusted synthetic ${data.type} event: ${e} - ${e.stack}. URL: ` + (contentWin?.document?.location?.href || "unknown"));
    }
  }

  handleDispatchWheel({ wheelData }) {
    if (!wheelData) {
      logChild("DispatchWheel: No wheelData received.");
      return;
    }
    const contentWin = this.contentWindow;
     if (!contentWin || !contentWin.windowUtils) {
      logChild("DispatchWheel: content.windowUtils is not available. URL: " + (contentWin?.document?.location?.href || "unknown"));
      return;
    }
    const doc = contentWin.document;


    const clientX = typeof wheelData.clientX === 'number' ? wheelData.clientX : (doc.documentElement.clientWidth / 2);
    const clientY = typeof wheelData.clientY === 'number' ? wheelData.clientY : (doc.documentElement.clientHeight / 2);

    let modifiers = 0;
    if (wheelData.altKey) modifiers |= Ci.nsIDOMWindowUtils.MODIFIER_ALT;
    if (wheelData.ctrlKey) modifiers |= Ci.nsIDOMWindowUtils.MODIFIER_CONTROL;
    if (wheelData.metaKey) modifiers |= Ci.nsIDOMWindowUtils.MODIFIER_META;
    if (wheelData.shiftKey) modifiers |= Ci.nsIDOMWindowUtils.MODIFIER_SHIFT;

    try {
      // logChild(`DispatchWheel: Dispatching to ${contentWin.document.location.href} at X:${clientX}, Y:${clientY}`);
      contentWin.windowUtils.sendWheelEvent(
        clientX, clientY, wheelData.deltaX, wheelData.deltaY, wheelData.deltaZ,
        wheelData.deltaMode, modifiers, 0, 0, true, false, false, false, false
      );
    } catch (e) {
      logChild(`Error dispatching trusted wheel event: ${e} - ${e.stack}. URL: ` + (contentWin?.document?.location?.href || "unknown"));
    }
  }

  destroy() {
    // logChild("Destroying ZenEdgeScrollChild for " + (this.contentWindow?.document?.location?.href || "unknown"));
    super.destroy();
  }
}