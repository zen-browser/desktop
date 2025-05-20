// Suggested filepath: /home/stnav/Projects/others/zen-desktop/src/zen/ui/EdgeScrollHandler.js
// (Or any other suitable path within your project for browser chrome scripts)

(function() {
    console.log("hahahahah");
  if (window.gEdgeScrollHandlerInitialized) {
    console.log("EdgeScrollHandler: Already initialized.");
    return;
  }
  window.gEdgeScrollHandlerInitialized = true;

  const FRAME_SCRIPT_URL = "chrome://browser/content/ZenEdgeScrollFrame.js"; // Ensure this matches your frame script's packaged URI
  const MESSAGE_PREFIX = "ZenEdgeScroll:";

  // --- START: Configuration for edge interaction ---
  const EDGE_INTERACTION_WIDTH_PX = 20; // How wide the clickable zone at the far right edge of the window is.
  const RIGHTMOST_BROWSER_PROXIMITY_THRESHOLD_PX = 25; // Increased slightly for more tolerance with window borders/shadows
  const SYNTHETIC_EVENT_OFFSET_FROM_EDGE = 3; // How many pixels inside the content edge to target (e.g., for scrollbar thumb)
  // --- END: Configuration for edge interaction ---

  const mainBrowserWindow = window; // 'window' in this context is the main browser window
  let isSynthesizingDrag = false;
  let dragInitialModel = {
    targetBrowserDuringDrag: null,
    // No scroll-specific properties needed here anymore
  };

  function logParent(message) {
    // console.log("EdgeScrollHandler (Parent): " + message);
    // dump("EdgeScrollHandler (Parent): " + message + "\n"); // For terminal output
  }

  // Function to load the frame script into a browser's message manager
  function loadFrameScriptForBrowser(browser) {
    if (browser && browser.messageManager && !browser.frameScriptLoadedForEdgeScroll) {
      try {
        logParent(`Attempting to load frame script: ${FRAME_SCRIPT_URL} for browser: ${browser.currentURI?.spec}`);
        browser.messageManager.loadFrameScript(FRAME_SCRIPT_URL, false); // false = don't delay
        browser.frameScriptLoadedForEdgeScroll = true; // Custom property to track loading
        logParent(`Frame script loading initiated for ${browser.currentURI?.spec || 'browser'}.`);
      } catch (e) {
        console.error("EdgeScrollHandler (Parent): CRITICAL ERROR loading frame script:", FRAME_SCRIPT_URL, e, "for URL:", browser.currentURI?.spec);
        dump(`EdgeScrollHandler (Parent): CRITICAL ERROR loading frame script: ${FRAME_SCRIPT_URL} - ${e} - ${e.stack}\n`);
      }
    } else if (browser && browser.frameScriptLoadedForEdgeScroll) {
      // logParent(`Frame script already marked as loaded for ${browser.currentURI?.spec}`);
    } else if (!browser) {
      logParent("loadFrameScriptForBrowser: browser is null");
    } else if (!browser.messageManager) {
      logParent(`loadFrameScriptForBrowser: browser.messageManager is null for ${browser.currentURI?.spec}`);
    }
  }
  function initFrameScripts() {
    if (!gBrowser || typeof gBrowser.tabs === 'undefined' || !gBrowser.tabs.length) {
        logParent("gBrowser not ready or no tabs for initFrameScripts.");
        if (!window.gEdgeScrollInitRetryCount || window.gEdgeScrollInitRetryCount < 5) {
            window.gEdgeScrollInitRetryCount = (window.gEdgeScrollInitRetryCount || 0) + 1;
            setTimeout(initFrameScripts, 500 * window.gEdgeScrollInitRetryCount);
        }
        return;
    }
    logParent("Initializing frame scripts for tabs...");
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
    const activeBrowser = gBrowser.selectedBrowser;
    if (!activeBrowser) return { isInGap: false, targetBrowser: null, browserRect: null };

    const activeBrowserRect = activeBrowser.getBoundingClientRect();
    const windowWidth = mainBrowserWindow.innerWidth;

    const isActiveBrowserRightmost = (windowWidth - activeBrowserRect.right) < RIGHTMOST_BROWSER_PROXIMITY_THRESHOLD_PX;
    if (!isActiveBrowserRightmost) return { isInGap: false, targetBrowser: null, browserRect: null };

    const isInFarRightWindowEdgeGap = event.clientX > (windowWidth - EDGE_INTERACTION_WIDTH_PX) && event.clientX < windowWidth;
    if (isInFarRightWindowEdgeGap) {
      return { isInGap: true, targetBrowser: activeBrowser, browserRect: activeBrowserRect };
    }
    return { isInGap: false, targetBrowser: null, browserRect: null };
  }

  mainBrowserWindow.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;

    const gapInfo = getGapZoneInfo(event);
    if (!gapInfo.isInGap || !gapInfo.targetBrowser) return;

    const targetBrowser = gapInfo.targetBrowser;
    if (!targetBrowser.messageManager) {
      logParent("Mousedown: No messageManager for target browser.");
      return;
    }
    loadFrameScriptForBrowser(targetBrowser);

    event.preventDefault();
    isDraggingEdgeScroll = true; // Changed back

    dragInitialModel.targetBrowserDuringDrag = targetBrowser;
    dragInitialModel.gapZoneHeight = gapInfo.browserRect.height; // Height of the content area
    dragInitialModel.mouseY = event.clientY; // Initial mouse Y for drag calculation

    // Calculate scroll percentage based on click position within the "virtual scrollbar" (gap area)
    const clickYInGap = event.clientY - gapInfo.browserRect.top;
    const scrollPercentage = dragInitialModel.gapZoneHeight > 0 ? Math.max(0, Math.min(1, clickYInGap / dragInitialModel.gapZoneHeight)) : 0;
    dragInitialModel.initialScrollPercentageOnDragStart = scrollPercentage;

    targetBrowser.messageManager.sendAsyncMessage(MESSAGE_PREFIX + "ScrollToPercentage", { percentage: scrollPercentage });

    mainBrowserWindow.addEventListener('mousemove', handleEdgeScrollDrag, true);
    mainBrowserWindow.addEventListener('mouseup', handleEdgeScrollEnd, true);
  }, true);

  function handleEdgeScrollDrag(event) { // Renamed back
    if (!isDraggingEdgeScroll || !dragInitialModel.targetBrowserDuringDrag) return;

    const targetBrowser = dragInitialModel.targetBrowserDuringDrag;
    if (gBrowser.selectedBrowser !== targetBrowser || !targetBrowser.messageManager) {
      logParent("Drag: Target browser changed, lost messageManager, or no contentWindow. Ending drag.");
      handleEdgeScrollEnd(event);
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    const deltaYFromInitialMouseY = event.clientY - dragInitialModel.mouseY;
    let newScrollPercentage;

    if (dragInitialModel.gapZoneHeight > 0) {
      // Calculate how much the mouse has moved as a percentage of the gap height
      const percentageDelta = deltaYFromInitialMouseY / dragInitialModel.gapZoneHeight;
      // Add this delta to the scroll percentage we had when the drag started
      newScrollPercentage = dragInitialModel.initialScrollPercentageOnDragStart + percentageDelta;
      newScrollPercentage = Math.max(0, Math.min(1, newScrollPercentage)); // Clamp between 0 and 1
    } else {
      // Fallback or error - should not happen if drag started correctly
      return;
    }
    
    targetBrowser.messageManager.sendAsyncMessage(MESSAGE_PREFIX + "ScrollToPercentage", { percentage: newScrollPercentage });
  }

  function handleEdgeScrollEnd(event) { // Renamed back
    if (isDraggingEdgeScroll && dragInitialModel.targetBrowserDuringDrag) {
        if (event) { // If called by an event
            event.preventDefault();
            event.stopPropagation();
            // Optionally, could send a final ScrollToPercentage if needed, but current logic updates on mousemove
        }
    }
    
    isDraggingEdgeScroll = false;
    // Reset parts of dragInitialModel if they are large or sensitive
    dragInitialModel.targetBrowserDuringDrag = null;
    // dragInitialModel.mouseY = 0; // etc.

    mainBrowserWindow.removeEventListener('mousemove', handleEdgeScrollDrag, true);
    mainBrowserWindow.removeEventListener('mouseup', handleEdgeScrollEnd, true);
  }

  mainBrowserWindow.addEventListener('wheel', (event) => {
    const gapInfo = getGapZoneInfo(event);
    if (!gapInfo.isInGap || !gapInfo.targetBrowser) return;
  
    const targetBrowser = gapInfo.targetBrowser;
    if (!targetBrowser.messageManager) {
      logParent("Wheel: No messageManager for target browser.");
      return;
    }
    loadFrameScriptForBrowser(targetBrowser);

    event.preventDefault();
    event.stopPropagation();

    const wheelData = {
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      deltaZ: event.deltaZ,
      deltaMode: event.deltaMode,
      // Pass necessary modifier keys if the frame script needs them for dispatching
      ctrlKey: event.ctrlKey,
      altKey: event.altKey,
      shiftKey: event.shiftKey,
      metaKey: event.metaKey,
    };
    targetBrowser.messageManager.sendAsyncMessage(MESSAGE_PREFIX + "DispatchWheel", { wheelData });
  }, { capture: true, passive: false });

  if (document.readyState === "complete" || document.readyState === "interactive") {
    initFrameScripts();
  } else {
    mainBrowserWindow.addEventListener("load", initFrameScripts, { once: true });
  }

  logParent("Edge Scroll Handler Initialized (IPC for Synthetic Events)");
})();