/* eslint-env mozilla/frame-script */

function logFrame(message) {
  dump("ZenEdgeScrollFrame: " + message + "\n");
}

logFrame("Frame script loaded for: " + (content && content.document ? content.document.location.href : "unknown content location"));

addMessageListener("ZenEdgeScroll:SynthesizeMouseEvent", function(message) {
  const data = message.data;
  if (!data || !data.type) {
    logFrame("SynthesizeMouseEvent: Invalid data received.");
    return;
  }

  // clientX, clientY are relative to the content viewport
  const targetElement = content.document.elementFromPoint(data.clientX, data.clientY) || content.document.documentElement;

  if (targetElement) {
    try {
      const syntheticEvent = new content.MouseEvent(data.type, {
        bubbles: true,
        cancelable: (data.type !== 'mousemove'), // mousemove is often not cancelable by default
        composed: true,
        view: content,
        detail: (data.type === 'mousedown' || data.type === 'mouseup' || data.type === 'click') ? 1 : 0, // click count
        screenX: data.screenX,
        screenY: data.screenY,
        clientX: data.clientX,
        clientY: data.clientY,
        ctrlKey: data.ctrlKey,
        altKey: data.altKey,
        shiftKey: data.shiftKey,
        metaKey: data.metaKey,
        button: data.button,
        buttons: data.buttons,
      });
      targetElement.dispatchEvent(syntheticEvent);
      // logFrame(`Dispatched synthetic ${data.type} at (${data.clientX}, ${data.clientY}) on ${targetElement.tagName}`);
    } catch (e) {
      logFrame(`Error dispatching synthetic ${data.type}: ${e} - ${e.stack}`);
    }
  } else {
    logFrame(`SynthesizeMouseEvent: No target element found at (${data.clientX}, ${data.clientY})`);
  }
});

addMessageListener("ZenEdgeScroll:SynthesizeWheelEvent", function(message) {
  const data = message.data;
   if (!data) {
    logFrame("SynthesizeWheelEvent: Invalid data received.");
    return;
  }

  const targetElement = content.document.elementFromPoint(data.clientX, data.clientY) || content.document.documentElement;

  if (targetElement) {
    try {
      const syntheticEvent = new content.WheelEvent('wheel', { // type is always 'wheel'
        bubbles: true,
        cancelable: true,
        composed: true,
        view: content,
        screenX: data.screenX,
        screenY: data.screenY,
        clientX: data.clientX,
        clientY: data.clientY,
        ctrlKey: data.ctrlKey,
        altKey: data.altKey,
        shiftKey: data.shiftKey,
        metaKey: data.metaKey,
        button: data.button, // Usually 0 for wheel
        buttons: data.buttons,
        deltaX: data.deltaX,
        deltaY: data.deltaY,
        deltaZ: data.deltaZ,
        deltaMode: data.deltaMode,
      });
      targetElement.dispatchEvent(syntheticEvent);
      // logFrame(`Dispatched synthetic wheel at (${data.clientX}, ${data.clientY}) on ${targetElement.tagName}`);
    } catch (e) {
      logFrame(`Error dispatching synthetic wheel event: ${e} - ${e.stack}`);
    }
  } else {
     logFrame(`SynthesizeWheelEvent: No target element found at (${data.clientX}, ${data.clientY})`);
  }
});

// Remove the old ScrollToPercentage listener if it's no longer needed
// addMessageListener("ZenEdgeScroll:ScrollToPercentage", function(message) { /* ... */ });