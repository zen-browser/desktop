/* global window, document, gBrowser, Services, ChromeUtils */ // Assuming gBrowser etc. are available

const EDGE_INTERACTION_WIDTH_PX = 20;
const RIGHTMOST_BROWSER_PROXIMITY_THRESHOLD_PX = 25;
const SYNTHETIC_EVENT_X_OFFSET_FROM_RIGHT_EDGE = 2;
const ACTOR_NAME = "ZenEdgeScroll"; // Name used for actor registration

function logManager(message) {
  dump("ZenEdgeScrollManager: " + message + "\n");
}

class ZenEdgeScrollManager {
  constructor(windowGlobal) {
    this.window = windowGlobal;
    this.gBrowser = this.window.gBrowser;
    this.isSynthesizingDrag = false;
    this.dragInitialModel = {
      targetBrowserDuringDrag: null,
      targetBrowsingContextDuringDrag: null,
    };

    this._boundHandleMouseDown = this.handleMouseDown.bind(this);
    this._boundHandleSyntheticDrag = this.handleSyntheticDrag.bind(this);
    this._boundHandleSyntheticDragEnd = this.handleSyntheticDragEnd.bind(this);
    this._boundHandleWheel = this.handleWheel.bind(this);

    // logManager("Constructor created");
  }

  init() {
    if (this.window.gZenEdgeScrollManagerInitialized) {
      // logManager("Already initialized for this window.");
      return;
    }
    this.window.gZenEdgeScrollManagerInitialized = true;
    this.gBrowser = this.window.gBrowser;
    if (!this.gBrowser) {
        logManager("No gBrowser found. Cannot initialize.");
        return;
    }

    this.window.addEventListener('mousedown', this._boundHandleMouseDown, true);
    this.window.addEventListener('wheel', this._boundHandleWheel, { capture: true, passive: false });

    logManager("Initialized and event listeners added.");
  }

  destroy() {
    this.window.removeEventListener('mousedown', this._boundHandleMouseDown, true);
    this.window.removeEventListener('mousemove', this._boundHandleSyntheticDrag, true);
    this.window.removeEventListener('mouseup', this._boundHandleSyntheticDragEnd, true);
    this.window.removeEventListener('wheel', this._boundHandleWheel, true);
    this.window.gZenEdgeScrollManagerInitialized = false;
    logManager("Destroyed, listeners removed.");
  }

  _getParentActor() {
    logManager(`_getParentActor: Called. this.window.location?.href is: ${this.window.location?.href}`);
    logManager(`_getParentActor: Does this.window have windowGlobalChild? ${!!this.gBrowser.selectedBrowser.browsingContext.currentWindowGlobal}`);
    if (!this.gBrowser.selectedBrowser.browsingContext.currentWindowGlobal) {
      logManager("_getParentActor: No windowGlobalChild on this.window. Returning null.");
      return null;
    }
    try {
      const actor = this.gBrowser.selectedBrowser.browsingContext.currentWindowGlobal.getActor(ACTOR_NAME);
      logManager(`_getParentActor: getActor('${ACTOR_NAME}') returned: ${actor}`); // Original log
      if (actor) {
      }
      return actor;
    } catch (e) {
      logManager(`_getParentActor: Error in getActor('${ACTOR_NAME}'): ${e}`);
      return null;
    }
  }

