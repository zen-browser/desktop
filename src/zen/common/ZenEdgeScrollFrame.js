/* eslint-env mozilla/frame-script */

function logFrame(message) {
  console.log("ZenEdgeScrollFrame: " + message + "\n");
}

logFrame("Frame script loaded for: " + (content && content.document ? content.document.location.href : "unknown content location"));

addMessageListener("ZenEdgeScroll:ScrollToPercentage", function(message) {
  const doc = content.document;
  // Prefer scrollingElement for consistency, fallback to documentElement or body
  const scrollableElement = doc.scrollingElement || doc.documentElement || doc.body;

  if (scrollableElement && scrollableElement.scrollHeight > scrollableElement.clientHeight) {
    const percentage = message.data.percentage;
    if (typeof percentage !== 'number') {
      logFrame("ScrollToPercentage: Invalid percentage received - " + percentage);
      return;
    }

    // Store original scroll-behavior and set to auto for instant scroll
    const originalScrollBehavior = scrollableElement.style.scrollBehavior;
    scrollableElement.style.scrollBehavior = 'auto';

    try {
      const targetScrollTop = percentage * (scrollableElement.scrollHeight - scrollableElement.clientHeight);
      scrollableElement.scrollTop = Math.max(0, Math.min(targetScrollTop, scrollableElement.scrollHeight - scrollableElement.clientHeight));
      logFrame(`Scrolled (instant) to ${percentage * 100}%`);
    } finally {
      // Restore original scroll-behavior
      // Using requestAnimationFrame can help ensure the style is restored after the scroll has visually processed.
      content.requestAnimationFrame(() => {
         scrollableElement.style.scrollBehavior = originalScrollBehavior;
      });
    }
  } else {
    // logFrame("ScrollToPercentage: Content not scrollable or no scrollable element.");
  }
});

addMessageListener("ZenEdgeScroll:DispatchWheel", function(message) {
  const doc = content.document;
  // Dispatch to documentElement, as it's a common target and will bubble.
  // Or, could try to find the focused element or element under mouse if more precision is needed.
  const targetElement = doc.documentElement; // Or doc.body, or content.document.scrollingElement

  if (targetElement) {
    const eventData = message.data.wheelData;
    if (!eventData) {
        logFrame("DispatchWheel: No eventData received.");
        return;
    }
    try {
      // Use content.WheelEvent to ensure it's the content's native event type
      const clonedWheelEvent = new content.WheelEvent("wheel", {
        deltaX: eventData.deltaX || 0,
        deltaY: eventData.deltaY || 0,
        deltaZ: eventData.deltaZ || 0,
        deltaMode: eventData.deltaMode || 0,
        bubbles: true,
        cancelable: true,
        composed: true,
        view: content, // 'content' is the window in a frame script
        // Pass modifier keys if needed by the page's wheel handlers
        ctrlKey: eventData.ctrlKey,
        altKey: eventData.altKey,
        shiftKey: eventData.shiftKey,
        metaKey: eventData.metaKey,
      });
      targetElement.dispatchEvent(clonedWheelEvent);
      // logFrame(`Dispatched wheel event: dY=${eventData.deltaY}`);
    } catch (e) {
      logFrame(`Error dispatching wheel event: ${e} - ${e.stack}`);
    }
  } else {
    // logFrame("DispatchWheel: No targetElement found.");
  }
});

// Ensure listeners for SynthesizeMouseEvent and SynthesizeWheelEvent are removed or commented out
// addMessageListener("ZenEdgeScroll:SynthesizeMouseEvent", function(message) { /* ... */ });
// addMessageListener("ZenEdgeScroll:SynthesizeWheelEvent", function(message) { /* ... */ });