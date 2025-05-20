// (Ensure this path is correctly mapped in your chrome.manifest and accessible)
/* eslint-env mozilla/frame-script */


function log(message) {
  //dump("ZenEdgeScrollFrame: " + message + "\n"); // Use dump for debugging frame scripts
  // Or send a message back to parent for logging if preferred for easier viewing
  // sendAsyncMessage("ZenEdgeScroll:Log", { message });
}

console.log("Frame script loaded for: " + (content && content.document ? content.document.location.href : "unknown content location"));

addMessageListener("ZenEdgeScroll:ScrollToPercentage", function(message) {
  const doc = content.document;
  const scrollableElement = doc.scrollingElement || doc.documentElement || doc.body;

  if (scrollableElement && scrollableElement.scrollHeight > scrollableElement.clientHeight) {
    const percentage = message.data.percentage;
    const targetScrollTop = percentage * (scrollableElement.scrollHeight - scrollableElement.clientHeight);
    scrollableElement.scrollTop = Math.max(0, Math.min(targetScrollTop, scrollableElement.scrollHeight - scrollableElement.clientHeight));
  } else {
    console.log("ScrollToPercentage: Content not scrollable or no scrollable element.");
  }
});

addMessageListener("ZenEdgeScroll:DispatchWheel", function(message) {
  console.log("hello2");
  const doc = content.document;
  // Dispatch to documentElement, as it's a common target and will bubble.
  // Or, could try to find the focused element or element under mouse if more precision is needed.
  const targetElement = doc.documentElement; // Or doc.body, or content.document.scrollingElement

  if (targetElement) {
    const eventData = message.data.wheelData;
    try {
      const clonedWheelEvent = new content.WheelEvent("wheel", { // Use content.WheelEvent
        deltaX: eventData.deltaX,
        deltaY: eventData.deltaY,
        deltaZ: eventData.deltaZ,
        deltaMode: eventData.deltaMode,
        bubbles: true,
        cancelable: true,
        composed: true, // Important for events crossing shadow DOM boundaries
        view: content,    // 'content' is the window in a frame script
      });
      targetElement.dispatchEvent(clonedWheelEvent);
      console.log(`Dispatched wheel event: dY=${eventData.deltaY}`);
    } catch (e) {
      console.log(`Error dispatching wheel event: ${e} - ${e.stack}`);
    }
  } else {
    console.log("DispatchWheel: No targetElement found.");
  }
});