  getGapZoneInfo(event) {
    const windowWidth = this.window.innerWidth;
    const eventClientX = event.clientX;
    const eventClientY = event.clientY;
    const isInFarRightWindowEdgeGap = eventClientX > (windowWidth - EDGE_INTERACTION_WIDTH_PX) && eventClientX < windowWidth;
    if (!isInFarRightWindowEdgeGap) return { isInGap: false, targetBrowser: null, browserRect: null };

    let potentialTargetBrowser = null;
    let potentialTargetBrowserRect = null;
    if (this.gBrowser && this.gBrowser.browsers) {
        for (const browser of this.gBrowser.browsers) {
            // Ensure browser is suitable (visible, primary, not transparent new tab)
            if (browser.hidden || browser.getAttribute("transparent") === "true" || !browser.getAttribute("primary")) {
                 continue;
            }
            // Add any other Zen-specific checks for "active/rendered" browser if needed
            // For example, checking against gZenViewSplitter.isActiveBrowser(browser) if such a method exists

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

  createSyntheticEventData(originalEvent, targetBrowserRect, eventType) {
    const clientXInContent = Math.max(0, Math.floor(targetBrowserRect.width - SYNTHETIC_EVENT_X_OFFSET_FROM_RIGHT_EDGE));
    const clientYInContent = Math.max(0, Math.min(Math.floor(originalEvent.clientY - targetBrowserRect.top), Math.floor(targetBrowserRect.height - 1)));
    const screenX = Math.floor(this.window.screenX + targetBrowserRect.left + clientXInContent);
    const screenY = Math.floor(this.window.screenY + targetBrowserRect.top + clientYInContent);

    return {
      type: eventType, clientX: clientXInContent, clientY: clientYInContent,
      screenX: screenX, screenY: screenY, button: originalEvent.button,
      buttons: (eventType === 'mousemove' || eventType === 'mousedown') ? 1 : 0,
      ctrlKey: originalEvent.ctrlKey, altKey: originalEvent.altKey,
      shiftKey: originalEvent.shiftKey, metaKey: originalEvent.metaKey,
    };
  }

  handleMouseDown(event) {
    if (event.button !== 0) return;
    const gapInfo = this.getGapZoneInfo(event);

    if (!gapInfo.isInGap || !gapInfo.targetBrowser) {
        if (gapInfo.isInGap) { /* logManager("Mousedown: In gap, but no specific adjacent browser."); */ }
        return;
    }
    let targetBrowser = gapInfo.targetBrowser;

    // Logic to switch tab if a non-selected browser is targeted
    if (targetBrowser !== this.gBrowser.selectedBrowser) {
        const tabToSelect = this.gBrowser.getTabForBrowser(targetBrowser);
        if (tabToSelect && this.gBrowser.selectedTab !== tabToSelect) {
            this.gBrowser.selectedTab = tabToSelect;
            targetBrowser = this.gBrowser.selectedBrowser; // Re-assign after selection
            if (targetBrowser) gapInfo.browserRect = targetBrowser.getBoundingClientRect();
            else { logManager("Mousedown: Target browser null after tab selection."); return; }
        }
    }

    const parentActor = this._getParentActor();

    // Add a check before calling the method
    if (!parentActor) {
        logManager("Mousedown: parentActor is null. Bailing out.");
        return;
    }
    if (typeof parentActor.sendEventToChild !== 'function') {
        logManager(`Mousedown: parentActor.sendEventToChild is NOT a function. Actual type: ${typeof parentActor.sendEventToChild}. Actor constructor: ${parentActor?.constructor?.name}. Bailing out.`);
        return;
    }
     if (!targetBrowser?.browsingContext) { // Check this *after* confirming parentActor is valid
      logManager("Mousedown: No targetBrowser.browsingContext. Bailing out. Target: " + targetBrowser?.currentURI?.spec); return;
    }

    event.preventDefault();
    this.isSynthesizingDrag = true;
    this.dragInitialModel.targetBrowserDuringDrag = targetBrowser;
    this.dragInitialModel.targetBrowsingContextDuringDrag = targetBrowser.browsingContext;

    const eventData = this.createSyntheticEventData(event, gapInfo.browserRect, 'mousedown');
    // logManager(`Mousedown: Sending SynthesizeMouseEvent to ${targetBrowser.currentURI?.spec}`);
    parentActor.sendEventToChild(targetBrowser.browsingContext, "ZenEdgeScroll:SynthesizeMouseEvent", eventData);

    this.window.addEventListener('mousemove', this._boundHandleSyntheticDrag, true);
    this.window.addEventListener('mouseup', this._boundHandleSyntheticDragEnd, true);
  }

  handleSyntheticDrag(event) {
    if (!this.isSynthesizingDrag || !this.dragInitialModel.targetBrowsingContextDuringDrag) return;
    
    const targetBrowser = this.dragInitialModel.targetBrowserDuringDrag;
    const targetBrowsingContext = this.dragInitialModel.targetBrowsingContextDuringDrag;

    if (this.gBrowser.selectedBrowser !== targetBrowser) {
      // logManager("Drag: Target browser changed. Ending drag.");
      this.handleSyntheticDragEnd(event); return;
    }
    
    const parentActor = this._getParentActor();
     if (!parentActor) {
      logManager("Drag: No parentActor. Ending drag.");
      this.handleSyntheticDragEnd(event); return;
    }

    event.preventDefault(); event.stopPropagation();
    const currentTargetBrowserRect = targetBrowser.getBoundingClientRect();
    if (currentTargetBrowserRect.width === 0 || currentTargetBrowserRect.height === 0) {
        // logManager("Drag: Target browser rect is zero. Ending drag.");
        this.handleSyntheticDragEnd(event); return;
    }
    const eventData = this.createSyntheticEventData(event, currentTargetBrowserRect, 'mousemove');
    parentActor.sendEventToChild(targetBrowsingContext, "ZenEdgeScroll:SynthesizeMouseEvent", eventData);
  }

  handleSyntheticDragEnd(event) {
    if (this.isSynthesizingDrag && this.dragInitialModel.targetBrowsingContextDuringDrag) {
        const targetBrowser = this.dragInitialModel.targetBrowserDuringDrag;
        const targetBrowsingContext = this.dragInitialModel.targetBrowsingContextDuringDrag;
        const parentActor = this._getParentActor();

        if (parentActor && event) { // If called by an event
            event.preventDefault(); event.stopPropagation();
            const currentTargetBrowserRect = targetBrowser.getBoundingClientRect();
            if (currentTargetBrowserRect.width > 0 && currentTargetBrowserRect.height > 0) {
                const eventData = this.createSyntheticEventData(event, currentTargetBrowserRect, 'mouseup');
                // logManager(`DragEnd: Sending SynthesizeMouseEvent to ${targetBrowser?.currentURI?.spec}`);
                parentActor.sendEventToChild(targetBrowsingContext, "ZenEdgeScroll:SynthesizeMouseEvent", eventData);
            } else {
                // logManager("DragEnd: Target browser rect is zero, cannot send mouseup.");
            }
        } else if (parentActor && !event) { // Called without event (e.g. drag cancelled)
             // logManager("DragEnd: Called without event, mouseup not synthesized via event data.");
             // Optionally send a generic mouseup if needed, or just clean up.
        }
    }
    this.isSynthesizingDrag = false;
    this.dragInitialModel.targetBrowserDuringDrag = null;
    this.dragInitialModel.targetBrowsingContextDuringDrag = null;
    this.window.removeEventListener('mousemove', this._boundHandleSyntheticDrag, true);
    this.window.removeEventListener('mouseup', this._boundHandleSyntheticDragEnd, true);
  }

  handleWheel(event) {
    const activeBrowser = this.gBrowser.selectedBrowser;
    if (!activeBrowser) return;

    const windowWidth = this.window.innerWidth;
    const activeBrowserRect = activeBrowser.getBoundingClientRect();
    const isActiveBrowserRightmost = (windowWidth - activeBrowserRect.right) < RIGHTMOST_BROWSER_PROXIMITY_THRESHOLD_PX;
    const isInFarRightWindowEdgeGap = event.clientX > (windowWidth - EDGE_INTERACTION_WIDTH_PX) && event.clientX < windowWidth;

    if (!isActiveBrowserRightmost || !isInFarRightWindowEdgeGap) return;
    
    const targetBrowser = activeBrowser;
    const parentActor = this._getParentActor();

    if (!parentActor || !targetBrowser.browsingContext) {
      logManager("Wheel: No parentActor or browsingContext for target browser: " + targetBrowser.currentURI?.spec); return;
    }

    event.preventDefault(); event.stopPropagation();
    const wheelData = {
      deltaX: event.deltaX, deltaY: event.deltaY, deltaZ: event.deltaZ, deltaMode: event.deltaMode,
      ctrlKey: event.ctrlKey, altKey: event.altKey, shiftKey: event.shiftKey, metaKey: event.metaKey,
      clientX: Math.max(0, Math.floor(activeBrowserRect.width - SYNTHETIC_EVENT_X_OFFSET_FROM_RIGHT_EDGE)),
      clientY: Math.max(0, Math.min(Math.floor(event.clientY - activeBrowserRect.top), Math.floor(activeBrowserRect.height - 1)))
    };
    // logManager(`Wheel: Sending DispatchWheel to ${targetBrowser.currentURI?.spec}`);
    parentActor.sendEventToChild(targetBrowser.browsingContext, "ZenEdgeScroll:DispatchWheel", { wheelData });
  }
}

// Initialization and Actor Registration
// This should be called once per window, typically during browser startup.
// Adapt this to how Zen Desktop initializes its managers and registers actors.

(function() {
  if (window.gZenEdgeScrollManagerInstance) {
    return;
  }

  // Actor Registration (must happen before manager instantiation if manager relies on actors being ready)
  // This is modeled after ZenGlanceManager's registerWindowActors
  function registerEdgeScrollActors() {
    const actorConfig = {
      parent: {
        esModuleURI: 'chrome://browser/content/zen-components/actors/ZenEdgeScrollParent.sys.mjs',
      },
      child: {
        esModuleURI: 'chrome://browser/content/zen-components/actors/ZenEdgeScrollChild.sys.mjs',
      },
      allFrames: true, // Child actor should be available in all frames
      matches: [
        '*://*/*', // For general content pages
        'chrome://*/*' // Explicitly allow all chrome URIs
        // OR even more specific for testing:
        // 'chrome://browser/content/browser.xhtml'
      ],
      includeChrome: true,  // <--- ENSURE THIS LINE IS PRESENT AND SET TO TRUE
    };

    if (window.gZenActorsManager && typeof window.gZenActorsManager.addJSWindowActor === 'function') {
      window.gZenActorsManager.addJSWindowActor(ACTOR_NAME, actorConfig);
      logManager(`${ACTOR_NAME} actors registered via gZenActorsManager.`);
    } else {
      try {
        ChromeUtils.registerWindowActor(ACTOR_NAME, { // Name must match ACTOR_NAME
          parent: { moduleURI: actorConfig.parent.esModuleURI },
          child: { moduleURI: actorConfig.child.esModuleURI },
          matches: actorConfig.matches,
          allFrames: actorConfig.allFrames,
        });
        logManager(`${ACTOR_NAME} actors registered via ChromeUtils.registerWindowActor.`);
      } catch (e) {
        console.error(`Failed to register ${ACTOR_NAME} actors:`, e);
        logManager(`Failed to register ${ACTOR_NAME} actors: ${e}`);
      }
    }
  }

  registerEdgeScrollActors();   

  window.gZenEdgeScrollManagerInstance = new ZenEdgeScrollManager(window);
  if (document.readyState === "complete" || document.readyState === "interactive") {
      window.gZenEdgeScrollManagerInstance.init();
  } else {
      window.addEventListener("load", () => window.gZenEdgeScrollManagerInstance.init(), { once: true });
  }
})();