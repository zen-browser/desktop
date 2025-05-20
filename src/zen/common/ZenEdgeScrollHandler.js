// Suggested filepath: /home/stnav/Projects/others/zen-desktop/src/zen/ui/EdgeScrollHandler.js
// (Or any other suitable path within your project for browser chrome scripts)

(function() {
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

  // Initialize frame scripts for existing and new tabs
  function initFrameScripts() {
    if (!gBrowser || typeof gBrowser.tabs === 'undefined' || !gBrowser.tabs.length) {
        logParent("gBrowser not ready or no tabs for initFrameScripts.");
        if (!window.gEdgeScrollInitRetryCount || window.gEdgeScrollInitRetryCount < 5) { // Limit retries
            window.gEdgeScrollInitRetryCount = (window.gEdgeScrollInitRetryCount || 0) + 1;
            setTimeout(initFrameScripts, 500 * window.gEdgeScrollInitRetryCount);
        }
        return;
    }

    logParent("Initializing frame scripts for tabs...");
    for (const tab of gBrowser.tabs) {
      if (tab.linkedBrowser) {
        loadFrameScriptForBrowser(tab.linkedBrowser);
      }
    }

    gBrowser.tabContainer.addEventListener("TabOpen", event => {
      const browser = event.target.linkedBrowser;
      if (browser) {
        // Frame scripts are often loaded on demand or when the browser is ready
        // Listening for 'load' or 'DOMContentLoaded' on the browser might be more robust
        // For now, direct load on TabOpen
        loadFrameScriptForBrowser(browser);
      }
    });

    gBrowser.tabContainer.addEventListener("TabSelect", event => {
      const browser = event.target.linkedBrowser;
      if (browser) {
        loadFrameScriptForBrowser(browser);
      }
    });
    
    if (gBrowser.selectedBrowser) {
        loadFrameScriptForBrowser(gBrowser.selectedBrowser);
    }
  }


  function getGapZoneInfo(event) {
    const activeBrowser = gBrowser.selectedBrowser;
    if (!activeBrowser) {
      return { isInGap: false, targetBrowser: null, browserRect: null };
    }

    const activeBrowserRect = activeBrowser.getBoundingClientRect();
    const windowWidth = mainBrowserWindow.innerWidth;

    const isActiveBrowserRightmost =
      (windowWidth - activeBrowserRect.right) < RIGHTMOST_BROWSER_PROXIMITY_THRESHOLD_PX;

    if (!isActiveBrowserRightmost) {
      return { isInGap: false, targetBrowser: null, browserRect: null };
    }

    const isInFarRightWindowEdgeGap = event.clientX > (windowWidth - EDGE_INTERACTION_WIDTH_PX) &&
                                   event.clientX < windowWidth;

    if (isInFarRightWindowEdgeGap) {
      return {
        isInGap: true,
        targetBrowser: activeBrowser,
        browserRect: activeBrowserRect,
      };
    }
    return { isInGap: false, targetBrowser: null, browserRect: null };
  }

  function createSyntheticEventData(originalEvent, targetBrowserRect, eventType) {
    const clientXInContent = Math.max(0, Math.floor(targetBrowserRect.width - SYNTHETIC_EVENT_OFFSET_FROM_EDGE));
    const clientYInContent = Math.max(0, Math.min(Math.floor(originalEvent.clientY - targetBrowserRect.top), Math.floor(targetBrowserRect.height - 1)));

    const screenX = Math.floor(mainBrowserWindow.screenX + targetBrowserRect.left + clientXInContent);
    const screenY = Math.floor(mainBrowserWindow.screenY + targetBrowserRect.top + clientYInContent);

    return {
      type: eventType,
      clientX: clientXInContent,
      clientY: clientYInContent,
      screenX: screenX,
      screenY: screenY,
      button: originalEvent.button,
      buttons: originalEvent.buttons,
      ctrlKey: originalEvent.ctrlKey,
      altKey: originalEvent.altKey,
      shiftKey: originalEvent.shiftKey,
      metaKey: originalEvent.metaKey,
      deltaX: originalEvent.deltaX || 0, // Ensure these exist for wheel
      deltaY: originalEvent.deltaY || 0,
      deltaZ: originalEvent.deltaZ || 0,
      deltaMode: originalEvent.deltaMode || 0,
    };
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
    isSynthesizingDrag = true;
    dragInitialModel.targetBrowserDuringDrag = targetBrowser;

    const eventData = createSyntheticEventData(event, gapInfo.browserRect, 'mousedown');
    targetBrowser.messageManager.sendAsyncMessage(MESSAGE_PREFIX + "SynthesizeMouseEvent", eventData);

    mainBrowserWindow.addEventListener('mousemove', handleSyntheticDrag, true); // Use capture for mousemove
    mainBrowserWindow.addEventListener('mouseup', handleSyntheticDragEnd, true);   // Use capture for mouseup
  }, true); // Use capture for mousedown

  function handleSyntheticDrag(event) {
    if (!isSynthesizingDrag || !dragInitialModel.targetBrowserDuringDrag) return;

    const targetBrowser = dragInitialModel.targetBrowserDuringDrag;
    if (gBrowser.selectedBrowser !== targetBrowser || !targetBrowser.messageManager || !targetBrowser.contentWindow) {
      logParent("Drag: Target browser changed, lost messageManager, or no contentWindow. Ending drag.");
      handleSyntheticDragEnd(event);
      return;
    }
    event.preventDefault();
    event.stopPropagation(); // Stop event from bubbling further in parent

    const targetBrowserRect = targetBrowser.getBoundingClientRect();
    const eventData = createSyntheticEventData(event, targetBrowserRect, 'mousemove');
    targetBrowser.messageManager.sendAsyncMessage(MESSAGE_PREFIX + "SynthesizeMouseEvent", eventData);
  }

  function handleSyntheticDragEnd(event) {
    if (isSynthesizingDrag && dragInitialModel.targetBrowserDuringDrag) {
        const targetBrowser = dragInitialModel.targetBrowserDuringDrag;
        if (targetBrowser.messageManager) {
            // Ensure event is not null if called without one (e.g. from a cleanup path)
            if (event) {
                event.preventDefault();
                event.stopPropagation();
                const targetBrowserRect = targetBrowser.getBoundingClientRect();
                const eventData = createSyntheticEventData(event, targetBrowserRect, 'mouseup');
                targetBrowser.messageManager.sendAsyncMessage(MESSAGE_PREFIX + "SynthesizeMouseEvent", eventData);
            } else {
                // If event is null, we might not have coordinates for mouseup.
                // Depending on desired behavior, could send a generic mouseup or skip.
                // For now, we only send if we have an event.
                logParent("DragEnd: Called without an event, mouseup not synthesized to content.");
            }
        }
    }
    
    isSynthesizingDrag = false;
    dragInitialModel.targetBrowserDuringDrag = null;
    mainBrowserWindow.removeEventListener('mousemove', handleSyntheticDrag, true);
    mainBrowserWindow.removeEventListener('mouseup', handleSyntheticDragEnd, true);
    // logParent("DragEnd: Event listeners removed.");
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

    const eventData = createSyntheticEventData(event, gapInfo.browserRect, 'wheel'); // type 'wheel' is just for our data
    targetBrowser.messageManager.sendAsyncMessage(MESSAGE_PREFIX + "SynthesizeWheelEvent", eventData);
  }, { capture: true, passive: false });

  // Initialize frame script loading logic
  // Ensure gBrowser is available before initializing
  if (document.readyState === "complete" || document.readyState === "interactive") {
    initFrameScripts();
  } else {
    mainBrowserWindow.addEventListener("load", initFrameScripts, { once: true });
  }

  logParent("Edge Scroll Handler Initialized (IPC for Synthetic Events)");
})();