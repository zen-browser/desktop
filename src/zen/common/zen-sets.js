// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

document.addEventListener(
  'MozBeforeInitialXULLayout',
  () => {
    // <commandset id="mainCommandSet"> defined in browser-sets.inc
    document
      .getElementById('zenCommandSet')
      // eslint-disable-next-line complexity
      .addEventListener('command', (event) => {
        switch (event.target.id) {
          case 'cmd_zenCompactModeToggle':
            gZenCompactModeManager.toggle();
            break;
          case 'cmd_zenCompactModeShowSidebar':
            gZenCompactModeManager.toggleSidebar();
            break;
          case 'cmd_zenCompactModeHideSidebar':
            gZenCompactModeManager.hideSidebar();
            break;
          case 'cmd_zenCompactModeHideToolbar':
            gZenCompactModeManager.hideToolbar();
            break;
          case 'cmd_zenCompactModeHideBoth':
            gZenCompactModeManager.hideBoth();
            break;
          case 'cmd_zenCompactModeShowToolbar':
            gZenCompactModeManager.toggleToolbar();
            break;
          case 'cmd_zenWorkspaceForward':
            gZenWorkspaces.changeWorkspaceShortcut();
            break;
          case 'cmd_zenWorkspaceBackward':
            gZenWorkspaces.changeWorkspaceShortcut(-1);
            break;
          case 'cmd_zenSplitViewGrid':
            gZenViewSplitter.toggleShortcut('grid');
            break;
          case 'cmd_zenSplitViewVertical':
            gZenViewSplitter.toggleShortcut('vsep');
            break;
          case 'cmd_zenSplitViewHorizontal':
            gZenViewSplitter.toggleShortcut('hsep');
            break;
          case 'cmd_zenSplitViewUnsplit':
            gZenViewSplitter.toggleShortcut('unsplit');
            break;
          case 'cmd_zenSplitViewContextMenu':
            gZenViewSplitter.contextSplitTabs();
            break;
          case 'cmd_zenCopyCurrentURLMarkdown':
            gZenCommonActions.copyCurrentURLAsMarkdownToClipboard();
            break;
          case 'cmd_zenCopyCurrentURL':
            gZenCommonActions.copyCurrentURLToClipboard();
            break;
          case 'cmd_zenPinnedTabReset':
            gZenPinnedTabManager.resetPinnedTab(gBrowser.selectedTab);
            break;
          case 'cmd_zenPinnedTabResetNoTab':
            gZenPinnedTabManager.resetPinnedTab();
            break;
          case 'cmd_zenToggleSidebar':
            gZenVerticalTabsManager.toggleExpand();
            break;
          case 'cmd_zenOpenZenThemePicker':
            gZenThemePicker.openThemePicker(event);
            break;
          case 'cmd_zenChangeWorkspaceTab':
            gZenWorkspaces.changeTabWorkspace(
              event.sourceEvent.target.getAttribute('zen-workspace-id')
            );
            break;
          case 'cmd_zenToggleTabsOnRight':
            gZenVerticalTabsManager.toggleTabsOnRight();
            break;
          case 'cmd_zenSplitViewLinkInNewTab':
            gZenViewSplitter.splitLinkInNewTab();
            break;
          case 'cmd_zenReplacePinnedUrlWithCurrent':
            gZenPinnedTabManager.replacePinnedUrlWithCurrent();
            break;
          case 'cmd_zenAddToEssentials':
            gZenPinnedTabManager.addToEssentials();
            break;
          case 'cmd_zenRemoveFromEssentials':
            gZenPinnedTabManager.removeEssentials();
            break;
          case 'cmd_zenUnloadTab':
            gZenTabUnloader.unloadTab();
            break;
          case 'cmd_zenPreventUnloadTab':
            gZenTabUnloader.preventUnloadTab();
            break;
          case 'cmd_zenIgnoreUnloadTab':
            gZenTabUnloader.ignoreUnloadTab();
            break;
          default:
            if (event.target.id.startsWith('cmd_zenWorkspaceSwitch')) {
              const index = parseInt(event.target.id.replace('cmd_zenWorkspaceSwitch', ''), 10) - 1;
              gZenWorkspaces.shortcutSwitchTo(index);
            }
            break;
        }
      });
  },
  { once: true }
);

