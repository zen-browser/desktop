/* eslint-env mozilla/frame-script */
/* global content, Components */ // For linter

const { utils: Cu, interfaces: Ci } = Components;

export class ZenEdgeScrollChild extends JSWindowActorChild {
  constructor() {
    super();
  }

  receiveMessage(message) {
    switch (message.name) {
      case 'ZenEdgeScroll:SynthesizeMouseEvent':
        this.handleSynthesizeMouseEvent(message.data);
        break;
      case 'ZenEdgeScroll:DispatchWheel':
        this.handleDispatchWheel(message.data);
        break;
      default:
    }
  }

  handleSynthesizeMouseEvent(data) {
    if (!data || !data.type) {
      return;
    }

    const contentWin = this.contentWindow;
    if (!contentWin || !contentWin.windowUtils) {
      return;
    }

    let modifiers = 0;
    if (data.altKey) modifiers |= Ci.nsIDOMWindowUtils.MODIFIER_ALT;
    if (data.ctrlKey) modifiers |= Ci.nsIDOMWindowUtils.MODIFIER_CONTROL;
    if (data.metaKey) modifiers |= Ci.nsIDOMWindowUtils.MODIFIER_META;
    if (data.shiftKey) modifiers |= Ci.nsIDOMWindowUtils.MODIFIER_SHIFT;

    if (data.type === 'mousemove' && data.buttons === 1) {
      modifiers |= Ci.nsIDOMWindowUtils.BUTTON_PRIMARY_ACTION;
    }

    let clickCount = 0;
    if (data.type === 'mousedown' || data.type === 'mouseup') {
      clickCount = 1;
    }

    try {
      contentWin.windowUtils.sendMouseEvent(
        data.type,
        data.clientX,
        data.clientY,
        data.button,
        clickCount,
        modifiers,
        false,
        0.5,
        Ci.nsIDOMWindowUtils.INPUT_SOURCE_MOUSE,
        false
      );
    } catch (e) {
      console.error('Error dispatching mouse event:', e);
    }
  }

  handleDispatchWheel({ wheelData }) {
    if (!wheelData) {
      return;
    }
    const contentWin = this.contentWindow;
    if (!contentWin || !contentWin.windowUtils) {
      return;
    }
    const doc = contentWin.document;

    const clientX =
      typeof wheelData.clientX === 'number'
        ? wheelData.clientX
        : doc.documentElement.clientWidth / 2;
    const clientY =
      typeof wheelData.clientY === 'number'
        ? wheelData.clientY
        : doc.documentElement.clientHeight / 2;

    let modifiers = 0;
    if (wheelData.altKey) modifiers |= Ci.nsIDOMWindowUtils.MODIFIER_ALT;
    if (wheelData.ctrlKey) modifiers |= Ci.nsIDOMWindowUtils.MODIFIER_CONTROL;
    if (wheelData.metaKey) modifiers |= Ci.nsIDOMWindowUtils.MODIFIER_META;
    if (wheelData.shiftKey) modifiers |= Ci.nsIDOMWindowUtils.MODIFIER_SHIFT;

    try {
      contentWin.windowUtils.sendWheelEvent(
        clientX,
        clientY,
        wheelData.deltaX,
        wheelData.deltaY,
        wheelData.deltaZ,
        wheelData.deltaMode,
        modifiers,
        0,
        0,
        true,
        false,
        false,
        false,
        false
      );
    } catch (e) {
      console.error('Error dispatching wheel event:', e);
    }
  }

  destroy() {
    super.destroy();
  }
}
