{
  const EDGE_INTERACTION_WIDTH_PX = Services.prefs.getIntPref('zen.theme.content-element-separation', 8);
  const SYNTHETIC_EVENT_X_OFFSET_FROM_RIGHT_EDGE = 2;
  const ACTOR_NAME = 'ZenEdgeScroll'; // Name used for actor registration

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
      this._initialized = false;

      if (window.gZenEdgeScrollManager._initialized === true) {
        console.warn('ZenEdgeScrollManager is already initialized.');
        return;
      }
      window.gZenEdgeScrollManager._initialized = true;

      // Create and append the edge scroll trigger div
      this.edgeScrollTriggerDiv = window.document.createElement('div');
      this.edgeScrollTriggerDiv.id = 'zen-edgescroll-trigger';
      // Object.assign(this.edgeScrollTriggerDiv.style, {
      //   position: 'fixed',
      //   top: '0px',
      //   right: '0px',
      //   width: `${EDGE_INTERACTION_WIDTH_PX}px`,
      //   height: '100%',
      //   zIndex: '2147483647', // Max z-index
      //   userSelect: 'none',
      //   // backgroundColor: "rgba(255,0,0,0.1)", // For debugging visibility
      // });
      document.getElementById("zen-appcontent-wrapper").appendChild(this.edgeScrollTriggerDiv);

      this.edgeScrollTriggerDiv.addEventListener('mousedown', this._boundHandleMouseDown, true);
      this.edgeScrollTriggerDiv.addEventListener('wheel', this._boundHandleWheel, {
        capture: true,
        passive: false,
      });

      this._updateTriggerDivDisplay(); // Added: Set initial display state
      Services.prefs.addObserver(
        'zen.tabs.vertical.right-side',
        this._boundUpdateTriggerDivDisplay
      ); // Added: Observe preference
    }

    destroy() {
      if (this.edgeScrollTriggerDiv) {
        this.edgeScrollTriggerDiv.removeEventListener(
          'mousedown',
          this._boundHandleMouseDown,
          true
        );
        this.edgeScrollTriggerDiv.removeEventListener('wheel', this._boundHandleWheel, true);
        if (this.edgeScrollTriggerDiv.parentNode) {
          this.edgeScrollTriggerDiv.parentNode.removeChild(this.edgeScrollTriggerDiv); // Corrected removeChild call
        }
        this.edgeScrollTriggerDiv = null;
      }
      // These listeners are added to window, not edgeScrollTriggerDiv in handleMouseDown
      window.removeEventListener('mousemove', this._boundHandleSyntheticDrag, true);
      window.removeEventListener('mouseup', this._boundHandleSyntheticDragEnd, true);
      Services.prefs.removeObserver(
        'zen.tabs.vertical.right-side',
        this._boundUpdateTriggerDivDisplay
      ); // Added: Remove observer
      window.gZenEdgeScrollManager._initialized = false;
    }

    _updateTriggerDivDisplay() {
      // Added method
      if (!this.edgeScrollTriggerDiv) {
        return;
      }
      if (window.gZenCompactModeManager && gZenCompactModeManager.sidebarIsOnRight) {
        this.edgeScrollTriggerDiv.style.display = 'none';
      } else {
        this.edgeScrollTriggerDiv.style.display = 'block';
      }
    }

    _getParentActor() {
      if (!gBrowser.selectedBrowser.browsingContext.currentWindowGlobal) {
        return null;
      }
      try {
        const actor =
          gBrowser.selectedBrowser.browsingContext.currentWindowGlobal.getActor(ACTOR_NAME);
        return actor;
      } catch (e) {
        console.error(`Error getting actor ${ACTOR_NAME}:`, e);
        return null;
      }
    }

    getGapZoneInfo(event) {
      const windowWidth = window.innerWidth;
      const eventClientY = event.clientY;

      let potentialTargetBrowser = null;
      let potentialTargetBrowserRect = null;

      const selectedBrowser = gBrowser.selectedBrowser;
      if (selectedBrowser && selectedBrowser.getAttribute('primary') === 'true') {
        const selectedBrowserRect = selectedBrowser.getBoundingClientRect();
        if (selectedBrowserRect.width > 0 && selectedBrowserRect.height > 0) {
          // Check if the browser's right edge is very close to the window's right edge
          const isBrowserAtRightEdge =
            windowWidth - selectedBrowserRect.right <= EDGE_INTERACTION_WIDTH_PX + 1;
          const isEventYWithinBrowser =
            eventClientY >= selectedBrowserRect.top && eventClientY <= selectedBrowserRect.bottom;
          if (isBrowserAtRightEdge && isEventYWithinBrowser) {
            potentialTargetBrowser = selectedBrowser;
            potentialTargetBrowserRect = selectedBrowserRect;
          }
        }
      }

      // The event is on the trigger div, so it is "in gap". We return the browser found.
      return {
        isInGap: true,
        targetBrowser: potentialTargetBrowser,
        browserRect: potentialTargetBrowserRect,
      };
    }

    createSyntheticEventData(originalEvent, targetBrowserRect, eventType) {
      const clientXInContent = Math.max(
        0,
        Math.floor(targetBrowserRect.width - SYNTHETIC_EVENT_X_OFFSET_FROM_RIGHT_EDGE)
      );
      const clientYInContent = Math.max(
        0,
        Math.min(
          Math.floor(originalEvent.clientY - targetBrowserRect.top),
          Math.floor(targetBrowserRect.height - 1)
        )
      );
      const screenX = Math.floor(window.screenX + targetBrowserRect.left + clientXInContent);
      const screenY = Math.floor(window.screenY + targetBrowserRect.top + clientYInContent);

      return {
        type: eventType,
        clientX: clientXInContent,
        clientY: clientYInContent,
        screenX: screenX,
        screenY: screenY,
        button: originalEvent.button,
        buttons: eventType === 'mousemove' || eventType === 'mousedown' ? 1 : 0,
        ctrlKey: originalEvent.ctrlKey,
        altKey: originalEvent.altKey,
        shiftKey: originalEvent.shiftKey,
        metaKey: originalEvent.metaKey,
      };
    }

    handleMouseDown(event) {
      if (event.button !== 0) return;
      const gapInfo = this.getGapZoneInfo(event); // event is from edgeScrollTriggerDiv

      if (!gapInfo.targetBrowser) {
        return;
      }
      let targetBrowser = gapInfo.targetBrowser;
      let targetBrowserRect = gapInfo.browserRect;

      const parentActor = this._getParentActor();
      if (!parentActor || !targetBrowser.browsingContext) {
        return;
      }

      event.preventDefault();
      this.isSynthesizingDrag = true;
      this.dragInitialModel.targetBrowserDuringDrag = targetBrowser;
      this.dragInitialModel.targetBrowsingContextDuringDrag = targetBrowser.browsingContext;

      const eventData = this.createSyntheticEventData(event, targetBrowserRect, 'mousedown');
      parentActor.sendEventToChild(
        targetBrowser.browsingContext,
        'ZenEdgeScroll:SynthesizeMouseEvent',
        eventData
      );

      window.addEventListener('mousemove', this._boundHandleSyntheticDrag, true);
      window.addEventListener('mouseup', this._boundHandleSyntheticDragEnd, true);
    }

    handleSyntheticDrag(event) {
      if (!this.isSynthesizingDrag || !this.dragInitialModel.targetBrowsingContextDuringDrag)
        return;

      const targetBrowser = this.dragInitialModel.targetBrowserDuringDrag;
      const targetBrowsingContext = this.dragInitialModel.targetBrowsingContextDuringDrag;

      if (gBrowser.selectedBrowser !== targetBrowser) {
        this.handleSyntheticDragEnd(event);
        return;
      }

      const parentActor = this._getParentActor();
      if (!parentActor) {
        this.handleSyntheticDragEnd(event);
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const currentTargetBrowserRect = targetBrowser.getBoundingClientRect();
      if (currentTargetBrowserRect.width === 0 || currentTargetBrowserRect.height === 0) {
        this.handleSyntheticDragEnd(event);
        return;
      }
      const eventData = this.createSyntheticEventData(event, currentTargetBrowserRect, 'mousemove');
      parentActor.sendEventToChild(
        targetBrowsingContext,
        'ZenEdgeScroll:SynthesizeMouseEvent',
        eventData
      );
    }

    handleSyntheticDragEnd(event) {
      if (this.isSynthesizingDrag && this.dragInitialModel.targetBrowsingContextDuringDrag) {
        const targetBrowser = this.dragInitialModel.targetBrowserDuringDrag;
        const targetBrowsingContext = this.dragInitialModel.targetBrowsingContextDuringDrag;
        const parentActor = this._getParentActor();

        if (parentActor && event) {
          // If called by an event
          event.preventDefault();
          event.stopPropagation();
          const currentTargetBrowserRect = targetBrowser.getBoundingClientRect();
          if (currentTargetBrowserRect.width > 0 && currentTargetBrowserRect.height > 0) {
            const eventData = this.createSyntheticEventData(
              event,
              currentTargetBrowserRect,
              'mouseup'
            );
            parentActor.sendEventToChild(
              targetBrowsingContext,
              'ZenEdgeScroll:SynthesizeMouseEvent',
              eventData
            );
          } else {
          }
        } else if (parentActor && !event) {
          // Called without event (e.g. drag cancelled)
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
        return;
      }

      const targetBrowser = gapInfo.targetBrowser;
      const targetBrowserRect = gapInfo.browserRect;
      const parentActor = this._getParentActor();

      event.preventDefault();
      event.stopPropagation();
      const wheelData = {
        deltaX: event.deltaX,
        deltaY: event.deltaY,
        deltaZ: event.deltaZ,
        deltaMode: event.deltaMode,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
        metaKey: event.metaKey,
        clientX: Math.max(
          0,
          Math.floor(targetBrowserRect.width - SYNTHETIC_EVENT_X_OFFSET_FROM_RIGHT_EDGE)
        ),
        clientY: Math.max(
          0,
          Math.min(
            Math.floor(event.clientY - targetBrowserRect.top),
            Math.floor(targetBrowserRect.height - 1)
          )
        ),
      };
      parentActor.sendEventToChild(targetBrowser.browsingContext, 'ZenEdgeScroll:DispatchWheel', {
        wheelData,
      });
    }
  }

  // Actor Registration (must happen before manager instantiation if manager relies on actors being ready)
  // This is modeled after ZenGlanceManager's registerWindowActors
  function registerEdgeScrollActors() {
    if (Services.prefs.getBoolPref('zen.edgescroll.enabled', true)) {
      window.gZenEdgeScrollManager = new ZenEdgeScrollManager();

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
          'about:*', // For about: pages
          'data:*', // For testing purposes
        ],
        includeChrome: true, // <--- ENSURE THIS LINE IS PRESENT AND SET TO TRUE
      };

      if (
        window.gZenActorsManager &&
        typeof window.gZenActorsManager.addJSWindowActor === 'function'
      ) {
        window.gZenActorsManager.addJSWindowActor(ACTOR_NAME, actorConfig);
      } else {
        console.error(`Failed to register ${ACTOR_NAME} actors:`, e);
      }
    }
  }

  registerEdgeScrollActors();
}