(function() {
  if (window.gEdgeScrollHandlerInitialized) return;
  window.gEdgeScrollHandlerInitialized = true;

  const FRAME_SCRIPT_URL = "chrome://browser/content/ZenEdgeScrollFrame.js"; // Ensure this URI is correct
  const MESSAGE_PREFIX = "ZenEdgeScroll:"; // To namespace messages

  function logParent(message) {
    console.log("ZenEdgeScrollParent: " + message);
  }

  // Function to load the frame script into a browser's message manager
  function loadFrameScriptForBrowser(browser) {
    if (browser && browser.messageManager && !browser.frameScriptLoadedForEdgeScroll) {
      try {
        browser.messageManager.loadFrameScript(FRAME_SCRIPT_URL, false); // false = don't delay
        browser.frameScriptLoadedForEdgeScroll = true; // Custom property to track loading
        logParent(`Frame script loading initiated for ${browser.currentURI?.spec || 'browser'}`);
      } catch (e) {
        console.error("ZenEdgeScrollParent: Error loading frame script:", e, "for URL:", FRAME_SCRIPT_URL);
      }
    }
  }

  // Initialize frame scripts for existing and new tabs
  function initFrameScripts() {
    if (!gBrowser || !gBrowser.tabs.length) {
        logParent("gBrowser not ready or no tabs for initFrameScripts.");
        // Retry after a short delay if browser is still initializing
        if (!window.gEdgeScrollInitRetry) {
            window.gEdgeScrollInitRetry = true;
            setTimeout(initFrameScripts, 500);
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
        loadFrameScriptForBrowser(browser);
      }
    });

    // Also load on TabSelect, in case a tab was opened before this script ran fully
    // or if a browser is swapped into a tab.
    gBrowser.tabContainer.addEventListener("TabSelect", event => {
      const browser = event.target.linkedBrowser;
      if (browser) {
        loadFrameScriptForBrowser(browser);
      }
    });
    
    // Ensure for the initially selected browser
    if (gBrowser.selectedBrowser) {
        loadFrameScriptForBrowser(gBrowser.selectedBrowser);
    }
  }

  // Ensure gBrowser is available before initializing
  if (document.readyState === "complete") {
    initFrameScripts();
  } else {
    window.addEventListener("load", initFrameScripts, { once: true });
  }

  const mainBrowserWindow = window;
  let isDraggingEdgeScroll = false;
  let dragInitialModel = {
    mouseY: 0,
    targetBrowserDuringDrag: null,
    gapZoneHeight: 0,
    initialScrollPercentageOnDragStart: 0,
  };

  // --- START: Configuration for edge interaction ---
  // How wide (in pixels) the clickable zone at the far right edge of the window is.
  const EDGE_INTERACTION_WIDTH_PX = 20;
  // How close (in pixels) the active browser's right edge must be to the
  // main window's right edge to be considered "rightmost".
  const RIGHTMOST_BROWSER_PROXIMITY_THRESHOLD_PX = 15;
  // --- END: Configuration for edge interaction ---

  function getGapZoneInfo(event) {
    const activeBrowser = gBrowser.selectedBrowser;
    if (!activeBrowser) {
      // logParent("getGapZoneInfo: No selected/active browser.");
      return { isInGap: false, targetBrowser: null, browserRect: null };
    }

    const activeBrowserRect = activeBrowser.getBoundingClientRect();
    const windowWidth = mainBrowserWindow.innerWidth;

    // Condition 1: Is the *active* browser physically the rightmost browser pane?
    // Its right edge should be very close to the main window's right edge.
    const isActiveBrowserRightmost =
      (windowWidth - activeBrowserRect.right) < RIGHTMOST_BROWSER_PROXIMITY_THRESHOLD_PX;

    if (!isActiveBrowserRightmost) {
      // logParent(`getGapZoneInfo: Active browser (${activeBrowser.currentURI?.spec}) is not the rightmost. Gap to window edge: ${windowWidth - activeBrowserRect.right}px`);
      return { isInGap: false, targetBrowser: null, browserRect: null };
    }

    // Condition 2: Is the mouse event within the far right edge interaction zone of the main window?
    const isInFarRightWindowEdgeGap = event.clientX > (windowWidth - EDGE_INTERACTION_WIDTH_PX) &&
                                   event.clientX < windowWidth;

    if (isInFarRightWindowEdgeGap) {
      // logParent(`getGapZoneInfo: Mouse in far right window edge gap, and active browser (${activeBrowser.currentURI?.spec}) is rightmost.`);
      return {
        isInGap: true,
        targetBrowser: activeBrowser, // The scroll target is the active (and rightmost) browser
        browserRect: activeBrowserRect, // The geometry of this target browser
      };
    }

    // logParent("getGapZoneInfo: Conditions for edge scroll not met.");
    return { isInGap: false, targetBrowser: null, browserRect: null };
  }

  mainBrowserWindow.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return; // Only primary button

    const gapInfo = getGapZoneInfo(event);
    if (!gapInfo.isInGap || !gapInfo.targetBrowser) {
      // logParent("Mousedown: Not in valid gap or no target browser identified by getGapZoneInfo.");
      return;
    }

    const targetBrowser = gapInfo.targetBrowser; // Browser to act upon

    if (!targetBrowser.messageManager) {
      logParent("Mousedown: No messageManager for target browser.");
      return;
    }
    loadFrameScriptForBrowser(targetBrowser); // Ensure frame script is loaded for this specific browser

    event.preventDefault();
    isDraggingEdgeScroll = true;

    dragInitialModel.targetBrowserDuringDrag = targetBrowser;
    dragInitialModel.gapZoneHeight = gapInfo.browserRect.height; // Use the rect of the targetBrowser
    dragInitialModel.mouseY = event.clientY;

    const clickYInGap = event.clientY - gapInfo.browserRect.top;
    const scrollPercentage = dragInitialModel.gapZoneHeight > 0 ? Math.max(0, Math.min(1, clickYInGap / dragInitialModel.gapZoneHeight)) : 0;
    dragInitialModel.initialScrollPercentageOnDragStart = scrollPercentage;

    // logParent(`Mousedown: Sending ScrollToPercentage ${scrollPercentage} to ${targetBrowser.currentURI?.spec}`);
    targetBrowser.messageManager.sendAsyncMessage(MESSAGE_PREFIX + "ScrollToPercentage", { percentage: scrollPercentage });

    mainBrowserWindow.addEventListener('mousemove', handleEdgeScrollDrag);
    mainBrowserWindow.addEventListener('mouseup', handleEdgeScrollEnd);
  }, true);

  function handleEdgeScrollDrag(event) {
    if (!isDraggingEdgeScroll || !dragInitialModel.targetBrowserDuringDrag) return;

    const targetBrowser = dragInitialModel.targetBrowserDuringDrag;

    if (gBrowser.selectedBrowser !== targetBrowser || // Also ensure the target is still the active one during drag
        !targetBrowser.messageManager ||
        !targetBrowser.contentWindow) { // Added check for contentWindow
      // logParent("Drag: Target browser changed, lost messageManager, or no contentWindow. Ending drag.");
      handleEdgeScrollEnd(event); // Clean up
      return;
    }
    event.preventDefault();

    const deltaYFromInitialMouseY = event.clientY - dragInitialModel.mouseY;
    let newScrollPercentage;

    if (dragInitialModel.gapZoneHeight > 0) {
      const percentageDelta = deltaYFromInitialMouseY / dragInitialModel.gapZoneHeight;
      newScrollPercentage = dragInitialModel.initialScrollPercentageOnDragStart + percentageDelta;
      newScrollPercentage = Math.max(0, Math.min(1, newScrollPercentage));
    } else {
      return; // Should not happen if drag started correctly
    }
    
    targetBrowser.messageManager.sendAsyncMessage(MESSAGE_PREFIX + "ScrollToPercentage", { percentage: newScrollPercentage });
  }

  function handleEdgeScrollDrag(event) {
    if (!isDraggingEdgeScroll || !dragInitialModel.targetBrowserDuringDrag) return;

    if (gBrowser.selectedBrowser !== dragInitialModel.targetBrowserDuringDrag || !dragInitialModel.targetBrowserDuringDrag.messageManager) {
      logParent("Drag: Target browser changed or messageManager lost. Ending drag.");
      handleEdgeScrollEnd(event);
      return;
    }
    event.preventDefault();

    const deltaYFromInitialMouseY = event.clientY - dragInitialModel.mouseY;
    let newScrollPercentage;

    if (dragInitialModel.gapZoneHeight > 0) {
      const percentageDelta = deltaYFromInitialMouseY / dragInitialModel.gapZoneHeight;
      newScrollPercentage = dragInitialModel.initialScrollPercentageOnDragStart + percentageDelta;
      newScrollPercentage = Math.max(0, Math.min(1, newScrollPercentage));
    } else {
      // Fallback if gapZoneHeight was 0, though unlikely if drag started.
      // In this case, we might not be able to calculate a meaningful percentage.
      // For simplicity, we'll just not scroll further if gapZoneHeight is 0.
      return;
    }
    
    // logParent(`Drag: Sending ScrollToPercentage ${newScrollPercentage}`);
    dragInitialModel.targetBrowserDuringDrag.messageManager.sendAsyncMessage(MESSAGE_PREFIX + "ScrollToPercentage", { percentage: newScrollPercentage });
  }

  function handleEdgeScrollEnd(event) {
    if (event && event.button !== 0 && isDraggingEdgeScroll) return;
    
    isDraggingEdgeScroll = false;
    dragInitialModel.targetBrowserDuringDrag = null;
    mainBrowserWindow.removeEventListener('mousemove', handleEdgeScrollDrag);
    mainBrowserWindow.removeEventListener('mouseup', handleEdgeScrollEnd);
    logParent("DragEnd: Event listeners removed.");
  }

  mainBrowserWindow.addEventListener('wheel', (event) => {
    const gapInfo = getGapZoneInfo(event);
    if (!gapInfo || !gapInfo.isInGap) return;

    const currentBrowser = gBrowser.selectedBrowser;
    if (!currentBrowser || !currentBrowser.messageManager) {
      logParent("Wheel: No selected browser or messageManager.");
      return;
    }
    loadFrameScriptForBrowser(currentBrowser);


    event.preventDefault();
    event.stopPropagation();

    const wheelData = {
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      deltaZ: event.deltaZ,
      deltaMode: event.deltaMode,
    };
    logParent(`Wheel: Sending DispatchWheel dY=${wheelData.deltaY}`);
    currentBrowser.messageManager.sendAsyncMessage(MESSAGE_PREFIX + "DispatchWheel", { wheelData });
  }, { capture: true, passive: false });

  logParent("Edge Scroll Handler Initialized (IPC version)");
})();