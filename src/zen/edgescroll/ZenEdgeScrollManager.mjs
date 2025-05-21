{
  const EDGE_INTERACTION_WIDTH_PX = Services.prefs.getIntPref("zen.theme.border-radius", 8);
  const SYNTHETIC_EVENT_X_OFFSET_FROM_RIGHT_EDGE = 1;
  const ACTOR_NAME = "ZenEdgeScroll"; // Name used for actor registration

  function logManager(message) {
    dump("ZenEdgeScrollManager: " + message + "\n");
  }

  class ZenEdgeScrollManager extends ZenDOMOperatedFeature {
    init() {
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
      this._boundUpdateTriggerDivDisplay = this._updateTriggerDivDisplay.bind(this); // Added

      if (window.gZenEdgeScrollManagerInitialized) {
        logManager("Already initialized for this window.");
        return;
      }
      window.gZenEdgeScrollManagerInitialized = true;

      // Create and append the edge scroll trigger div
      this.edgeScrollTriggerDiv = window.document.createElement("div");
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
      window.document.documentElement.appendChild(this.edgeScrollTriggerDiv);

      this.edgeScrollTriggerDiv.addEventListener('mousedown', this._boundHandleMouseDown, true);
      this.edgeScrollTriggerDiv.addEventListener('wheel', this._boundHandleWheel, { capture: true, passive: false });

      this._updateTriggerDivDisplay(); // Added: Set initial display state
      Services.prefs.addObserver("zen.tabs.vertical.right-side", this._boundUpdateTriggerDivDisplay); // Added: Observe preference

      logManager("Initialized, edgeScrollTriggerDiv created, and event listeners added.");
    }

    destroy() {
      if (this.edgeScrollTriggerDiv) {
        this.edgeScrollTriggerDiv.removeEventListener('mousedown', this._boundHandleMouseDown, true);
        this.edgeScrollTriggerDiv.removeEventListener('wheel', this._boundHandleWheel, true);
        if (this.edgeScrollTriggerDiv.parentNode) {
          this.edgeScrollTriggerDiv.parentNode.removeChild(this.edgeScrollTriggerDiv); // Corrected removeChild call
        }
        this.edgeScrollTriggerDiv = null;
      }
      // These listeners are added to window, not edgeScrollTriggerDiv in handleMouseDown
      window.removeEventListener('mousemove', this._boundHandleSyntheticDrag, true);
      window.removeEventListener('mouseup', this._boundHandleSyntheticDragEnd, true);
      Services.prefs.removeObserver("zen.tabs.vertical.right-side", this._boundUpdateTriggerDivDisplay); // Added: Remove observer
      window.gZenEdgeScrollManagerInitialized = false;
    }

    _updateTriggerDivDisplay() { // Added method
      if (!this.edgeScrollTriggerDiv) {
        return;
      }
      if (window.gZenCompactModeManager && gZenCompactModeManager.sidebarIsOnRight) {
        this.edgeScrollTriggerDiv.style.display = "none";
      } else {
        this.edgeScrollTriggerDiv.style.display = "block";
      }
    }

    _getParentActor() {
      if (!gBrowser.selectedBrowser.browsingContext.currentWindowGlobal) {
        logManager("_getParentActor: No windowGlobalChild on window. Returning null.");
        return null;
      }
      try {
        const actor = gBrowser.selectedBrowser.browsingContext.currentWindowGlobal.getActor(ACTOR_NAME);
        // logManager(`_getParentActor: getActor('${ACTOR_NAME}') returned: ${actor}`); // Original log
        return actor;
      } catch (e) {
        logManager(`_getParentActor: Error in getActor('${ACTOR_NAME}'): ${e}`);
        return null;
      }
    }

    getGapZoneInfo(event) {
      const windowWidth = window.innerWidth;
      const eventClientY = event.clientY;

      let potentialTargetBrowser = null;
      let potentialTargetBrowserRect = null;

      const selectedBrowser = gBrowser.selectedBrowser;
      if (selectedBrowser && selectedBrowser.getAttribute("primary") === "true") {
        const selectedBrowserRect = selectedBrowser.getBoundingClientRect();
        if (selectedBrowserRect.width > 0 && selectedBrowserRect.height > 0) {
          // Check if the browser's right edge is very close to the window's right edge
          const isBrowserAtRightEdge = (windowWidth - selectedBrowserRect.right) <= EDGE_INTERACTION_WIDTH_PX + 1;
          const isEventYWithinBrowser = eventClientY >= selectedBrowserRect.top && eventClientY <= selectedBrowserRect.bottom;
          if (isBrowserAtRightEdge && isEventYWithinBrowser) {
            potentialTargetBrowser = selectedBrowser;
            potentialTargetBrowserRect = selectedBrowserRect;
          }
        }
      }

      // The event is on the trigger div, so it is "in gap". We return the browser found.
      return { isInGap: true, targetBrowser: potentialTargetBrowser, browserRect: potentialTargetBrowserRect };
    }

    createSyntheticEventData(originalEvent, targetBrowserRect, eventType) {
      const clientXInContent = Math.max(0, Math.floor(targetBrowserRect.width - SYNTHETIC_EVENT_X_OFFSET_FROM_RIGHT_EDGE));
      const clientYInContent = Math.max(0, Math.min(Math.floor(originalEvent.clientY - targetBrowserRect.top), Math.floor(targetBrowserRect.height - 1)));
      const screenX = Math.floor(window.screenX + targetBrowserRect.left + clientXInContent);
      const screenY = Math.floor(window.screenY + targetBrowserRect.top + clientYInContent);

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

      const parentActor = this._getParentActor();
      if (!parentActor || !targetBrowser.browsingContext) {
        logManager("Mousedown: No parentActor or browsingContext for target browser: " + targetBrowser.currentURI?.spec);
        return;
      }

      event.preventDefault();
      this.isSynthesizingDrag = true;
      this.dragInitialModel.targetBrowserDuringDrag = targetBrowser;
      this.dragInitialModel.targetBrowsingContextDuringDrag = targetBrowser.browsingContext;

      const eventData = this.createSyntheticEventData(event, targetBrowserRect, 'mousedown');
      // logManager(`Mousedown: Sending SynthesizeMouseEvent to ${targetBrowser.currentURI?.spec}`);
      parentActor.sendEventToChild(targetBrowser.browsingContext, "ZenEdgeScroll:SynthesizeMouseEvent", eventData);

      window.addEventListener('mousemove', this._boundHandleSyntheticDrag, true);
      window.addEventListener('mouseup', this._boundHandleSyntheticDragEnd, true);
    }

    handleSyntheticDrag(event) {
      if (!this.isSynthesizingDrag || !this.dragInitialModel.targetBrowsingContextDuringDrag) return;

      const targetBrowser = this.dragInitialModel.targetBrowserDuringDrag;
      const targetBrowsingContext = this.dragInitialModel.targetBrowsingContextDuringDrag;

      if (gBrowser.selectedBrowser !== targetBrowser) {
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
      window.removeEventListener('mousemove', this._boundHandleSyntheticDrag, true);
      window.removeEventListener('mouseup', this._boundHandleSyntheticDragEnd, true);
    }

    handleWheel(event) {
      const gapInfo = this.getGapZoneInfo(event); // event is from edgeScrollTriggerDiv

      if (!gapInfo.targetBrowser) {
        // logManager("Wheel: Event on trigger div, but no specific adjacent browser.");
        return;
      }

      const targetBrowser = gapInfo.targetBrowser;
      const targetBrowserRect = gapInfo.browserRect;
      const parentActor = this._getParentActor();

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

  // Actor Registration (must happen before manager instantiation if manager relies on actors being ready)
  // This is modeled after ZenGlanceManager's registerWindowActors
  function registerEdgeScrollActors() {
    if (Services.prefs.getBoolPref('zen.edgescroll.enabled', true)) {
      window.gZenEdgeScrollManagerInstance = new ZenEdgeScrollManager();

      const actorConfig = {
        parent: {
          esModuleURI: 'chrome://browser/content/zen-components/actors/ZenEdgeScrollParent.sys.mjs',
        },
        child: {
          esModuleURI: 'chrome://browser/content/zen-components/actors/ZenEdgeScrollChild.sys.mjs',
        },
        allFrames: true,
        matches: [
          '*://*/*',
          'about:*',         // For about: pages
        ],
        includeChrome: true,  // <--- ENSURE THIS LINE IS PRESENT AND SET TO TRUE
      };

      if (window.gZenActorsManager && typeof window.gZenActorsManager.addJSWindowActor === 'function') {
        window.gZenActorsManager.addJSWindowActor(ACTOR_NAME, actorConfig);
        logManager(`${ACTOR_NAME} actors registered via gZenActorsManager.`);
      } else {
        console.error(`Failed to register ${ACTOR_NAME} actors:`, e);
        logManager(`Failed to register ${ACTOR_NAME} actors: ${e}`);
      }
    }
  }

  registerEdgeScrollActors();

}
