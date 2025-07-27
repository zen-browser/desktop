{
  const EDGE_INTERACTION_WIDTH_PX = Services.prefs.getIntPref(
    'zen.theme.content-element-separation',
    8
  );
  const SYNTHETIC_EVENT_X_OFFSET_FROM_RIGHT_EDGE = 2;
  const SYNTHETIC_EVENT_Y_OFFSET_FROM_BOTTOM_EDGE = 2;
  const ACTOR_NAME = 'ZenEdgeScroll'; // Name used for actor registration

  class ZenEdgeScrollManager extends ZenDOMOperatedFeature {
    init() {
      this.isSynthesizingDrag = false;
      this.dragInitialModel = {
        targetBrowserDuringDrag: null,
        targetBrowsingContextDuringDrag: null,
      };

      this.triggerDivVertical = null;
      this.triggerDivHorizontal = null;

      this._boundHandleMouseDown = this.handleMouseDown.bind(this);
      this._boundHandleSyntheticDrag = this.handleSyntheticDrag.bind(this);
      this._boundHandleSyntheticDragEnd = this.handleSyntheticDragEnd.bind(this);
      this._boundHandleWheel = this.handleWheel.bind(this);
      this._boundUpdateTriggerDivDisplay = this._updateTriggerDivDisplay.bind(this);

      if (this.triggerDivVertical !== null && this.triggerDivVertical !== null) {
        console.warn('ZenEdgeScrollManager is already initialized.');
        return;
      }

      // Create and append the edge scroll trigger div
      this.triggerDivVertical = window.document.createElement('div');
      this.triggerDivVertical.id = 'zen-edgescroll-trigger-vertical';
      document.getElementById('zen-appcontent-wrapper').appendChild(this.triggerDivVertical);
      this.triggerDivVertical.addEventListener('mousedown', this._boundHandleMouseDown, true);
      this.triggerDivVertical.addEventListener('wheel', this._boundHandleWheel, {
        capture: true,
        passive: false,
      });

      this.triggerDivHorizontal = window.document.createElement('div');
      this.triggerDivHorizontal.id = 'zen-edgescroll-trigger-horizontal';
      document.getElementById('zen-appcontent-wrapper').appendChild(this.triggerDivHorizontal);
      this.triggerDivHorizontal.addEventListener('mousedown', this._boundHandleMouseDown, true);
      this.triggerDivHorizontal.addEventListener('wheel', this._boundHandleWheel, {
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
      if (this.triggerDivVertical) {
        this.triggerDivVertical.removeEventListener('mousedown', this._boundHandleMouseDown, true);
        this.triggerDivVertical.removeEventListener('wheel', this._boundHandleWheel, true);
        if (this.triggerDivVertical.parentNode) {
          this.triggerDivVertical.parentNode.removeChild(this.triggerDivVertical); // Corrected removeChild call
        }
        this.triggerDivVertical = null;
      }
      if (this.triggerDivHorizontal) {
        this.triggerDivHorizontal.removeEventListener(
          'mousedown',
          this._boundHandleMouseDown,
          true
        );
        this.triggerDivHorizontal.removeEventListener('wheel', this._boundHandleWheel, true);
        if (this.triggerDivHorizontal.parentNode) {
          this.triggerDivHorizontal.parentNode.removeChild(this.triggerDivHorizontal); // Corrected removeChild call
        }
        this.triggerDivHorizontal = null;
      }
      // These listeners are added to window, not triggerDiv in handleMouseDown
      window.removeEventListener('mousemove', this._boundHandleSyntheticDrag, true);
      window.removeEventListener('mouseup', this._boundHandleSyntheticDragEnd, true);
      Services.prefs.removeObserver(
        'zen.tabs.vertical.right-side',
        this._boundUpdateTriggerDivDisplay
      ); // Added: Remove observer
    }

    _updateTriggerDivDisplay() {
      // Added method
      if (!this.triggerDivVertical) {
        return;
      }
      if (window.gZenCompactModeManager && gZenCompactModeManager.sidebarIsOnRight) {
        this.triggerDivVertical.style.display = 'none';
      } else {
        this.triggerDivVertical.style.display = 'block';
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

      if (event.target == this.triggerDivVertical) {
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
      } else if (event.target == this.triggerDivHorizontal) {
        // For horizontal trigger, we can check if the event is close to the bottom edge
        const selectedBrowserRect = selectedBrowser.getBoundingClientRect();
        if (selectedBrowserRect.width > 0 && selectedBrowserRect.height > 0) {
          const isBrowserAtBottomEdge =
            window.innerHeight - selectedBrowserRect.bottom <= EDGE_INTERACTION_WIDTH_PX + 1;
          const isEventXWithinBrowser =
            event.clientX >= selectedBrowserRect.left && event.clientX <= selectedBrowserRect.right;
          if (isBrowserAtBottomEdge && isEventXWithinBrowser) {
            potentialTargetBrowser = selectedBrowser;
            potentialTargetBrowserRect = selectedBrowserRect;
          }
        }
      }
      return {
        isInGap: true,
        targetBrowser: potentialTargetBrowser,
        browserRect: potentialTargetBrowserRect,
      };
    }

    createSyntheticEventData(originalEvent, targetBrowserRect, eventType) {
      const clientXInContent = Math.max(
        0,
        Math.min(
          Math.floor(originalEvent.clientX - targetBrowserRect.left),
          Math.floor(targetBrowserRect.width - SYNTHETIC_EVENT_X_OFFSET_FROM_RIGHT_EDGE)
        )
      );
      const clientYInContent = Math.max(
        0,
        Math.min(
          Math.floor(originalEvent.clientY - targetBrowserRect.top),
          Math.floor(targetBrowserRect.height - SYNTHETIC_EVENT_Y_OFFSET_FROM_BOTTOM_EDGE)
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
      const gapInfo = this.getGapZoneInfo(event);

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
      const gapInfo = this.getGapZoneInfo(event);

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

  // Observe changes to the enabled pref and register/destroy the manager
  const edgeScrollPrefObserver = {
    observe(subject, topic, data) {
      if (topic === 'nsPref:changed' && data === 'zen.edgescroll.enabled') {
        if (window.gZenEdgeScrollManager) {
          window.gZenEdgeScrollManager.destroy();
          window.gZenEdgeScrollManager = null;
        }
        if (Services.prefs.getBoolPref('zen.edgescroll.enabled', true)) {
          registerEdgeScrollActors();
          if (window.gZenEdgeScrollManager) window.gZenEdgeScrollManager.init();
        }
      }
    },
  };

  Services.prefs.addObserver('zen.edgescroll.enabled', edgeScrollPrefObserver, false);
}
