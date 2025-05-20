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

  /**
   * Identifies if the mouse event is in the "gap" and which browser pane is adjacent.
   */
  function getGapZoneInfo(event) {
    const windowWidth = mainBrowserWindow.innerWidth;
    const eventClientX = event.clientX;
    const eventClientY = event.clientY;

    const isInFarRightWindowEdgeGap = eventClientX > (windowWidth - EDGE_INTERACTION_WIDTH_PX) &&
                                   eventClientX < windowWidth;

    if (!isInFarRightWindowEdgeGap) {
      return { isInGap: false, targetBrowser: null, browserRect: null };
    }

    // Find the browser pane adjacent to this gap click
    let potentialTargetBrowser = null;
    let potentialTargetBrowserRect = null;

    if (gBrowser && gBrowser.browsers) {
        for (const browser of gBrowser.browsers) {
            // Ensure browser is visible and has a content window
            if (browser.hidden) continue;
            
            const browserRect = browser.getBoundingClientRect();
            if (browserRect.width === 0 || browserRect.height === 0) continue; // Skip non-rendered browsers

            // Check if this browser is at the far right edge of the window
            const isBrowserAtRightEdge = (windowWidth - browserRect.right) < RIGHTMOST_BROWSER_PROXIMITY_THRESHOLD_PX &&
                                         browserRect.right > (windowWidth - EDGE_INTERACTION_WIDTH_PX - RIGHTMOST_BROWSER_PROXIMITY_THRESHOLD_PX);

            const isEventYWithinBrowser = eventClientY >= browserRect.top && eventClientY <= browserRect.bottom;

            if (isBrowserAtRightEdge && isEventYWithinBrowser) {
                potentialTargetBrowser = browser;
                potentialTargetBrowserRect = browserRect;
                // logParent(`GapZoneInfo: Potential adjacent browser: ${browser.currentURI?.spec} at right edge. Rect: R=${browserRect.right}, T=${browserRect.top}, B=${browserRect.bottom}`);
                break; 
            }
        }
    }

    if (potentialTargetBrowser) {
      // logParent(`GapZoneInfo: Found adjacent browser: ${potentialTargetBrowser.currentURI?.spec}`);
      return {
        isInGap: true,
        targetBrowser: potentialTargetBrowser,
        browserRect: potentialTargetBrowserRect,
      };
    }

    // logParent("GapZoneInfo: Mouse in gap, but no adjacent browser found at that Y position.");
    // Return isInGap true because the click was in the edge zone, even if no specific browser was pinpointed.
    // The mousedown handler will then decide if it can proceed without a targetBrowser.
    return { isInGap: true, targetBrowser: null, browserRect: null };
  }

  mainBrowserWindow.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;

    const gapInfo = getGapZoneInfo(event);

    if (!gapInfo.isInGap || !gapInfo.targetBrowser) {
        if (gapInfo.isInGap) {
            logParent("Mousedown: In gap, but no specific adjacent browser identified by getGapZoneInfo.");
        }
        return;
    }

    let targetBrowser = gapInfo.targetBrowser; // This is the browser physically adjacent to the gap

    // Focus/select the target browser if it's not already the selected one
    if (targetBrowser !== gBrowser.selectedBrowser) {
        logParent(`Mousedown: Adjacent browser ${targetBrowser.currentURI?.spec} is not selected. Attempting to select.`);
        // Ensure we are interacting with the gBrowser instance of the main window
        const mainGBrowser = mainBrowserWindow.gBrowser; 
        if (mainGBrowser && targetBrowser.ownerGlobal && targetBrowser.ownerGlobal.gBrowser === mainGBrowser) {
            const tabToSelect = mainGBrowser.getTabForBrowser(targetBrowser);
            if (tabToSelect && mainGBrowser.selectedTab !== tabToSelect) {
                mainGBrowser.selectedTab = tabToSelect;
                logParent(`Mousedown: Switched selectedTab to the one for ${targetBrowser.currentURI?.spec}.`);
                // After tab switch, gBrowser.selectedBrowser should update.
                // Re-assign targetBrowser to be sure it's the currently selected one.
                targetBrowser = mainGBrowser.selectedBrowser; 
                // Update browserRect as it might change after selection (e.g., if UI elements shift)
                // This is important for accurate gapZoneHeight calculation.
                if (targetBrowser) { // Check if targetBrowser is still valid after selection
                    gapInfo.browserRect = targetBrowser.getBoundingClientRect();
                } else {
                    logParent("Mousedown: Target browser became null after attempting selection. Aborting.");
                    return;
                }
            } else if (tabToSelect && mainGBrowser.selectedTab === tabToSelect) {
                logParent(`Mousedown: Adjacent browser ${targetBrowser.currentURI?.spec} was already selected.`);
            } else {
                logParent(`Mousedown: Could not find tab for adjacent browser ${targetBrowser.currentURI?.spec}.`);
            }
        } else {
            logParent(`Mousedown: Cannot determine tab for adjacent browser ${targetBrowser.currentURI?.spec}.`);
        }
    }

    if (!targetBrowser || !targetBrowser.messageManager) {
      logParent("Mousedown: No messageManager for target browser (either original or after selection).");
      return;
    }
    loadFrameScriptForBrowser(targetBrowser);

    event.preventDefault();
    isDraggingEdgeScroll = true;

    dragInitialModel.targetBrowserDuringDrag = targetBrowser;
    dragInitialModel.gapZoneHeight = gapInfo.browserRect.height;
    dragInitialModel.mouseY = event.clientY;

    const clickYInGap = event.clientY - gapInfo.browserRect.top;
    const scrollPercentage = dragInitialModel.gapZoneHeight > 0 ? Math.max(0, Math.min(1, clickYInGap / dragInitialModel.gapZoneHeight)) : 0;
    dragInitialModel.initialScrollPercentageOnDragStart = scrollPercentage;

    logParent(`Mousedown on ${targetBrowser.currentURI?.spec}: gapHeight=${dragInitialModel.gapZoneHeight.toFixed(2)}, clickYInGap=${clickYInGap.toFixed(2)}, initialMouseY=${dragInitialModel.mouseY.toFixed(2)}, initialScrollPerc=${scrollPercentage.toFixed(4)}`);

    targetBrowser.messageManager.sendAsyncMessage(MESSAGE_PREFIX + "ScrollToPercentage", { percentage: scrollPercentage });

    mainBrowserWindow.addEventListener('mousemove', handleEdgeScrollDrag, true);
    mainBrowserWindow.addEventListener('mouseup', handleEdgeScrollEnd, true);
  }, true);

  function handleEdgeScrollDrag(event) {
    if (!isDraggingEdgeScroll || !dragInitialModel.targetBrowserDuringDrag) return;

    const targetBrowser = dragInitialModel.targetBrowserDuringDrag;
    // Ensure the browser being dragged is still the selected one, and it's valid
    if (gBrowser.selectedBrowser !== targetBrowser || !targetBrowser.messageManager) {
      logParent("Drag: Target browser changed, lost messageManager, or no contentWindow. Ending drag.");
      handleEdgeScrollEnd(event); // Pass event for proper cleanup if needed
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    const deltaYFromInitialMouseY = event.clientY - dragInitialModel.mouseY;
    let newScrollPercentage;

    if (dragInitialModel.gapZoneHeight > 0) {
      const percentageDelta = deltaYFromInitialMouseY / dragInitialModel.gapZoneHeight;
      newScrollPercentage = dragInitialModel.initialScrollPercentageOnDragStart + percentageDelta;
      newScrollPercentage = Math.max(0, Math.min(1, newScrollPercentage));
      // logParent(`Drag: clientY=${event.clientY.toFixed(2)}, deltaMouseY=${deltaYFromInitialMouseY.toFixed(2)}, percDelta=${percentageDelta.toFixed(4)}, newScrollPerc=${newScrollPercentage.toFixed(4)}`);
    } else {
      logParent("Drag: Error - gapZoneHeight is 0 or invalid. Cannot calculate scroll percentage.");
      handleEdgeScrollEnd(event); // End drag if calculation is impossible
      return;
    }
    
    targetBrowser.messageManager.sendAsyncMessage(MESSAGE_PREFIX + "ScrollToPercentage", { percentage: newScrollPercentage });
  }

  function handleEdgeScrollEnd(event) {
    if (isDraggingEdgeScroll && dragInitialModel.targetBrowserDuringDrag) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        // logParent("DragEnd: Releasing drag.");
    }
    
    isDraggingEdgeScroll = false;
    dragInitialModel.targetBrowserDuringDrag = null;

    mainBrowserWindow.removeEventListener('mousemove', handleEdgeScrollDrag, true);
    mainBrowserWindow.removeEventListener('mouseup', handleEdgeScrollEnd, true);
  }

  mainBrowserWindow.addEventListener('wheel', (event) => {
    // For wheel events, we can use a similar logic to find the target browser
    // or decide if wheel events in the gap should always target the *currently selected* rightmost browser.
    // For now, let's keep the wheel targeting logic simpler: it targets the *selected* browser if it's rightmost.
    // If you want wheel to also switch focus, getGapZoneInfo would need to be called here too,
    // and focus switching logic similar to mousedown would be needed.

    const activeBrowser = gBrowser.selectedBrowser;
    if (!activeBrowser) return;

    const windowWidth = mainBrowserWindow.innerWidth;
    const activeBrowserRect = activeBrowser.getBoundingClientRect();
    const isActiveBrowserRightmost = (windowWidth - activeBrowserRect.right) < RIGHTMOST_BROWSER_PROXIMITY_THRESHOLD_PX;
    const isInFarRightWindowEdgeGap = event.clientX > (windowWidth - EDGE_INTERACTION_WIDTH_PX) && event.clientX < windowWidth;

    if (!isActiveBrowserRightmost || !isInFarRightWindowEdgeGap) return;
    
    const targetBrowser = activeBrowser; // Wheel targets the active browser if it's rightmost and mouse is in gap

    if (!targetBrowser.messageManager) {
      logParent("Wheel: No messageManager for target browser.");
      return;
    }
    loadFrameScriptForBrowser(targetBrowser);

    event.preventDefault();
    event.stopPropagation();

    const wheelData = {
      deltaX: event.deltaX, deltaY: event.deltaY, deltaZ: event.deltaZ, deltaMode: event.deltaMode,
      ctrlKey: event.ctrlKey, altKey: event.altKey, shiftKey: event.shiftKey, metaKey: event.metaKey,
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