/* global window, document, gBrowser, Services, ChromeUtils */ // Assuming gBrowser etc. are available
{
  const EDGE_INTERACTION_WIDTH_PX = Services.prefs.getIntPref("zen.theme.border-radius", 8);
  const SYNTHETIC_EVENT_X_OFFSET_FROM_RIGHT_EDGE = 1;
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
      this.edgeScrollTriggerDiv = null; // Added for the trigger div

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

      // Create and append the edge scroll trigger div
      this.edgeScrollTriggerDiv = this.window.document.createElement("div");
      this.edgeScrollTriggerDiv.id = "zen-edge-scroll-trigger";
      Object.assign(this.edgeScrollTriggerDiv.style, {
        position: "fixed",
        top: "0px",
        right: "0px",
        width: `${EDGE_INTERACTION_WIDTH_PX}px`,
        height: "100%",
        zIndex: "2147483647", // Max z-index
        userSelect: "none",
        // backgroundColor: "rgba(255,0,0,0.1)", // For debugging visibility
      });
      this.window.document.documentElement.appendChild(this.edgeScrollTriggerDiv);

      this.edgeScrollTriggerDiv.addEventListener('mousedown', this._boundHandleMouseDown, true);
      this.edgeScrollTriggerDiv.addEventListener('wheel', this._boundHandleWheel, { capture: true, passive: false });

      logManager("Initialized, edgeScrollTriggerDiv created, and event listeners added.");
    }

    destroy() {
      if (this.edgeScrollTriggerDiv) {
        this.edgeScrollTriggerDiv.removeEventListener('mousedown', this._boundHandleMouseDown, true);
        this.edgeScrollTriggerDiv.removeEventListener('wheel', this._boundHandleWheel, true);
        if (this.edgeScrollTriggerDiv.parentNode) {
          this.edgeScrollTriggerDiv.parentNode.removeChild(this.edgeScrollTriggerDiv);
        }
        this.edgeScrollTriggerDiv = null;
      }
      // Listeners for drag are on the window, keep them if drag is active, but they are added/removed dynamically
      this.edgeScrollTriggerDiv.removeEventListener('mousemove', this._boundHandleSyntheticDrag, true);
      this.edgeScrollTriggerDiv.removeEventListener('mouseup', this._boundHandleSyntheticDragEnd, true);
      this.window.gZenEdgeScrollManagerInitialized = false;
      logManager("Destroyed, listeners removed, edgeScrollTriggerDiv removed.");
    }

    _getParentActor() {
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
      // const eventClientX = event.clientX; // event.clientX is on the trigger div
      const eventClientY = event.clientY;
      // const isInFarRightWindowEdgeGap = eventClientX > (windowWidth - EDGE_INTERACTION_WIDTH_PX) && event.clientX < windowWidth;
      // If event is from edgeScrollTriggerDiv, it's always in the "gap".
      // We just need to find the browser adjacent to this event.

      let potentialTargetBrowser = null;
      let potentialTargetBrowserRect = null;
      if (this.gBrowser && this.gBrowser.browsers) {
        for (const browser of this.gBrowser.browsers) {
          if (browser.hidden || browser.getAttribute("transparent") === "true" || !browser.getAttribute("primary")) {
            continue;
          }

          const browserRect = browser.getBoundingClientRect();
          if (browserRect.width === 0 || browserRect.height === 0) continue;

          // Check if the browser's right edge is very close to the window's right edge
          const isBrowserAtRightEdge = (windowWidth - browserRect.right) <= EDGE_INTERACTION_WIDTH_PX + 1;
          const isEventYWithinBrowser = eventClientY >= browserRect.top && eventClientY <= browserRect.bottom;

          if (isBrowserAtRightEdge && isEventYWithinBrowser) {
            potentialTargetBrowser = browser;
            potentialTargetBrowserRect = browserRect;
            break; // Found the target browser
          }
        }
      }
      // The event is on the trigger div, so it is "in gap". We return the browser found.
      return { isInGap: true, targetBrowser: potentialTargetBrowser, browserRect: potentialTargetBrowserRect };
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
      const gapInfo = this.getGapZoneInfo(event); // event is from edgeScrollTriggerDiv

      if (!gapInfo.targetBrowser) {
        // logManager("Mousedown: Event on trigger div, but no specific adjacent browser.");
        return;
      }
      let targetBrowser = gapInfo.targetBrowser;
      let targetBrowserRect = gapInfo.browserRect;

      // Logic to switch tab if a non-selected browser is targeted
      if (targetBrowser !== this.gBrowser.selectedBrowser) {
        const tabToSelect = this.gBrowser.getTabForBrowser(targetBrowser);
        if (tabToSelect && this.gBrowser.selectedTab !== tabToSelect) {
          this.gBrowser.selectedTab = tabToSelect;
          // After tab switch, gBrowser.selectedBrowser might take a moment to update,
          // or might not be the one we expect if the switch fails or is async.
          // It's safer to re-get the selectedBrowser and its rect.
          targetBrowser = this.gBrowser.selectedBrowser;
          if (targetBrowser) {
            targetBrowserRect = targetBrowser.getBoundingClientRect();
          } else {
            logManager("Mousedown: Target browser null after tab selection attempt."); return;
          }
        }
      }
      // Ensure targetBrowser and its rect are valid after potential tab switch
      if (!targetBrowser || !targetBrowserRect || targetBrowserRect.width === 0 || targetBrowserRect.height === 0) {
        logManager("Mousedown: Invalid targetBrowser or rect after potential tab switch. Bailing out.");
        return;
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
      if (!targetBrowser?.browsingContext) {
        logManager("Mousedown: No targetBrowser.browsingContext. Bailing out. Target: " + targetBrowser?.currentURI?.spec); return;
      }

      event.preventDefault();
      this.isSynthesizingDrag = true;
      this.dragInitialModel.targetBrowserDuringDrag = targetBrowser;
      this.dragInitialModel.targetBrowsingContextDuringDrag = targetBrowser.browsingContext;

      const eventData = this.createSyntheticEventData(event, targetBrowserRect, 'mousedown');
      // logManager(`Mousedown: Sending SynthesizeMouseEvent to ${targetBrowser.currentURI?.spec}`);
      parentActor.sendEventToChild(targetBrowser.browsingContext, "ZenEdgeScroll:SynthesizeMouseEvent", eventData);

      this.edgeScrollTriggerDiv.addEventListener('mousemove', this._boundHandleSyntheticDrag, true);
      this.edgeScrollTriggerDiv.addEventListener('mouseup', this._boundHandleSyntheticDragEnd, true);
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
      this.edgeScrollTriggerDiv.removeEventListener('mousemove', this._boundHandleSyntheticDrag, true);
      this.edgeScrollTriggerDiv.removeEventListener('mouseup', this._boundHandleSyntheticDragEnd, true);
    }

    handleWheel(event) {
      const gapInfo = this.getGapZoneInfo(event); // event is from edgeScrollTriggerDiv

      if (!gapInfo.targetBrowser) {
        // logManager("Wheel: Event on trigger div, but no specific adjacent browser.");
        return;
      }

      const targetBrowser = gapInfo.targetBrowser;
      const targetBrowserRect = gapInfo.browserRect;

      // Optional: If we only want to scroll the active browser when it's the one at the edge.
      // However, with the trigger div, it's more intuitive to scroll the browser that is visually there.
      // if (targetBrowser !== this.gBrowser.selectedBrowser) {
      //     logManager("Wheel: Adjacent browser is not the active one. Ignoring wheel for now.");
      //     return;
      // }

      const parentActor = this._getParentActor();

      if (!parentActor || !targetBrowser.browsingContext) {
        logManager("Wheel: No parentActor or browsingContext for target browser: " + targetBrowser.currentURI?.spec);
        return;
      }
      if (!targetBrowserRect || targetBrowserRect.width === 0 || targetBrowserRect.height === 0) {
        logManager("Wheel: Invalid targetBrowserRect for wheel event. Bailing out.");
        return;
      }


      event.preventDefault(); event.stopPropagation();
      const wheelData = {
        deltaX: event.deltaX, deltaY: event.deltaY, deltaZ: event.deltaZ, deltaMode: event.deltaMode,
        ctrlKey: event.ctrlKey, altKey: event.altKey, shiftKey: event.shiftKey, metaKey: event.metaKey,
        clientX: Math.max(0, Math.floor(targetBrowserRect.width - SYNTHETIC_EVENT_X_OFFSET_FROM_RIGHT_EDGE)),
        clientY: Math.max(0, Math.min(Math.floor(event.clientY - targetBrowserRect.top), Math.floor(targetBrowserRect.height - 1)))
      };
      // logManager(`Wheel: Sending DispatchWheel to ${targetBrowser.currentURI?.spec}`);
      parentActor.sendEventToChild(targetBrowser.browsingContext, "ZenEdgeScroll:DispatchWheel", { wheelData });
    }
  }

  // Initialization and Actor Registration
  // This should be called once per window, typically during browser startup.
  // Adapt this to how Zen Desktop initializes its managers and registers actors.
  // if (window.gZenEdgeScrollManagerInstance) {
  //   return;
  // }

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
}
