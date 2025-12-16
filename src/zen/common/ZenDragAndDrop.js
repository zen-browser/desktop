/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

// Wrap in a block to prevent leaking to window scope.
{
  const isTab = (element) => gBrowser.isTab(element);
  const isTabGroupLabel = (element) => gBrowser.isTabGroupLabel(element);

  /**
   * The elements in the tab strip from `this.ariaFocusableItems` that contain
   * logical information are:
   *
   * - <tab> (.tabbrowser-tab)
   * - <tab-group> label element (.tab-group-label)
   *
   * The elements in the tab strip that contain the space inside of the <tabs>
   * element are:
   *
   * - <tab> (.tabbrowser-tab)
   * - <tab-group> label element wrapper (.tab-group-label-container)
   *
   * When working with tab strip items, if you need logical information, you
   * can get it directly, e.g. `element.elementIndex` or `element._tPos`. If
   * you need spatial information like position or dimensions, then you should
   * call this function. For example, `elementToMove(element).getBoundingClientRect()`
   * or `elementToMove(element).style.top`.
   *
   * @param {MozTabbrowserTab|typeof MozTabbrowserTabGroup.labelElement} element
   * @returns {MozTabbrowserTab|vbox}
   */
  const elementToMove = (element) => {
    if (element.classList.contains('zen-current-workspace-indicator')) {
      return element;
    }
    if (element.group?.hasAttribute('split-view-group')) {
      return element.group;
    }
    if (isTab(element)) {
      return element;
    }
    if (isTabGroupLabel(element)) {
      return element.closest('.tab-group-label-container');
    }
    throw new Error(`Element "${element.tagName}" is not expected to move`);
  };

  window.ZenDragAndDrop = class extends window.TabDragAndDrop {
    #dragOverBackground = null;
    #lastDropTarget = null;

    constructor(tabbrowserTabs) {
      super(tabbrowserTabs);
    }

    startTabDrag(event, tab, ...args) {
      super.startTabDrag(event, tab, ...args);
      let dt = event.dataTransfer;

      const { offsetX, offsetY } = this.#getDragImageOffset(tab);
    }

    _animateTabMove(event) {
      let draggedTab = event.dataTransfer.mozGetDataAt(TAB_DROP_TYPE, 0);
      let dragData = draggedTab._dragData;
      let movingTabs = dragData.movingTabs;
      let movingTabsSet = dragData.movingTabsSet;

      dragData.animLastScreenPos ??= this._tabbrowserTabs.verticalMode
        ? dragData.screenY
        : dragData.screenX;
      let allTabs = this._tabbrowserTabs.ariaFocusableItems;
      let numEssentials = gBrowser._numZenEssentials;
      let isEssential = draggedTab.hasAttribute('zen-essential');
      let tabs = allTabs.slice(
        isEssential ? 0 : numEssentials,
        isEssential ? numEssentials : undefined
      );

      let screen = this._tabbrowserTabs.verticalMode ? event.screenY : event.screenX;
      if (screen == dragData.animLastScreenPos) {
        return;
      }
      let screenForward = screen > dragData.animLastScreenPos;
      dragData.animLastScreenPos = screen;

      this._clearDragOverGroupingTimer();

      if (this._rtlMode) {
        tabs.reverse();
      }

      let bounds = (ele) => window.windowUtils.getBoundsWithoutFlushing(ele);
      let logicalForward = screenForward != this._rtlMode;
      let screenAxis = this._tabbrowserTabs.verticalMode ? 'screenY' : 'screenX';
      let size = this._tabbrowserTabs.verticalMode ? 'height' : 'width';
      let { width: tabWidth, height: tabHeight } = bounds(draggedTab);
      let tabSize = this._tabbrowserTabs.verticalMode ? tabHeight : tabWidth;
      let translateX = event.screenX - dragData.screenX;
      let translateY = event.screenY - dragData.screenY;

      dragData.tabWidth = tabWidth;
      dragData.tabHeight = tabHeight;
      dragData.translateX = translateX;
      dragData.translateY = translateY;

      // Move the dragged tab based on the mouse position.
      let periphery = document.getElementById('tabbrowser-arrowscrollbox-periphery');
      let lastMovingTab = movingTabs.at(-1);
      let firstMovingTab = movingTabs[0];
      let endEdge = (ele) => ele[screenAxis] + bounds(ele)[size];
      let lastMovingTabScreen = endEdge(lastMovingTab);
      let firstMovingTabScreen = firstMovingTab[screenAxis];
      let shiftSize = lastMovingTabScreen - firstMovingTabScreen;
      let translate = screen - dragData[screenAxis];

      // Constrain the range over which the moving tabs can move between the edge of the tabstrip and periphery.
      // Add 1 to periphery so we don't overlap it.
      let startBound = this._rtlMode
        ? endEdge(periphery) + 1 - firstMovingTabScreen
        : this._tabbrowserTabs[screenAxis] - firstMovingTabScreen;
      let endBound = this._rtlMode
        ? endEdge(this._tabbrowserTabs) - lastMovingTabScreen
        : periphery[screenAxis] - 1 - lastMovingTabScreen;
      let firstTab = tabs.at(this._rtlMode ? -1 : 0);
      let lastTab = tabs.at(this._rtlMode ? 0 : -1);
      startBound = firstTab[screenAxis] - firstMovingTabScreen;
      endBound = endEdge(lastTab) - lastMovingTabScreen;
      translate = Math.min(Math.max(translate, startBound), endBound);

      // Center the tab under the cursor if the tab is not under the cursor while dragging
      let draggedTabScreenAxis = draggedTab[screenAxis] + translate;
      if (
        (screen < draggedTabScreenAxis || screen > draggedTabScreenAxis + tabSize) &&
        draggedTabScreenAxis + tabSize < endBound &&
        draggedTabScreenAxis > startBound
      ) {
        translate = screen - draggedTab[screenAxis] - tabSize / 2;
        // Ensure, after the above calculation, we are still within bounds
        translate = Math.min(Math.max(translate, startBound), endBound);
      }

      if (!gBrowser.pinnedTabCount && !this._dragToPinPromoCard.shouldRender) {
        let pinnedDropIndicatorMargin = parseFloat(
          window.getComputedStyle(this._pinnedDropIndicator).marginInline
        );
        this._checkWithinPinnedContainerBounds({
          firstMovingTabScreen,
          lastMovingTabScreen,
          pinnedTabsStartEdge: this._rtlMode
            ? endEdge(this._tabbrowserTabs.arrowScrollbox) + pinnedDropIndicatorMargin
            : this[screenAxis],
          pinnedTabsEndEdge: this._rtlMode
            ? endEdge(this._tabbrowserTabs)
            : this._tabbrowserTabs.arrowScrollbox[screenAxis] - pinnedDropIndicatorMargin,
          translate,
          draggedTab,
        });
      }

      dragData.translatePos = translate;

      tabs = tabs.filter((t) => !movingTabsSet.has(t) || t == draggedTab);

      /**
       * When the `draggedTab` is just starting to move, the `draggedTab` is in
       * its original location and the `dropElementIndex == draggedTab.elementIndex`.
       * Any tabs or tab group labels passed in as `item` will result in a 0 shift
       * because all of those items should also continue to appear in their original
       * locations.
       *
       * Once the `draggedTab` is more "backward" in the tab strip than its original
       * position, any tabs or tab group labels between the `draggedTab`'s original
       * `elementIndex` and the current `dropElementIndex` should shift "forward"
       * out of the way of the dragging tabs.
       *
       * When the `draggedTab` is more "forward" in the tab strip than its original
       * position, any tabs or tab group labels between the `draggedTab`'s original
       * `elementIndex` and the current `dropElementIndex` should shift "backward"
       * out of the way of the dragging tabs.
       *
       * @param {MozTabbrowserTab|MozTabbrowserTabGroup.label} item
       * @param {number} dropElementIndex
       * @returns {number}
       */
      let getTabShift = (item, dropElementIndex) => {
        if (item.elementIndex < draggedTab.elementIndex && item.elementIndex >= dropElementIndex) {
          return this._rtlMode ? -shiftSize : shiftSize;
        }
        if (item.elementIndex > draggedTab.elementIndex && item.elementIndex < dropElementIndex) {
          return this._rtlMode ? shiftSize : -shiftSize;
        }
        return 0;
      };

      let oldDropElementIndex = dragData.animDropElementIndex ?? movingTabs[0].elementIndex;

      /**
       * Returns the higher % by which one element overlaps another
       * in the tab strip.
       *
       * When element 1 is further forward in the tab strip:
       *
       *   p1            p2      p1+s1    p2+s2
       *    |             |        |        |
       *    ---------------------------------
       *    ========================
       *               s1
       *                  ===================
       *                           s2
       *                  ==========
       *                   overlap
       *
       * When element 2 is further forward in the tab strip:
       *
       *   p2            p1      p2+s2    p1+s1
       *    |             |        |        |
       *    ---------------------------------
       *    ========================
       *               s2
       *                  ===================
       *                           s1
       *                  ==========
       *                   overlap
       *
       * @param {number} p1
       *   Position (x or y value in screen coordinates) of element 1.
       * @param {number} s1
       *   Size (width or height) of element 1.
       * @param {number} p2
       *   Position (x or y value in screen coordinates) of element 2.
       * @param {number} s2
       *   Size (width or height) of element 1.
       * @returns {number}
       *   Percent between 0.0 and 1.0 (inclusive) of element 1 or element 2
       *   that is overlapped by the other element. If the elements have
       *   different sizes, then this returns the larger overlap percentage.
       */
      function greatestOverlap(p1, s1, p2, s2) {
        let overlapSize;
        if (p1 < p2) {
          // element 1 starts first
          overlapSize = p1 + s1 - p2;
        } else {
          // element 2 starts first
          overlapSize = p2 + s2 - p1;
        }

        // No overlap if size is <= 0
        if (overlapSize <= 0) {
          return 0;
        }

        // Calculate the overlap fraction from each element's perspective.
        let overlapPercent = Math.max(overlapSize / s1, overlapSize / s2);

        return Math.min(overlapPercent, 1);
      }

      /**
       * Determine what tab/tab group label we're dragging over.
       *
       * When dragging right or downwards, the reference point for overlap is
       * the right or bottom edge of the most forward moving tab.
       *
       * When dragging left or upwards, the reference point for overlap is the
       * left or top edge of the most backward moving tab.
       *
       * @returns {Element|null}
       *   The tab or tab group label that should be used to visually shift tab
       *   strip elements out of the way of the dragged tab(s) during a drag
       *   operation. Note: this is not used to determine where the dragged
       *   tab(s) will be dropped, it is only used for visual animation at this
       *   time.
       */
      let getOverlappedElement = () => {
        let point = (screenForward ? lastMovingTabScreen : firstMovingTabScreen) + translate;
        let low = 0;
        let high = tabs.length - 1;
        while (low <= high) {
          let mid = Math.floor((low + high) / 2);
          if (tabs[mid] == draggedTab && ++mid > high) {
            break;
          }
          let element = tabs[mid];
          let elementForSize = elementToMove(element);
          screen = elementForSize[screenAxis] + getTabShift(element, oldDropElementIndex);

          if (screen > point) {
            high = mid - 1;
          } else if (screen + bounds(elementForSize)[size] < point) {
            low = mid + 1;
          } else {
            return element;
          }
        }
        return null;
      };

      let dropElement = getOverlappedElement();

      let newDropElementIndex;
      if (dropElement) {
        newDropElementIndex = dropElement.elementIndex;
      } else {
        // When the dragged element(s) moves past a tab strip item, the dragged
        // element's leading edge starts dragging over empty space, resulting in
        // no overlapping `dropElement`. In these cases, try to fall back to the
        // previous animation drop element index to avoid unstable animations
        // (tab strip items snapping back and forth to shift out of the way of
        // the dragged element(s)).
        newDropElementIndex = oldDropElementIndex;

        // We always want to have a `dropElement` so that we can determine where to
        // logically drop the dragged element(s).
        //
        // It's tempting to set `dropElement` to
        // `this.ariaFocusableItems.at(oldDropElementIndex)`, and that is correct
        // for most cases, but there are edge cases:
        //
        // 1) the drop element index range needs to be one larger than the number of
        //    items that can move in the tab strip. The simplest example is when all
        //    tabs are ungrouped and unpinned: for 5 tabs, the drop element index needs
        //    to be able to go from 0 (become the first tab) to 5 (become the last tab).
        //    `this.ariaFocusableItems.at(5)` would be `undefined` when dragging to the
        //    end of the tab strip. In this specific case, it works to fall back to
        //    setting the drop element to the last tab.
        //
        // 2) the `elementIndex` values of the tab strip items do not change during
        //    the drag operation. When dragging the last tab or multiple tabs at the end
        //    of the tab strip, having `dropElement` fall back to the last tab makes the
        //    drop element one of the moving tabs. This can have some unexpected behavior
        //    if not careful. Falling back to the last tab that's not moving (instead of
        //    just the last tab) helps ensure that `dropElement` is always a stable target
        //    to drop next to.
        //
        // 3) all of the elements in the tab strip are moving, in which case there can't
        //    be a drop element and it should stay `undefined`.
        //
        // 4) we just started dragging and the `oldDropElementIndex` has its default
        //    valuë of `movingTabs[0].elementIndex`. In this case, the drop element
        //    shouldn't be a moving tab, so keep it `undefined`.
        let lastPossibleDropElement = this._rtlMode
          ? tabs.find((t) => t != draggedTab)
          : tabs.findLast((t) => t != draggedTab);
        let maxElementIndexForDropElement = lastPossibleDropElement?.elementIndex;
        if (Number.isInteger(maxElementIndexForDropElement)) {
          let index = Math.min(oldDropElementIndex, maxElementIndexForDropElement);
          let oldDropElementCandidate = this._tabbrowserTabs.ariaFocusableItems.at(index);
          if (!movingTabsSet.has(oldDropElementCandidate)) {
            dropElement = oldDropElementCandidate;
          }
        }
      }

      let moveOverThreshold;
      let overlapPercent;
      let dropBefore;
      if (dropElement) {
        let dropElementForOverlap = elementToMove(dropElement);

        let dropElementScreen = dropElementForOverlap[screenAxis];
        let dropElementPos = dropElementScreen + getTabShift(dropElement, oldDropElementIndex);
        let dropElementSize = bounds(dropElementForOverlap)[size];
        let firstMovingTabPos = firstMovingTabScreen + translate;
        overlapPercent = greatestOverlap(
          firstMovingTabPos,
          shiftSize,
          dropElementPos,
          dropElementSize
        );

        moveOverThreshold = gBrowser._tabGroupsEnabled
          ? Services.prefs.getIntPref('browser.tabs.dragDrop.moveOverThresholdPercent') / 100
          : 0.5;
        moveOverThreshold = Math.min(1, Math.max(0, moveOverThreshold));
        let shouldMoveOver = overlapPercent > moveOverThreshold;
        if (logicalForward && shouldMoveOver) {
          newDropElementIndex++;
        } else if (!logicalForward && !shouldMoveOver) {
          newDropElementIndex++;
          if (newDropElementIndex > oldDropElementIndex) {
            // FIXME: Not quite sure what's going on here, but this check
            // prevents jittery back-and-forth movement of background tabs
            // in certain cases.
            newDropElementIndex = oldDropElementIndex;
          }
        }

        // Recalculate the overlap with the updated drop index for when the
        // drop element moves over.
        dropElementPos = dropElementScreen + getTabShift(dropElement, newDropElementIndex);
        overlapPercent = greatestOverlap(
          firstMovingTabPos,
          shiftSize,
          dropElementPos,
          dropElementSize
        );
        dropBefore = firstMovingTabPos < dropElementPos;
        if (this._rtlMode) {
          dropBefore = !dropBefore;
        }
      }

      this._tabbrowserTabs.removeAttribute('movingtab-group');
      this._resetGroupTarget(document.querySelector('[dragover-groupTarget]'));

      delete dragData.shouldDropIntoCollapsedTabGroup;

      // Default to dropping into `dropElement`'s tab group, if it exists.
      let dropElementGroup = dropElement?.group;
      let colorCode = dropElementGroup?.color;

      let lastUnmovingTabInGroup = dropElementGroup?.tabs.findLast((t) => !movingTabsSet.has(t));
      if (
        isTab(dropElement) &&
        dropElementGroup &&
        dropElement == lastUnmovingTabInGroup &&
        !dropBefore
      ) {
        // Dragging tab over the last tab of a tab group, but not enough
        // for it to drop into the tab group. Drop it after the tab group instead.
        dropElement = dropElementGroup;
        colorCode = undefined;
      } else if (isTabGroupLabel(dropElement)) {
        // Dropping right before the first tab in the tab group.
        dropElement = dropElementGroup.tabs[0];
        dropBefore = true;
      }
      this._setDragOverGroupColor(colorCode);
      this._tabbrowserTabs.toggleAttribute('movingtab-addToGroup', colorCode);
      this._tabbrowserTabs.toggleAttribute('movingtab-ungroup', !colorCode);

      this.#applyDragoverIndicator(event, tabs, movingTabs, overlapPercent);

      if (
        newDropElementIndex == oldDropElementIndex &&
        dropBefore == dragData.dropBefore &&
        dropElement == dragData.dropElement
      ) {
        return;
      }

      dragData.dropElement = dropElement;
      dragData.dropBefore = dropBefore;
      dragData.animDropElementIndex = newDropElementIndex;
    }

    handle_dragend(event) {
      super.handle_dragend(event);
      this.#removeDragOverBackground();
      gZenPinnedTabManager.removeTabContainersDragoverClass();
    }

    #applyDragOverBackground(element) {
      if (this.#dragOverBackground && this.#lastDropTarget === element) {
        return false;
      }
      const margin = 2;
      const rect = window.windowUtils.getBoundsWithoutFlushing(element);
      this.#dragOverBackground = document.createElement('div');
      this.#dragOverBackground.id = 'zen-dragover-background';
      this.#dragOverBackground.style.height = `${rect.height - margin * 2}px`;
      this.#dragOverBackground.style.top = `${rect.top + margin}px`;
      gNavToolbox.appendChild(this.#dragOverBackground);
      this.#lastDropTarget = element;
      return true;
    }

    #removeDragOverBackground() {
      if (this.#dragOverBackground) {
        this.#dragOverBackground.remove();
        this.#dragOverBackground = null;
        this.#lastDropTarget = null;
      }
    }

    #applyDragoverIndicator(event, tabs, movingTabs, overlapPercent) {
      const separation = 4;
      const dropZoneSelector = ':is(.tabbrowser-tab, .zen-drop-target, .tab-group-label)';
      let shouldPlayHapticFeedback = false;
      let dropElement = event.target.closest(dropZoneSelector);
      if (!dropElement) {
        const numEssentials = gBrowser._numZenEssentials;
        const numPinned = gBrowser.pinnedTabCount - numEssentials;
        const tabToUse = event.target.closest(dropZoneSelector);
        if (!tabToUse) {
          this.#removeDragOverBackground();
          gZenPinnedTabManager.removeTabContainersDragoverClass();
          return;
        }
        const isPinned = tabToUse.pinned;
        const relativeTabs = tabs.slice(isPinned ? 0 : numPinned, isPinned ? numPinned : undefined);
        const draggedTabRect = elementToMove(tabToUse).getBoundingClientRect();
        dropElement = event.clientY > draggedTabRect.top ? relativeTabs.at(-1) : relativeTabs[0];
      }
      dropElement = elementToMove(dropElement);
      if (this.#lastDropTarget !== dropElement) {
        shouldPlayHapticFeedback = this.#lastDropTarget !== null;
        this.#removeDragOverBackground();
      }
      let canHightlightGroup =
        gZenFolders.highlightGroupOnDragOver(dropElement.parentElement, movingTabs) ||
        !dropElement.parentElement?.isZenFolder;
      if (isTab(dropElement)) {
        const indicator = gZenPinnedTabManager.dragIndicator;
        let rect = dropElement.getBoundingClientRect();
        let top = 0;
        const threshold =
          Services.prefs.getIntPref('browser.tabs.dragDrop.moveOverThresholdPercent') / 100;
        if (overlapPercent > threshold) {
          top = Math.round(rect.top + rect.height) + 'px';
        } else {
          top = Math.round(rect.top) + 'px';
        }
        if (indicator.style.top !== top) {
          shouldPlayHapticFeedback = true;
        }
        indicator.setAttribute('orientation', 'horizontal');
        indicator.style.setProperty('--indicator-left', rect.left + separation / 2 + 'px');
        indicator.style.setProperty('--indicator-width', rect.width - separation + 'px');
        indicator.style.top = top;
        indicator.style.removeProperty('left');
      } else if (dropElement.classList.contains('zen-drop-target') && canHightlightGroup) {
        // removeTabContainersDragoverClass Already calls a new haptic feedback
        shouldPlayHapticFeedback =
          this.#applyDragOverBackground(dropElement) && !gZenPinnedTabManager._dragIndicator;
        gZenPinnedTabManager.removeTabContainersDragoverClass();
      }

      if (shouldPlayHapticFeedback) {
        Services.zen.playHapticFeedback();
      }
    }

    #getDragImageOffset(tab) {
      const { offsetX, offsetY } = tab._dragData;
      const rect = tab.getBoundingClientRect();
      return {
        offsetX: offsetX - rect.left,
        offsetY: offsetY - rect.top,
      };
    }
  };
}
