/* eslint-env mozilla/frame-script */

function logFrame(message) {
  // Use dump for more reliable output from frame scripts to the system console
  console.log("ZenEdgeScrollFrame: " + message + "\n");
  // console.log("ZenEdgeScrollFrame: " + message + "\n"); // Can also be used, output goes to Browser Console
}

logFrame("Frame script loaded for: " + (content && content.document ? content.document.location.href : "unknown content location"));

// REMOVE or COMMENT OUT the old ScrollToPercentage listener
/*
addMessageListener("ZenEdgeScroll:ScrollToPercentage", function(message) {
  // ... old code ...
});
*/

addMessageListener("ZenEdgeScroll:SynthesizeMouseEvent", function(message) {
  const data = message.data;
  if (!data || !data.type) {
    logFrame("SynthesizeMouseEvent: Invalid data received.");
    return;
  }

  // clientX, clientY are relative to the content viewport, calculated by parent
  // For scrollbar interaction, dispatching on documentElement or scrollingElement is usually effective.
  const targetElement = content.document.elementFromPoint(data.clientX, data.clientY) || content.document.documentElement || content.document.body;
  
  if (!targetElement) {
    logFrame(`SynthesizeMouseEvent: No target element found at (${data.clientX}, ${data.clientY}) for ${data.type}`);
    return;
  }
  // logFrame(`SynthesizeMouseEvent: Dispatching ${data.type} at X:${data.clientX}, Y:${data.clientY} on ${targetElement.tagName}`);

  try {
    const syntheticEvent = new content.MouseEvent(data.type, {
      bubbles: true,
      cancelable: (data.type !== 'mousemove'), // mousemove is often not cancelable
      composed: true,
      view: content, // Essential: the content window
      detail: (data.type === 'mousedown' || data.type === 'mouseup' || data.type === 'click') ? 1 : 0,
      screenX: data.screenX,
      screenY: data.screenY,
      clientX: data.clientX,
      clientY: data.clientY,
      ctrlKey: data.ctrlKey,
      altKey: data.altKey,
      shiftKey: data.shiftKey,
      metaKey: data.metaKey,
      button: data.button,
      buttons: data.buttons, // Crucial for dragging state
    });
    targetElement.dispatchEvent(syntheticEvent);
  } catch (e) {
    logFrame(`Error dispatching synthetic ${data.type} event: ${e} - ${e.stack}`);
  }
});


addMessageListener("ZenEdgeScroll:DispatchWheel", function(message) {
  const doc = content.document;
  const eventData = message.data.wheelData;
  if (!eventData) {
    logFrame("DispatchWheel: No eventData received.");
    return;
  }

  // Use clientX/Y from eventData if provided, otherwise fallback
  const clientX = typeof eventData.clientX === 'number' ? eventData.clientX : (doc.documentElement.clientWidth / 2);
  const clientY = typeof eventData.clientY === 'number' ? eventData.clientY : (doc.documentElement.clientHeight / 2);
  
  const targetElement = doc.elementFromPoint(clientX, clientY) || doc.documentElement || doc.body;

  if (targetElement) {
    // logFrame(`DispatchWheel: Dispatching on ${targetElement.tagName} at X:${clientX}, Y:${clientY}`);
    try {
      const clonedWheelEvent = new content.WheelEvent("wheel", {
        deltaX: eventData.deltaX || 0, deltaY: eventData.deltaY || 0, deltaZ: eventData.deltaZ || 0,
        deltaMode: eventData.deltaMode || 0, bubbles: true, cancelable: true, composed: true, view: content,
        ctrlKey: eventData.ctrlKey, altKey: eventData.altKey, shiftKey: eventData.shiftKey, metaKey: eventData.metaKey,
        clientX: clientX, clientY: clientY, // Include clientX/Y in the event itself
        screenX: eventData.screenX, screenY: eventData.screenY, // If available
        button: 0, buttons: 0, // Wheel events typically don't have button presses
      });
      targetElement.dispatchEvent(clonedWheelEvent);
    } catch (e) {
      logFrame(`Error dispatching wheel event: ${e} - ${e.stack}`);
    }
  } else {
     logFrame("DispatchWheel: No targetElement found.");
  }
});