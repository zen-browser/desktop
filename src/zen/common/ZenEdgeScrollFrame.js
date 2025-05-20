/* eslint-env mozilla/frame-script */
/* global content, sendAsyncMessage, addMessageListener, Components */ // For linter

const { utils: Cu, interfaces: Ci } = Components;

function logFrame(message) {
  dump("ZenEdgeScrollFrame: " + message + "\n");
  console.log("ZenEdgeScrollFrame: " + message + "\n");
}

logFrame("Frame script loaded for: " + (content && content.document ? content.document.location.href : "unknown content location"));

// REMOVE or COMMENT OUT the old ScrollToPercentage listener
/*
addMessageListener("ZenEdgeScroll:ScrollToPercentage", function(message) {
  // ... old code ...
});
*/

addMessageListener("ZenEdgeScroll:SynthesizeMouseEvent", function(message) {
    logFrame("SynthesizeMouseEvent listener triggered. Current content.document.location.href = " + (content && content.document ? content.document.location.href : "unknown or error"));
  logFrame("!!! FRAME: SynthesizeMouseEvent RECEIVED! Data: " + JSON.stringify(message.data));
  const data = message.data;
  if (!data || !data.type) {
    logFrame("SynthesizeMouseEvent: Invalid data received.");
    return;
  }

  if (!content.windowUtils) {
    logFrame("SynthesizeMouseEvent: content.windowUtils is not available. Cannot send trusted event.");
    // Fallback to standard dispatchEvent (which will be untrusted) or do nothing
    // For now, let's just log and return if windowUtils is missing.
    return;
  }

  let modifiers = 0;
  if (data.altKey) modifiers |= Ci.nsIDOMWindowUtils.MODIFIER_ALT;
  if (data.ctrlKey) modifiers |= Ci.nsIDOMWindowUtils.MODIFIER_CONTROL;
  if (data.metaKey) modifiers |= Ci.nsIDOMWindowUtils.MODIFIER_META;
  if (data.shiftKey) modifiers |= Ci.nsIDOMWindowUtils.MODIFIER_SHIFT;

  // The 'buttons' property (plural) reflects the state of all buttons during the event.
  // nsIDOMWindowUtils.sendMouseEvent uses the 'button' (singular) for the primary button causing the event,
  // and modifiers can also reflect button states.
  // For dragging, the sequence of mousedown (button 0), mousemove (button 0 still considered down), mouseup (button 0)
  // is important. The 'buttons' property from the parent is trying to reflect this.
  // We need to ensure the modifier flags for sendMouseEvent correctly reflect this if necessary.
  // However, for sendMouseEvent, the primary button state is often handled by the `aButton` argument.
  // If `data.buttons` is 1 (primary button down), we can add that to modifiers for mousemove.
  if (data.type === "mousemove" && data.buttons === 1) {
    modifiers |= Ci.nsIDOMWindowUtils.BUTTON_PRIMARY_ACTION;
  }


  let clickCount = 0;
  if (data.type === "mousedown" || data.type === "mouseup") {
    clickCount = 1; // Standard for a single click part
  }

  // logFrame(`SynthesizeMouseEvent (Trusted): Dispatching ${data.type} at X:${data.clientX}, Y:${data.clientY} with button:${data.button}, buttons:${data.buttons}, clickCount:${clickCount}, modifiers:${modifiers}`);

  try {
    // Parameters for sendMouseEvent:
    // aType, aX, aY, aButton, aClickCount, aModifiers, aIgnoreRootScrollFrame,
    // aPressure (0.0 to 1.0, 0.5 for mouse), aInputSource (one of INPUT_SOURCE_*), aIsSynthesized (false for trusted)
    content.windowUtils.sendMouseEvent(
      data.type,      // e.g., "mousedown", "mousemove", "mouseup"
      data.clientX,   // X coordinate relative to the content window's viewport
      data.clientY,   // Y coordinate relative to the content window's viewport
      data.button,    // The button number (0 for left, 1 for middle, 2 for right)
      clickCount,     // Click count
      modifiers,      // Modifier keys
      false,          // aIgnoreRootScrollFrame (false means interact with page scroll)
      0.5,            // aPressure (0.5 is typical for mouse)
      Ci.nsIDOMWindowUtils.INPUT_SOURCE_MOUSE, // Input source
      false           // aIsSynthesized (false makes event.isTrusted = true)
    );
    // logFrame(`SynthesizeMouseEvent (Trusted): Dispatched ${data.type} successfully.`);
  } catch (e) {
    logFrame(`Error dispatching trusted synthetic ${data.type} event: ${e} - ${e.stack}`);
  }
});


addMessageListener("ZenEdgeScroll:DispatchWheel", function(message) {
  const doc = content.document;
  const eventData = message.data.wheelData;
  if (!eventData) {
    logFrame("DispatchWheel: No eventData received.");
    return;
  }
  if (!content.windowUtils) {
    logFrame("DispatchWheel: content.windowUtils is not available. Cannot send trusted wheel event.");
    return;
  }

  const clientX = typeof eventData.clientX === 'number' ? eventData.clientX : (doc.documentElement.clientWidth / 2);
  const clientY = typeof eventData.clientY === 'number' ? eventData.clientY : (doc.documentElement.clientHeight / 2);
  
  let modifiers = 0;
  if (eventData.altKey) modifiers |= Ci.nsIDOMWindowUtils.MODIFIER_ALT;
  if (eventData.ctrlKey) modifiers |= Ci.nsIDOMWindowUtils.MODIFIER_CONTROL;
  if (eventData.metaKey) modifiers |= Ci.nsIDOMWindowUtils.MODIFIER_META;
  if (eventData.shiftKey) modifiers |= Ci.nsIDOMWindowUtils.MODIFIER_SHIFT;

  // logFrame(`DispatchWheel (Trusted): Dispatching at X:${clientX}, Y:${clientY} with deltaY:${eventData.deltaY}`);
  try {
    // Parameters for sendWheelEvent:
    // aX, aY, aDeltaX, aDeltaY, aDeltaZ, aDeltaMode, aModifiers, aLineOrPageDeltaX, aLineOrPageDeltaY,
    // aIsNoLineOrPageDelta, aIgnoreRootScrollFrame, aIsMomentum, aIsFromTouch, aIsSynthesized
    content.windowUtils.sendWheelEvent(
      clientX,
      clientY,
      eventData.deltaX,
      eventData.deltaY,
      eventData.deltaZ,
      eventData.deltaMode,
      modifiers,
      0, // aLineOrPageDeltaX (not typically needed if pixel deltas are provided)
      0, // aLineOrPageDeltaY
      true, // aIsNoLineOrPageDelta (true if line/page deltas are not provided)
      false, // aIgnoreRootScrollFrame
      false, // aIsMomentum
      false, // aIsFromTouch
      false  // aIsSynthesized (false makes event.isTrusted = true)
    );
  } catch (e) {
    logFrame(`Error dispatching trusted wheel event: ${e} - ${e.stack}`);
  }
});