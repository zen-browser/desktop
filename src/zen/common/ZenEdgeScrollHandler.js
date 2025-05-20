(function() {
  if (window.gEdgeScrollHandlerInitialized) {
    return;
  }
  window.gEdgeScrollHandlerInitialized = true;

  const FRAME_SCRIPT_URL = "chrome://browser/content/ZenEdgeScrollFrame.js";
  const MESSAGE_PREFIX = "ZenEdgeScroll:";

  const EDGE_INTERACTION_WIDTH_PX = 20;
  const RIGHTMOST_BROWSER_PROXIMITY_THRESHOLD_PX = 25;
  // How many pixels from the right edge of the content viewport to target the synthetic click
  const SYNTHETIC_EVENT_X_OFFSET_FROM_RIGHT_EDGE = 2; // Aim for the scrollbar track

  const mainBrowserWindow = window;
  let isSynthesizingDrag = false; // Changed from isDraggingEdgeScroll
  let dragInitialModel = {
    targetBrowserDuringDrag: null,
    // No scroll-percentage specific model needed here, but we store the target browser
  };

  function logParent(message) {
    // console.log("EdgeScrollHandler (Parent): " + message);
    dump("EdgeScrollHandler (Parent): " + message + "\n");
  }

  function loadFrameScriptForBrowser(browser) {
    if (browser && browser.messageManager && !browser.frameScriptLoadedForEdgeScroll) {
      try {
        browser.messageManager.loadFrameScript(FRAME_SCRIPT_URL, false);
        browser.frameScriptLoadedForEdgeScroll = true;
      } catch (e) {
        console.error("EdgeScrollHandler (Parent): CRITICAL ERROR loading frame script:", FRAME_SCRIPT_URL, e);
        dump(`EdgeScrollHandler (Parent): CRITICAL ERROR loading frame script: ${FRAME_SCRIPT_URL} - ${e} - ${e.stack}\n`);
      }
    }
  }

  function initFrameScripts() {
    if (!gBrowser || typeof gBrowser.tabs === 'undefined' || !gBrowser.tabs.length) {
        if (!window.gEdgeScrollInitRetryCount || window.gEdgeScrollInitRetryCount < 5) {
            window.gEdgeScrollInitRetryCount = (window.gEdgeScrollInitRetryCount || 0) + 1;
            setTimeout(initFrameScripts, 500 * window.gEdgeScrollInitRetryCount);
        }
        return;
    }
    for (const tab of gBrowser.tabs) {
      if (tab.linkedBrowser) loadFrameScriptForBrowser(tab.linkedBrowser);
    }
    gBrowser.tabContainer.addEventListener("TabOpen", event => {
      if (event.target.linkedBrowser) loadFrameScriptForBrowser(event.target.linkedBrowser);
    });
    gBrowser.tabContainer.addEventListener("TabSelect", event => {
      if (event.target.linkedBrowser) loadFrameScriptForBrowser(event.target.linkedBrowser);
    });
    if (gBrowser.selectedBrowser) loadFrameScriptForBrowser(gBrowser.selectedBrowser);
  }

  function getGapZoneInfo(event) {
    const windowWidth = mainBrowserWindow.innerWidth;
    const eventClientX = event.clientX;
    const eventClientY = event.clientY;
    const isInFarRightWindowEdgeGap = eventClientX > (windowWidth - EDGE_INTERACTION_WIDTH_PX) && eventClientX < windowWidth;
    if (!isInFarRightWindowEdgeGap) return { isInGap: false, targetBrowser: null, browserRect: null };

    let potentialTargetBrowser = null;
    let potentialTargetBrowserRect = null;
    if (gBrowser && gBrowser.browsers) {
        for (const browser of gBrowser.browsers) {
            if (browser.hidden || browser.getAttribute("transparent") || !browser.getAttribute("primary") ) continue;
            const browserRect = browser.getBoundingClientRect();
            if (browserRect.width === 0 || browserRect.height === 0) continue;
            const isBrowserAtRightEdge = (windowWidth - browserRect.right) < RIGHTMOST_BROWSER_PROXIMITY_THRESHOLD_PX && browserRect.right > (windowWidth - EDGE_INTERACTION_WIDTH_PX - RIGHTMOST_BROWSER_PROXIMITY_THRESHOLD_PX);
            const isEventYWithinBrowser = eventClientY >= browserRect.top && eventClientY <= browserRect.bottom;
            if (isBrowserAtRightEdge && isEventYWithinBrowser) {
                potentialTargetBrowser = browser;
                potentialTargetBrowserRect = browserRect;
                break;
            }
        }
    }
    if (potentialTargetBrowser) {
      return { isInGap: true, targetBrowser: potentialTargetBrowser, browserRect: potentialTargetBrowserRect };
    }
    return { isInGap: true, targetBrowser: null, browserRect: null };
  }

  // Helper to create common event data for IPC
  function createSyntheticEventData(originalEvent, targetBrowserRect, eventType) {
    // Coordinates relative to the target browser's viewport
    // Horizontal position: fixed, near the right edge (scrollbar)
    const clientXInContent = Math.max(0, Math.floor(targetBrowserRect.width - SYNTHETIC_EVENT_X_OFFSET_FROM_RIGHT_EDGE));
    // Vertical position: mirrors the original event's Y relative to the browser's top
    const clientYInContent = Math.max(0, Math.min(Math.floor(originalEvent.clientY - targetBrowserRect.top), Math.floor(targetBrowserRect.height - 1)));

    // Screen coordinates (approximate, good enough for synthetic events)
    const screenX = Math.floor(mainBrowserWindow.screenX + targetBrowserRect.left + clientXInContent);
    const screenY = Math.floor(mainBrowserWindow.screenY + targetBrowserRect.top + clientYInContent);

    return {
      type: eventType,
      clientX: clientXInContent,
      clientY: clientYInContent,
      screenX: screenX,
      screenY: screenY,
      button: originalEvent.button, // Typically 0 for primary
      buttons: (eventType === 'mousemove' || eventType === 'mousedown') ? 1 : 0, // Primary button pressed for down/move
      ctrlKey: originalEvent.ctrlKey,
      altKey: originalEvent.altKey,
      shiftKey: originalEvent.shiftKey,
      metaKey: originalEvent.metaKey,
    };
  }

  mainBrowserWindow.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    const gapInfo = getGapZoneInfo(event);
    if (!gapInfo.isInGap || !gapInfo.targetBrowser) {
        if (gapInfo.isInGap) logParent("Mousedown: In gap, but no specific adjacent browser.");
        return;
    }
    let targetBrowser = gapInfo.targetBrowser;
    if (targetBrowser !== gBrowser.selectedBrowser) {
        const mainGBrowser = mainBrowserWindow.gBrowser;
        if (mainGBrowser && targetBrowser.ownerGlobal && targetBrowser.ownerGlobal.gBrowser === mainGBrowser) {
            const tabToSelect = mainGBrowser.getTabForBrowser(targetBrowser);
            if (tabToSelect && mainGBrowser.selectedTab !== tabToSelect) {
                mainGBrowser.selectedTab = tabToSelect;
                targetBrowser = mainGBrowser.selectedBrowser;
                if (targetBrowser) gapInfo.browserRect = targetBrowser.getBoundingClientRect();
                else { logParent("Mousedown: Target browser null after selection."); return; }
            }
        }
    }
    if (!targetBrowser || !targetBrowser.messageManager) {
      logParent("Mousedown: No messageManager for target browser."); return;
    }
    loadFrameScriptForBrowser(targetBrowser);
    event.preventDefault();
    isSynthesizingDrag = true;
    dragInitialModel.targetBrowserDuringDrag = targetBrowser;

    const eventData = createSyntheticEventData(event, gapInfo.browserRect, 'mousedown');
    logParent(`Mousedown: Sending SynthesizeMouseEvent (mousedown) to ${targetBrowser.currentURI?.spec} at X:${eventData.clientX}, Y:${eventData.clientY}`);
    targetBrowser.messageManager.sendAsyncMessage(MESSAGE_PREFIX + "SynthesizeMouseEvent", eventData);

    mainBrowserWindow.addEventListener('mousemove', handleSyntheticDrag, true);
    mainBrowserWindow.addEventListener('mouseup', handleSyntheticDragEnd, true);
  }, true);

  function handleSyntheticDrag(event) {
    if (!isSynthesizingDrag || !dragInitialModel.targetBrowserDuringDrag) return;
    const targetBrowser = dragInitialModel.targetBrowserDuringDrag;
    if (gBrowser.selectedBrowser !== targetBrowser || !targetBrowser.messageManager) {
      logParent("Drag: Target browser changed or lost messageManager. Ending drag.");
      handleSyntheticDragEnd(event); return;
    }
    event.preventDefault(); event.stopPropagation();
    // Important: browserRect might change if window resizes or other UI shifts. Re-get it.
    const currentTargetBrowserRect = targetBrowser.getBoundingClientRect();
    if (currentTargetBrowserRect.width === 0 || currentTargetBrowserRect.height === 0) {
        logParent("Drag: Target browser rect is zero. Ending drag.");
        handleSyntheticDragEnd(event); return;
    }
    const eventData = createSyntheticEventData(event, currentTargetBrowserRect, 'mousemove');
    // logParent(`Drag: Sending SynthesizeMouseEvent (mousemove) to ${targetBrowser.currentURI?.spec} at X:${eventData.clientX}, Y:${eventData.clientY}`);
    targetBrowser.messageManager.sendAsyncMessage(MESSAGE_PREFIX + "SynthesizeMouseEvent", eventData);
  }

  function handleSyntheticDragEnd(event) {
    if (isSynthesizingDrag && dragInitialModel.targetBrowserDuringDrag) {
        const targetBrowser = dragInitialModel.targetBrowserDuringDrag;
        if (targetBrowser.messageManager) {
            if (event) { // If called by an event
                event.preventDefault(); event.stopPropagation();
                const currentTargetBrowserRect = targetBrowser.getBoundingClientRect();
                 if (currentTargetBrowserRect.width > 0 && currentTargetBrowserRect.height > 0) {
                    const eventData = createSyntheticEventData(event, currentTargetBrowserRect, 'mouseup');
                    logParent(`DragEnd: Sending SynthesizeMouseEvent (mouseup) to ${targetBrowser.currentURI?.spec} at X:${eventData.clientX}, Y:${eventData.clientY}`);
                    targetBrowser.messageManager.sendAsyncMessage(MESSAGE_PREFIX + "SynthesizeMouseEvent", eventData);
                } else {
                    logParent("DragEnd: Target browser rect is zero, cannot send mouseup.");
                }
            } else {
                 logParent("DragEnd: Called without event, mouseup not synthesized.");
            }
        }
    }
    isSynthesizingDrag = false;
    dragInitialModel.targetBrowserDuringDrag = null;
    mainBrowserWindow.removeEventListener('mousemove', handleSyntheticDrag, true);
    mainBrowserWindow.removeEventListener('mouseup', handleSyntheticDragEnd, true);
  }

  mainBrowserWindow.addEventListener('wheel', (event) => {
    const activeBrowser = gBrowser.selectedBrowser;
    if (!activeBrowser) return;
    const windowWidth = mainBrowserWindow.innerWidth;
    const activeBrowserRect = activeBrowser.getBoundingClientRect();
    const isActiveBrowserRightmost = (windowWidth - activeBrowserRect.right) < RIGHTMOST_BROWSER_PROXIMITY_THRESHOLD_PX;
    const isInFarRightWindowEdgeGap = event.clientX > (windowWidth - EDGE_INTERACTION_WIDTH_PX) && event.clientX < windowWidth;
    if (!isActiveBrowserRightmost || !isInFarRightWindowEdgeGap) return;
    const targetBrowser = activeBrowser;
    if (!targetBrowser.messageManager) { logParent("Wheel: No messageManager."); return; }
    loadFrameScriptForBrowser(targetBrowser);
    event.preventDefault(); event.stopPropagation();
    const wheelData = {
      deltaX: event.deltaX, deltaY: event.deltaY, deltaZ: event.deltaZ, deltaMode: event.deltaMode,
      ctrlKey: event.ctrlKey, altKey: event.altKey, shiftKey: event.shiftKey, metaKey: event.metaKey,
      // For wheel, we also need clientX/Y for the frame script to target the event
      clientX: Math.max(0, Math.floor(activeBrowserRect.width - SYNTHETIC_EVENT_X_OFFSET_FROM_RIGHT_EDGE)),
      clientY: Math.max(0, Math.min(Math.floor(event.clientY - activeBrowserRect.top), Math.floor(activeBrowserRect.height - 1)))
    };
    logParent(`Wheel: Sending DispatchWheel to ${targetBrowser.currentURI?.spec} with deltaX:${wheelData.deltaX}, deltaY:${wheelData.deltaY}, clientX:${wheelData.clientX}, clientY:${wheelData.clientY}`);
    targetBrowser.messageManager.sendAsyncMessage(MESSAGE_PREFIX + "DispatchWheel", { wheelData });
  }, { capture: true, passive: false });

  if (document.readyState === "complete" || document.readyState === "interactive") {
    initFrameScripts();
  } else {
    mainBrowserWindow.addEventListener("load", initFrameScripts, { once: true });
  }
  logParent("Edge Scroll Handler Initialized (Synthesizing Mouse Events for Drag)");
})();