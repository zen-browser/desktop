/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* eslint-disable consistent-return */

"use strict";

// Wrap in a block to prevent leaking to window scope.
{
  const isTab = (element) => gBrowser.isTab(element);
  const isTabGroupLabel = (element) => gBrowser.isTabGroupLabel(element);
  const isEssentialsPromo = (element) => element?.tagName.toUpperCase() == "ZEN-ESSENTIALS-PROMO";

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
    if (
      !element ||
      element.closest(".zen-current-workspace-indicator") ||
      element.hasAttribute("split-view-group") ||
      element.classList.contains("zen-drop-target") ||
      isEssentialsPromo(element)
    ) {
      return element;
    }
    if (element.group?.hasAttribute("split-view-group")) {
      return element.group;
    }
    if (isTab(element)) {
      return element;
    }
    if (isTabGroupLabel(element)) {
      return element.closest(".tab-group-label-container");
    }
    if (gBrowser.isTabGroup(element)) {
      return element.labelContainerElement;
    }
    throw new Error(`Element "${element.tagName}" is not expected to move`);
  };

  window.ZenDragAndDrop = class extends window.TabDragAndDrop {
    #dragOverBackground = null;
    #lastDropTarget = null;
    originalDragImageArgs = [];
    #isOutOfWindow = false;
    #maxTabsPerRow = 0;
    #changeSpaceTimer = null;
    #isAnimatingTabMove = false;

    #dragOverSplit = {};

    constructor(tabbrowserTabs) {
      super(tabbrowserTabs);

      XPCOMUtils.defineLazyServiceGetter(
        this,
        "ZenDragAndDropService",
        "@mozilla.org/zen/drag-and-drop;1",
        Ci.nsIZenDragAndDrop
      );

      XPCOMUtils.defineLazyPreferenceGetter(
        this,
        "_dndSplitEnabled",
        "zen.splitView.enable-drag-over-split",
        true
      );
      XPCOMUtils.defineLazyPreferenceGetter(
        this,
        "_dndSplitThreshold",
        "zen.splitView.drag-over-split-threshold",
        25
      );
      XPCOMUtils.defineLazyPreferenceGetter(
        this,
        "_dndSplitDelay",
        "zen.splitView.drag-over-split-delayMC",
        300
      );
      XPCOMUtils.defineLazyPreferenceGetter(
        this,
        "_dndSwitchSpaceDelay",
        "zen.tabs.dnd-switch-space-delay",
        1000
      );

      ChromeUtils.defineESModuleGetters(
        this,
        {
          createZenEssentialsPromo:
            "chrome://browser/content/zen-components/ZenEssentialsPromo.mjs",
        },
        { global: "current" }
      );
    }

    init() {
      super.init();
      this.handle_windowDragEnter = this.handle_windowDragEnter.bind(this);
      window.addEventListener("dragleave", this.handle_windowDragLeave.bind(this), {
        capture: true,
      });
    }

    startTabDrag(event, tab, ...args) {
      this.ZenDragAndDropService.onDragStart(1);
      this.#isOutOfWindow = false;
      gZenCompactModeManager._isTabBeingDragged = true;
      super.startTabDrag(event, tab, ...args);
      const dt = event.dataTransfer;
      if (isTabGroupLabel(tab)) {
        tab = tab.group;
      }
      const draggingTabs = tab.multiselected ? gBrowser.selectedTabs : [tab];
      const { offsetX, offsetY } = this.#getDragImageOffset(event, tab, draggingTabs);
      const dragImage = this.#createDragImageForTabs(draggingTabs);
      this.originalDragImageArgs = [dragImage, offsetX, offsetY];
      dt.setDragImage(...this.originalDragImageArgs);
      if (tab.hasAttribute("zen-essential")) {
        tab.style.visibility = "hidden";
      }
    }

    #createDragImageForTabs(movingTabs) {
      const periphery = gZenWorkspaces.activeWorkspaceElement.querySelector(
        "#tabbrowser-arrowscrollbox-periphery"
      );
      const tabRect = window.windowUtils.getBoundsWithoutFlushing(movingTabs[0]);
      const wrapper = document.createElement("div");
      let movingTabsCount = Math.min(movingTabs.length, 3);
      wrapper.style.width = tabRect.width + "px";
      wrapper.style.height = tabRect.height * movingTabsCount + "px";
      wrapper.style.position = "fixed";
      wrapper.style.top = "-9999px";
      periphery.appendChild(wrapper);
      for (let i = 0; i < movingTabsCount; i++) {
        const tab = movingTabs[i];
        const tabClone = tab.cloneNode(true);
        if (tab.hasAttribute("zen-essential")) {
          const rect = tab.getBoundingClientRect();
          tabClone.style.minWidth = tabClone.style.maxWidth = `${rect.width}px`;
          tabClone.style.minHeight = tabClone.style.maxHeight = `${rect.height}px`;
          if (tabClone.hasAttribute("visuallyselected")) {
            tabClone.style.transform = "translate(-50%, -50%)";
          }
        } else if (AppConstants.platform !== "macosx" && !tab.isZenFolder) {
          // On windows and linux, we still don't add some extra opaqueness
          // for the tab to be more visible. This is a hacky workaround.
          // TODO: Make windows and linux DnD use nsZenDragAndDrop::mDragImageOpacity
          tabClone.style.colorScheme = "light";
          tabClone.style.color = "black";
        }
        if (i > 0) {
          tabClone.style.transform = `translate(${i * 4}px, -${i * (tabRect.height - 4)}px)`;
          tabClone.style.opacity = "0.2";
          tabClone.style.zIndex = `${-i}`;
        }
        tabClone.setAttribute("drag-image", "true");
        wrapper.appendChild(tabClone);
        if (isTab(tabClone)) {
          // We need to limit the label content so the drag image doesn't grow too big.
          const label = tabClone.textLabel;
          const tabLabelParentWidth = label.parentElement.getBoundingClientRect().width;
          label.textContent = label.textContent.slice(0, Math.floor(tabLabelParentWidth / 6));
        } else if (gBrowser.isTabGroup(tabClone) && tabClone.hasAttribute("split-view-group")) {
          let tabs = tab.tabs;
          for (let j = 0; j < tabs.length; j++) {
            const tabInGroup = tabs[j];
            const tabInGroupClone = tabInGroup.cloneNode(true);
            tabClone.appendChild(tabInGroupClone);
          }
        }
      }
      this.#maybeCreateDragImageDot(movingTabs, wrapper);
      this._tempDragImageParent = wrapper;
      return wrapper;
    }

    #maybeCreateDragImageDot(movingTabs, wrapper) {
      if (movingTabs.length > 1) {
        const dot = document.createElement("div");
        dot.textContent = movingTabs.length;
        dot.style.position = "absolute";
        dot.style.top = "-10px";
        dot.style.left = "-16px";
        dot.style.background = "red";
        dot.style.borderRadius = "50%";
        dot.style.fontWeight = "bold";
        dot.style.fontSize = "10px";
        dot.style.lineHeight = "16px";
        dot.style.justifyContent = dot.style.alignItems = "center";
        dot.style.height = dot.style.minWidth = "16px";
        dot.style.textAlign = "center";
        dot.style.color = "white";
        wrapper.appendChild(dot);
      }
    }

    // eslint-disable-next-line complexity
    _animateTabMove(event) {
      let draggedTab = event.dataTransfer.mozGetDataAt(TAB_DROP_TYPE, 0);
      if (event.target.closest("#zen-essentials") && !isEssentialsPromo(event.target)) {
        if (!isTab(draggedTab)) {
          this.clearDragOverVisuals();
          return;
        }
        return this.#animateVerticalPinnedGridDragOver(event);
      } else if (this._fakeEssentialTab) {
        this.#makeDragImageNonEssential(event);
      }
      let dragData = draggedTab._dragData;
      let movingTabs = dragData.movingTabs;
      let movingTabsSet = dragData.movingTabsSet;

      dragData.animLastScreenPos ??= this._tabbrowserTabs.verticalMode
        ? dragData.screenY
        : dragData.screenX;
      let allTabs = this._tabbrowserTabs.ariaFocusableItems;
      let tabs = allTabs;
      if (!tabs.length) {
        tabs = [...movingTabs];
      }

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
      let screenAxis = this._tabbrowserTabs.verticalMode ? "screenY" : "screenX";
      let size = this._tabbrowserTabs.verticalMode ? "height" : "width";
      let { width: tabWidth, height: tabHeight } = bounds(draggedTab);
      let tabSize = this._tabbrowserTabs.verticalMode ? tabHeight : tabWidth;
      let translateX = event.screenX - dragData.screenX;
      let translateY = event.screenY - dragData.screenY;

      dragData.tabWidth = tabWidth;
      dragData.tabHeight = tabHeight;
      dragData.translateX = translateX;
      dragData.translateY = translateY;

      // Move the dragged tab based on the mouse position.
      let periphery = gZenWorkspaces.activeWorkspaceElement.querySelector(
        "#tabbrowser-arrowscrollbox-periphery"
      );
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
        let lastPossibleDropElement = this._rtlMode ? tabs.find((t) => t != draggedTab) : undefined;
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
          ? Services.prefs.getIntPref("browser.tabs.dragDrop.moveOverThresholdPercent") / 100
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

      this._tabbrowserTabs.removeAttribute("movingtab-group");
      this._resetGroupTarget(document.querySelector("[dragover-groupTarget]"));

      delete dragData.shouldDropIntoCollapsedTabGroup;

      [dropBefore, dropElement] = this.#applyDragoverIndicator(
        event,
        dropElement,
        movingTabs,
        draggedTab
      ) ?? [dropBefore, dropElement];

      // Default to dropping into `dropElement`'s tab group, if it exists.
      let dropElementGroup = dropElement?.group;
      let colorCode = dropElementGroup?.color;

      if (isTabGroupLabel(dropElement)) {
        // Dropping right before the first tab in the tab group.
        dropElement = dropElementGroup.tabs[0];
        dropBefore = true;
      }
      this._setDragOverGroupColor(colorCode);
      this._tabbrowserTabs.toggleAttribute("movingtab-addToGroup", colorCode);
      this._tabbrowserTabs.toggleAttribute("movingtab-ungroup", !colorCode);

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

    #isMovingTab() {
      return this._tabbrowserTabs.hasAttribute("movingtab");
    }

    get #dragShiftableItems() {
      const separator = gZenWorkspaces.pinnedTabsContainer.querySelector(
        ".pinned-tabs-container-separator"
      );
      // Make sure to always return the separator at the start of the array
      return Services.prefs.getBoolPref("zen.view.show-newtab-button-top")
        ? [separator, gZenWorkspaces.activeWorkspaceElement.newTabButton]
        : [separator];
    }

    handle_dragover(event) {
      super.handle_dragover(event);
      if (!gZenVerticalTabsManager._prefsSidebarExpanded) {
        return;
      }
      this.#handle_sidebarDragOver(event);
      this.#handle_tabDragOverToSplit(event);
    }

    #shouldSwitchSpace(event) {
      const padding = Services.prefs.getIntPref("zen.workspaces.dnd-switch-padding");
      // If we are hovering over the edges of the gNavToolbox or the splitter, we
      // can change the workspace after a short delay.
      const splitter = document.getElementById("zen-sidebar-splitter");
      let rect = window.windowUtils.getBoundsWithoutFlushing(gNavToolbox);
      if (!(gZenCompactModeManager.preference && gZenCompactModeManager.canHideSidebar)) {
        rect.width += window.windowUtils.getBoundsWithoutFlushing(splitter).width;
      }
      const { clientX } = event;
      const isNearLeftEdge = clientX >= rect.left - padding && clientX <= rect.left + padding;
      const isNearRightEdge = clientX >= rect.right - padding && clientX <= rect.right + padding;
      return { isNearLeftEdge, isNearRightEdge };
    }

    clearSpaceSwitchTimer() {
      if (this.#changeSpaceTimer) {
        clearTimeout(this.#changeSpaceTimer);
        this.#changeSpaceTimer = null;
      }
    }

    #handle_sidebarDragOver(event) {
      const dt = event.dataTransfer;
      const draggedTab = dt.mozGetDataAt(TAB_DROP_TYPE, 0);
      if (draggedTab.hasAttribute("zen-essential")) {
        this.clearSpaceSwitchTimer();
        return;
      }
      const { isNearLeftEdge, isNearRightEdge } = this.#shouldSwitchSpace(event);
      if (isNearLeftEdge || isNearRightEdge) {
        if (!this.#changeSpaceTimer) {
          this.#changeSpaceTimer = setTimeout(() => {
            this.clearDragOverVisuals();
            gZenWorkspaces
              .changeWorkspaceShortcut(isNearLeftEdge ? -1 : 1, false, /* Disable wrapping */ true)
              .then((spaceChanged) => {
                if (AppConstants.platform !== "macosx") {
                  // See the hack in #createDragImageForTabs for more details which
                  // explains why we need to do this on non-macOS platforms.
                  return;
                }
                let tabs = this.originalDragImageArgs[0].children;
                const { isDarkMode, isExplicitMode } =
                  gZenThemePicker.getGradientForWorkspace(spaceChanged);
                for (let tab of tabs) {
                  if (isExplicitMode) {
                    tab.style.colorScheme = isDarkMode ? "dark" : "light";
                  } else {
                    tab.style.colorScheme = "";
                  }
                }
                requestAnimationFrame(() => {
                  requestAnimationFrame(() => {
                    dt.updateDragImage(...this.originalDragImageArgs);
                  });
                });
              });
            this.#changeSpaceTimer = null;
          }, this._dndSwitchSpaceDelay);
        }
      } else if (this.#changeSpaceTimer) {
        this.clearSpaceSwitchTimer();
      }
    }

    #handle_tabDragOverToSplit(event) {
      if (!this._dndSplitEnabled) {
        return;
      }

      const dt = event.dataTransfer;
      const draggedTab = dt.mozGetDataAt(TAB_DROP_TYPE, 0);
      const dragData = draggedTab._dragData;
      const movingTabsSet = dragData.movingTabsSet;
      const dropElement = event.target.closest(".tabbrowser-tab");

      // TODO: After Cheff adds split view support for essentials, don't forget to remove the check
      if (
        !dropElement ||
        !isTab(dropElement) ||
        dropElement.hasAttribute("zen-essential") ||
        dropElement.hasAttribute("zen-glance-tab") ||
        dropElement?.group?.hasAttribute("split-view-group") ||
        movingTabsSet.size > 1
      ) {
        this._clearDragOverSplit();
        return;
      }

      if (
        movingTabsSet.has(dropElement) ||
        !isTab(draggedTab) ||
        draggedTab?.group?.hasAttribute("split-view-group")
      ) {
        this._clearDragOverSplit();
        return;
      }

      const rect = window.windowUtils.getBoundsWithoutFlushing(dropElement);
      const { clientX, clientY } = event;
      const targetX = rect.x;
      const targetTop = rect.top;
      const targetWidth = rect.width;
      const targetHeight = rect.height;

      const edgeZoneThreshold = this._dndSplitThreshold / 100;

      const overlapRatioY = (clientY - targetTop) / targetHeight;
      const overlapRatioX = (clientX - targetX) / targetWidth;
      if (
        (overlapRatioX > edgeZoneThreshold && overlapRatioX < 1 - edgeZoneThreshold) ||
        overlapRatioY < edgeZoneThreshold ||
        overlapRatioY > 1 - edgeZoneThreshold
      ) {
        this._clearDragOverSplit();
        return;
      }

      const isLeft = clientX < targetX + targetWidth / 2;
      const dropSide = isLeft ? "left" : "right";

      // If the drop side or element changes, clear dragOverSplit
      if (
        this.#dragOverSplit.data?.dropElement !== dropElement ||
        this.#dragOverSplit.data?.dropSide !== dropSide
      ) {
        this._clearDragOverSplit();
      }

      if (
        this.#dragOverSplit.timer &&
        this.#dragOverSplit.data?.dropElement === dropElement &&
        this.#dragOverSplit.data?.dropSide === dropSide
      ) {
        // Timer already running for the same target and side, do nothing
        return;
      }

      this.#dragOverSplit.data = {
        dropElement,
        dropSide,
      };
      this.#dragOverSplit.timer = setTimeout(() => {
        this.#createFakeTabSplit(dropElement, dropSide);
      }, this._dndSplitDelay);
    }

    #createFakeTabSplit(dropElement, dropSide) {
      // Remove drop indicator
      this.clearDragOverVisuals();

      // Remove any existing fake tab
      if (this.#dragOverSplit.fakeTab) {
        this.#dragOverSplit.fakeTab.remove();
      }

      const element = document.createXULElement("zen-split-fake-tab");
      const firstChild = dropElement.firstChild;
      if (dropSide === "left") {
        firstChild.before(element);
      } else {
        firstChild.after(element);
      }

      this.#dragOverSplit.fakeTab = element;
    }

    _clearDragOverSplit() {
      if (this.#dragOverSplit.timer) {
        clearTimeout(this.#dragOverSplit.timer);
      }
      this.#dragOverSplit.fakeTab?.remove();

      this.#dragOverSplit.timer = null;
      this.#dragOverSplit.fakeTab = null;
      this.#dragOverSplit.data = null;
    }

    handle_windowDragEnter(event) {
      if (!this.#isMovingTab() || !this.#isOutOfWindow) {
        return;
      }
      this.#isOutOfWindow = false;
      const dt = event.dataTransfer;
      dt.updateDragImage(...this.originalDragImageArgs);
    }

    handle_windowDragLeave(event) {
      const canvas = this._tabbrowserTabs._dndCanvas;
      if (!this.#isMovingTab() || !canvas) {
        return;
      }
      let draggedTab = event.dataTransfer.mozGetDataAt(TAB_DROP_TYPE, 0);
      if (!isTab(draggedTab)) {
        return;
      }
      let { screenX, clientX, screenY, clientY } = event;
      if (!screenX && !screenY) {
        return;
      }
      const { innerWidth: winWidth, innerHeight: winHeight } = window;
      let allowedMargin = Services.prefs.getIntPref("zen.tabs.dnd-outside-window-margin", 5);
      const isOutOfWindow =
        clientX <= allowedMargin ||
        clientX >= winWidth - allowedMargin ||
        clientY <= allowedMargin ||
        clientY >= winHeight - allowedMargin;
      if (isOutOfWindow && !this.#isOutOfWindow) {
        this.#isOutOfWindow = true;
        gZenViewSplitter.onBrowserDragEndToSplit(event, true);
        this.#maybeClearVerticalPinnedGridDragOver();
        this.clearSpaceSwitchTimer();
        this.clearDragOverVisuals();
        const dt = event.dataTransfer;
        let dragData = draggedTab._dragData;
        let movingTabs = dragData.movingTabs;
        if (!this._browserDragImageWrapper) {
          const wrappingDiv = document.createXULElement("vbox");
          canvas.style.borderRadius = "8px";
          canvas.style.border = "2px solid white";
          wrappingDiv.style.width = 200 + "px";
          wrappingDiv.style.height = 130 + "px";
          wrappingDiv.style.position = "relative";
          this.#maybeCreateDragImageDot(movingTabs, wrappingDiv);
          wrappingDiv.appendChild(canvas);
          this._browserDragImageWrapper = wrappingDiv;
          document.documentElement.appendChild(wrappingDiv);
        }
        dt.updateDragImage(
          this._browserDragImageWrapper,
          this.originalDragImageArgs[1],
          this.originalDragImageArgs[2]
        );
        window.addEventListener("dragenter", this.handle_windowDragEnter, {
          once: true,
          capture: true,
        });
      }
    }

    handle_drop(event) {
      this.clearSpaceSwitchTimer();
      gZenFolders.highlightGroupOnDragOver(null);
      super.handle_drop(event);
      this.#maybeClearVerticalPinnedGridDragOver();
      this.#handle_dropSwitchSpace(event);
      this.#handle_dropCreateSplit(event);
      this._clearDragOverSplit();
    }

    handle_dragleave(event) {
      super.handle_dragleave(event);
      this._clearDragOverSplit();
    }

    #handle_dropSwitchSpace(event) {
      const dt = event.dataTransfer;
      const activeWorkspace = gZenWorkspaces.activeWorkspace;
      let draggedTab = dt.mozGetDataAt(TAB_DROP_TYPE, 0);
      if (draggedTab.ownerGlobal === window) {
        if (
          !draggedTab.hasAttribute("zen-essential") &&
          draggedTab.getAttribute("zen-workspace-id") != activeWorkspace
        ) {
          if (isTab(draggedTab)) {
            const movingTabs = draggedTab._dragData?.movingTabs || [draggedTab];
            for (let tab of movingTabs) {
              tab.setAttribute("zen-workspace-id", activeWorkspace);
            }
            gBrowser.selectedTab = draggedTab;
          } else if (isTabGroupLabel(draggedTab)) {
            draggedTab = draggedTab.group;
            gZenFolders.changeFolderToSpace(draggedTab, activeWorkspace, { hasDndSwitch: true });
          }
        }
      }
      gZenWorkspaces.updateTabsContainers();
    }

    #handle_dropCreateSplit(event) {
      const dragData = this.#dragOverSplit.data;
      const dt = event.dataTransfer;
      const draggedTab = dt.mozGetDataAt(TAB_DROP_TYPE, 0);

      if (!dragData || !draggedTab) {
        return;
      }

      const droppedOnTab = dragData.dropElement;
      const dropSide = dragData.dropSide;

      // Clear any visuals and timer
      this._clearDragOverSplit();

      const isLeft = dropSide === "left";
      gZenViewSplitter.splitTabs(
        isLeft ? [draggedTab, droppedOnTab] : [droppedOnTab, draggedTab],
        "vsep",
        isLeft ? 0 : 1
      );
    }

    handle_drop_transition(dropElement, draggedTab, movingTabs, dropBefore) {
      if (isTabGroupLabel(dropElement)) {
        dropElement = dropElement.group;
      }
      if (
        isTabGroupLabel(draggedTab) ||
        (isTab(draggedTab) && draggedTab.group?.hasAttribute("split-view-group"))
      ) {
        draggedTab = draggedTab.group;
      }
      for (let item of this._tabbrowserTabs.ariaFocusableItems) {
        item = elementToMove(item);
        item.style.transform = "";
      }
      let animations = [];
      try {
        if (
          this.#isAnimatingTabMove ||
          !gZenStartup.isReady ||
          gReduceMotion ||
          !dropElement ||
          dropElement.hasAttribute("zen-essential") ||
          draggedTab.hasAttribute("zen-essential") ||
          draggedTab.getAttribute("zen-workspace-id") != gZenWorkspaces.activeWorkspace ||
          !dropElement.visible ||
          !draggedTab.visible ||
          draggedTab.ownerGlobal !== window
        ) {
          return;
        }
        this.#isAnimatingTabMove = true;
        const animateElement = (ele, translateY) => {
          ele.style.transform = `translateY(${translateY}px)`;
          let animateInternal = (resolve) => {
            gZenUIManager
              .elementAnimate(ele, { y: [translateY, 0] }, { duration: 100, easing: "ease-out" })
              .then(() => {
                ele.style.transform = "";
                ele.style.zIndex = "";
              })
              .finally(resolve);
          };
          // Wait for the next event loop tick to ensure the initial transform style is applied.
          // We need to ensure the element has already been moved in the DOM before starting the animation.
          animations.push(
            new Promise((resolve) =>
              setTimeout(() => {
                setTimeout(() => animateInternal(resolve), 0);
              })
            )
          );
        };
        const items = this._tabbrowserTabs.ariaFocusableItems;
        let rect = window.windowUtils.getBoundsWithoutFlushing(draggedTab);
        let focusableDropElement = gBrowser.isTabGroup(dropElement)
          ? dropElement.labelElement
          : dropElement;
        let focusableDraggedTab = gBrowser.isTabGroup(draggedTab)
          ? draggedTab.labelElement
          : draggedTab;
        let tabsInBetween = [];
        let startIndex = Math.min(
          focusableDraggedTab.elementIndex,
          focusableDropElement.elementIndex + !dropBefore
        );
        let endIndex = Math.max(
          focusableDraggedTab.elementIndex,
          focusableDropElement.elementIndex - dropBefore
        );
        for (let i = startIndex; i <= endIndex; i++) {
          let item = items[i];
          if (!movingTabs.includes(item)) {
            tabsInBetween.push(item);
          }
        }
        let extraTranslate = 0;
        let translateY =
          focusableDraggedTab.elementIndex > focusableDropElement.elementIndex
            ? -rect.height
            : rect.height;
        translateY *= movingTabs.length;
        if (draggedTab.pinned != dropElement.pinned) {
          const shiftableItems = this.#dragShiftableItems;
          for (let item of shiftableItems) {
            // We also need to animate these shiftable items and add it to the extraTranslate
            // so the dragged tab ends up in the right position.
            let itemRect = window.windowUtils.getBoundsWithoutFlushing(item);
            extraTranslate += itemRect.height;
            animateElement(item, translateY);
          }
        }
        // Animate tabs in between moving out of the way
        for (let item of tabsInBetween) {
          animateElement(elementToMove(item), translateY);
        }
        let draggedTabTranslateY =
          focusableDraggedTab.elementIndex > focusableDropElement.elementIndex
            ? rect.height * tabsInBetween.length
            : -rect.height * tabsInBetween.length;
        draggedTabTranslateY +=
          extraTranslate *
          (focusableDraggedTab.elementIndex > focusableDropElement.elementIndex ? 1 : -1);
        draggedTab.style.zIndex = "9";
        animateElement(draggedTab, draggedTabTranslateY);
      } catch (e) {
        console.error(e);
      }
      Promise.all(animations).finally(() => {
        this.#isAnimatingTabMove = false;
      });
    }

    handle_dragend(event) {
      const dt = event.dataTransfer;
      const draggedTab = dt.mozGetDataAt(TAB_DROP_TYPE, 0);
      let ownerGlobal = draggedTab?.ownerGlobal;
      draggedTab.style.visibility = "";
      let thisFromGlobal = ownerGlobal?.gBrowser.tabContainer.tabDragAndDrop;
      let currentEssenialContainer = ownerGlobal.gZenWorkspaces.getCurrentEssentialsContainer();
      if (currentEssenialContainer?.essentialsPromo) {
        currentEssenialContainer.essentialsPromo.remove();
      }
      // We also call it here to ensure we clear any highlight if the drop happened
      // outside of a valid drop target.
      ownerGlobal.gZenFolders.highlightGroupOnDragOver(null);
      this.ZenDragAndDropService.onDragEnd();
      super.handle_dragend(event);
      thisFromGlobal.clearDragOverVisuals();
      ownerGlobal.gZenPinnedTabManager.removeTabContainersDragoverClass();
      thisFromGlobal._clearDragOverSplit();
      this.#maybeClearVerticalPinnedGridDragOver();
      thisFromGlobal.originalDragImageArgs = [];
      window.removeEventListener("dragenter", thisFromGlobal.handle_windowDragEnter, {
        capture: true,
      });
      this.#isOutOfWindow = false;
      if (thisFromGlobal._browserDragImageWrapper) {
        thisFromGlobal._browserDragImageWrapper.remove();
        delete thisFromGlobal._browserDragImageWrapper;
      }
      if (thisFromGlobal._tempDragImageParent) {
        thisFromGlobal._tempDragImageParent.remove();
        delete thisFromGlobal._tempDragImageParent;
      }
      delete ownerGlobal.gZenCompactModeManager._isTabBeingDragged;
      if (dt.dropEffect !== "move") {
        ownerGlobal.gZenCompactModeManager._clearAllHoverStates();
      }
    }

    #applyDragOverBackground(element) {
      if (this.#lastDropTarget === element) {
        return false;
      }
      if (isEssentialsPromo(element)) {
        element.setAttribute("dragover", "true");
        this.#lastDropTarget = element;
        return true;
      }
      const margin = 2;
      const rect = window.windowUtils.getBoundsWithoutFlushing(element);
      this.#dragOverBackground = document.createElement("div");
      this.#dragOverBackground.id = "zen-dragover-background";
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
      }
      if (this.#lastDropTarget) {
        this.#lastDropTarget.removeAttribute("dragover");
        this.#lastDropTarget = null;
      }
    }

    clearDragOverVisuals() {
      this.#removeDragOverBackground();
      gZenPinnedTabManager.removeTabContainersDragoverClass();
    }

    #canDropIntoFolder(dropElement, draggedTab) {
      let folder = dropElement?.classList.contains("tab-group-label-container")
        ? dropElement.parentElement
        : dropElement?.group;
      if (!folder?.isZenFolder) {
        return true;
      }
      if (folder.isLiveFolder) {
        const liveFolderItemId = draggedTab.getAttribute("zen-live-folder-item-id");
        if (!liveFolderItemId || !liveFolderItemId.startsWith(`${folder.id}:`)) {
          return false;
        }
      }
      return true;
    }

    // eslint-disable-next-line complexity
    #applyDragoverIndicator(event, dropElement, movingTabs, draggedTab) {
      // Doesn't show indicator when dragOverSplit
      if (this.#dragOverSplit.data) {
        return;
      }
      const separation = 4;
      const dropZoneSelector = ":is(.zen-drop-target)";
      let shouldPlayHapticFeedback = false;
      let showIndicatorUnderNewTabButton = false;
      let dropBefore = false;
      let dropElementFromEvent = event.target.closest(dropZoneSelector);
      dropElement = dropElementFromEvent || dropElement;
      if (!dropElementFromEvent) {
        let hoveringPeriphery = !!event.target.closest(
          ":is(#tabbrowser-arrowscrollbox-periphery, .pinned-tabs-container-separator)"
        );
        if (event.target.classList.contains("zen-workspace-empty-space") || hoveringPeriphery) {
          let lastTab = gBrowser.tabs.at(-1);
          let pinnedTabsCount = gBrowser._numVisiblePinTabsWithoutCollapsed;

          // Only if there are no normal tabs to drop after
          showIndicatorUnderNewTabButton = lastTab.hasAttribute("zen-empty-tab");
          let useLastPinnd =
            (hoveringPeriphery ||
              (showIndicatorUnderNewTabButton &&
                !(pinnedTabsCount - gBrowser._numZenEssentials))) &&
            Services.prefs.getBoolPref("zen.view.show-newtab-button-top");
          dropElement =
            (useLastPinnd
              ? this._tabbrowserTabs.ariaFocusableItems.at(pinnedTabsCount)
              : this._tabbrowserTabs.ariaFocusableItems.at(-1)) || lastTab;
        }
      }
      dropElement = elementToMove(dropElement);
      this.#maybeClearVerticalPinnedGridDragOver();
      if (this.#lastDropTarget !== dropElement) {
        shouldPlayHapticFeedback = this.#lastDropTarget !== null;
        this.#removeDragOverBackground();
      }
      if (!dropElement) {
        let dragData = draggedTab._dragData;
        dropElement = dragData.dropElement;
        dropBefore = dragData.dropBefore;
      }
      // Essentials should be properly handled by ::animateVerticalPinnedGridDragOver
      if (!dropElement || dropElement.hasAttribute("zen-essential")) {
        this.clearDragOverVisuals();
        return null;
      }
      if (dropElement.hasAttribute("zen-empty-tab") && dropElement.group) {
        let secondTab = dropElement.group.tabs[1];
        dropElement = secondTab || dropElement.group.labelContainerElement;
        if (secondTab) {
          dropBefore = true;
        }
      }
      let possibleFolderElement = dropElement.parentElement;
      let isZenFolder = possibleFolderElement?.isZenFolder;
      let canHightlightGroup =
        gZenFolders.highlightGroupOnDragOver(possibleFolderElement, movingTabs) || !isZenFolder;
      let rect = window.windowUtils.getBoundsWithoutFlushing(dropElement);
      const overlapPercent = (event.clientY - rect.top) / rect.height;
      // We wan't to leave a small threshold (20% for example) so we can drag tabs below and above
      // a folder label without dragging into the folder.
      let threshold = Services.prefs.getIntPref("zen.tabs.folder-dragover-threshold-percent") / 100;
      let dropIntoFolder =
        isZenFolder &&
        (overlapPercent < threshold ||
          (overlapPercent > 1 - threshold &&
            (possibleFolderElement.collapsed ||
              possibleFolderElement.childGroupsAndTabs.length < 2)));
      if (
        canHightlightGroup &&
        !dropIntoFolder &&
        !this.#canDropIntoFolder(dropElement, draggedTab)
      ) {
        this.clearDragOverVisuals();
        dropElement = null;
        return [dropElement, dropBefore];
      }
      if (
        isTabGroupLabel(draggedTab) &&
        draggedTab.group?.isZenFolder &&
        (((isTab(dropElement) || dropElement.hasAttribute("split-view-group")) &&
          (!dropElement.pinned || dropElement.hasAttribute("zen-essential"))) ||
          showIndicatorUnderNewTabButton)
      ) {
        dropElement = null;
        this.clearDragOverVisuals();
        return [dropElement, dropBefore];
      }
      if (
        isTab(dropElement) ||
        dropIntoFolder ||
        showIndicatorUnderNewTabButton ||
        dropElement.hasAttribute("split-view-group")
      ) {
        if (showIndicatorUnderNewTabButton) {
          rect = window.windowUtils.getBoundsWithoutFlushing(this.#dragShiftableItems.at(-1));
        }
        const indicator = gZenPinnedTabManager.dragIndicator;
        let top = 0;
        threshold =
          Services.prefs.getIntPref("browser.tabs.dragDrop.moveOverThresholdPercent") / 100;
        if (overlapPercent > threshold || showIndicatorUnderNewTabButton) {
          top = Math.round(rect.top + rect.height) + "px";
          dropBefore = false;
        } else {
          top = Math.round(rect.top) + "px";
          dropBefore = true;
        }
        if (indicator.style.top !== top) {
          shouldPlayHapticFeedback = true;
        }
        indicator.setAttribute("orientation", "horizontal");
        indicator.style.setProperty("--indicator-left", rect.left + separation / 2 + "px");
        indicator.style.setProperty("--indicator-width", rect.width - separation + "px");
        indicator.style.top = top;
        indicator.style.removeProperty("left");
        this.#removeDragOverBackground();
        if (!isTab(dropElement) && dropElement?.parentElement?.isZenFolder) {
          dropElement = dropElement.parentElement;
        }
      } else if (dropElement.classList.contains("zen-drop-target") && canHightlightGroup) {
        shouldPlayHapticFeedback =
          this.#applyDragOverBackground(dropElement) && !gZenPinnedTabManager._dragIndicator;
        gZenPinnedTabManager.removeTabContainersDragoverClass();
        dropElement = dropElement.parentElement?.labelElement || dropElement;
        if (dropElement.classList.contains("zen-current-workspace-indicator")) {
          dropElement =
            elementToMove(this._tabbrowserTabs.ariaFocusableItems.at(gBrowser._numZenEssentials)) ||
            dropElement;
          dropBefore = true;
        }
      }
      if (shouldPlayHapticFeedback) {
        // eslint-disable-next-line mozilla/valid-services
        Services.zen.playHapticFeedback();
      }
      return [dropBefore, dropElement];
    }

    #getDragImageOffset(event, tab, draggingTabs) {
      if (draggingTabs.length > 1) {
        return {
          offsetX: 18,
          offsetY: 18,
        };
      }
      const rect = tab.getBoundingClientRect();
      return {
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
      };
    }

    // eslint-disable-next-line complexity
    #animateVerticalPinnedGridDragOver(event) {
      let draggedTab = event.dataTransfer.mozGetDataAt(TAB_DROP_TYPE, 0);
      let dragData = draggedTab._dragData;
      let movingTabs = dragData.movingTabs;
      if (
        !gZenPinnedTabManager.canEssentialBeAdded(draggedTab) &&
        !draggedTab.hasAttribute("zen-essential")
      ) {
        return;
      }
      let essentialsPromoStatus = this.createZenEssentialsPromo();
      this.clearDragOverVisuals();
      switch (essentialsPromoStatus) {
        case "shown":
        case "created":
          return;
      }

      if (!this._fakeEssentialTab) {
        const numEssentials = gBrowser._numZenEssentials;
        let pinnedTabs = this._tabbrowserTabs.ariaFocusableItems.slice(0, numEssentials);
        this._fakeEssentialTab = document.createXULElement("vbox");
        this._fakeEssentialTab.elementIndex = numEssentials;
        delete dragData.animDropElementIndex;
        if (!draggedTab.hasAttribute("zen-essential")) {
          event.target.closest(".zen-essentials-container").appendChild(this._fakeEssentialTab);
          gZenWorkspaces.updateTabsContainers();
          pinnedTabs.push(this._fakeEssentialTab);
          this._fakeEssentialTab.getBoundingClientRect(); // Initialize layout
        }
        this.#makeDragImageEssential(event);
        let tabsPerRow = 0;
        let position = RTL_UI
          ? window.windowUtils.getBoundsWithoutFlushing(this._tabbrowserTabs.pinnedTabsContainer)
              .right
          : 0;
        for (let pinnedTab of pinnedTabs) {
          let tabPosition;
          let rect = window.windowUtils.getBoundsWithoutFlushing(pinnedTab);
          if (RTL_UI) {
            tabPosition = rect.right;
            if (tabPosition > position) {
              break;
            }
          } else {
            tabPosition = rect.left;
            if (tabPosition < position) {
              break;
            }
          }
          tabsPerRow++;
          position = tabPosition;
        }
        this.#maxTabsPerRow = tabsPerRow;
      }
      let usingFakeElement = !!this._fakeEssentialTab.parentElement;
      let elementMoving = usingFakeElement ? this._fakeEssentialTab : draggedTab;
      if (usingFakeElement) {
        movingTabs = [this._fakeEssentialTab];
      }

      let dragDataScreenX = usingFakeElement ? this._fakeEssentialTab.screenX : dragData.screenX;
      let dragDataScreenY = usingFakeElement ? this._fakeEssentialTab.screenY : dragData.screenY;

      dragData.animLastScreenX ??= dragDataScreenX;
      dragData.animLastScreenY ??= dragDataScreenY;

      let screenX = event.screenX;
      let screenY = event.screenY;

      if (screenY == dragData.animLastScreenY && screenX == dragData.animLastScreenX) {
        return;
      }

      let tabs = this._tabbrowserTabs.visibleTabs.slice(0, gBrowser._numZenEssentials);
      if (usingFakeElement) {
        tabs.push(this._fakeEssentialTab);
      }

      let directionX = screenX > dragData.animLastScreenX;
      let directionY = screenY > dragData.animLastScreenY;
      dragData.animLastScreenY = screenY;
      dragData.animLastScreenX = screenX;

      let { width: tabWidth, height: tabHeight } = elementMoving.getBoundingClientRect();
      tabWidth += 4; // Add 6px to account for the gap
      tabHeight += 4;
      let shiftSizeX = tabWidth;
      let shiftSizeY = tabHeight;
      dragData.tabWidth = tabWidth;
      dragData.tabHeight = tabHeight;

      // Move the dragged tab based on the mouse position.
      let firstTabInRow;
      let lastTabInRow;
      let lastTab = tabs.at(-1);
      if (RTL_UI) {
        firstTabInRow =
          tabs.length >= this.#maxTabsPerRow ? tabs[this.#maxTabsPerRow - 1] : lastTab;
        lastTabInRow = tabs[0];
      } else {
        firstTabInRow = tabs[0];
        lastTabInRow = tabs.length >= this.#maxTabsPerRow ? tabs[this.#maxTabsPerRow - 1] : lastTab;
      }
      let lastMovingTabScreenX = movingTabs.at(-1).screenX;
      let lastMovingTabScreenY = movingTabs.at(-1).screenY;
      let firstMovingTabScreenX = movingTabs[0].screenX;
      let firstMovingTabScreenY = movingTabs[0].screenY;
      let translateX = screenX - dragDataScreenX;
      let translateY = screenY - dragDataScreenY;
      let firstBoundX = firstTabInRow.screenX - firstMovingTabScreenX;
      let firstBoundY = this._tabbrowserTabs.screenY - firstMovingTabScreenY;
      let lastBoundX =
        lastTabInRow.screenX +
        lastTabInRow.getBoundingClientRect().width -
        (lastMovingTabScreenX + tabWidth);
      let lastBoundY = lastTab.screenY - lastMovingTabScreenY;
      lastBoundX += 4;
      firstBoundY += 6;
      translateX = Math.min(Math.max(translateX, firstBoundX), lastBoundX);
      translateY = Math.min(Math.max(translateY, firstBoundY), lastBoundY);

      // Center the tab under the cursor if the tab is not under the cursor while dragging
      if (
        screen < elementMoving.screenY + translateY ||
        screen > elementMoving.screenY + tabHeight + translateY
      ) {
        translateY = screen - elementMoving.screenY - tabHeight / 2;
      }

      if (!usingFakeElement) {
        for (let tab of movingTabs) {
          tab.style.transform = `translate(${translateX}px, ${translateY}px)`;
        }
      }

      dragData.translateX = translateX;
      dragData.translateY = translateY;

      // Determine what tab we're dragging over.
      // * Single tab dragging: Point of reference is the center of the dragged tab. If that
      //   point touches a background tab, the dragged tab would take that
      //   tab's position when dropped.
      // * Multiple tabs dragging: All dragged tabs are one "giant" tab with two
      //   points of reference (center of tabs on the extremities). When
      //   mouse is moving from top to bottom, the bottom reference gets activated,
      //   otherwise the top reference will be used. Everything else works the same
      //   as single tab dragging.
      // * We're doing a binary search in order to reduce the amount of
      //   tabs we need to check.

      tabs = tabs.filter((t) => !movingTabs.includes(t) || t == elementMoving);
      let firstTabCenterX = firstMovingTabScreenX + translateX + tabWidth / 2;
      let lastTabCenterX = lastMovingTabScreenX + translateX + tabWidth / 2;
      let tabCenterX = directionX ? lastTabCenterX : firstTabCenterX;
      let firstTabCenterY = firstMovingTabScreenY + translateY + tabHeight / 2;
      let lastTabCenterY = lastMovingTabScreenY + translateY + tabHeight / 2;
      let tabCenterY = directionY ? lastTabCenterY : firstTabCenterY;

      let shiftNumber = this.#maxTabsPerRow - movingTabs.length;

      let getTabShift = (tab, dropIndex) => {
        if (tab.elementIndex < elementMoving.elementIndex && tab.elementIndex >= dropIndex) {
          // If tab is at the end of a row, shift back and down
          let tabRow = Math.ceil((tab.elementIndex + 1) / this.#maxTabsPerRow);
          let shiftedTabRow = Math.ceil(
            (tab.elementIndex + 1 + movingTabs.length) / this.#maxTabsPerRow
          );
          if (tab.elementIndex && tabRow != shiftedTabRow) {
            return [RTL_UI ? tabWidth * shiftNumber : -tabWidth * shiftNumber, shiftSizeY];
          }
          return [RTL_UI ? -shiftSizeX : shiftSizeX, 0];
        }
        if (tab.elementIndex > elementMoving.elementIndex && tab.elementIndex < dropIndex) {
          // If tab is not index 0 and at the start of a row, shift across and up
          let tabRow = Math.floor(tab.elementIndex / this.#maxTabsPerRow);
          let shiftedTabRow = Math.floor(
            (tab.elementIndex - movingTabs.length) / this.#maxTabsPerRow
          );
          if (tab.elementIndex && tabRow != shiftedTabRow) {
            return [RTL_UI ? -tabWidth * shiftNumber : tabWidth * shiftNumber, -shiftSizeY];
          }
          return [RTL_UI ? shiftSizeX : -shiftSizeX, 0];
        }
        return [0, 0];
      };

      let low = 0;
      let high = tabs.length - 1;
      let newIndex = -1;
      let oldIndex = dragData.animDropElementIndex ?? movingTabs[0].elementIndex;
      while (low <= high) {
        let mid = Math.floor((low + high) / 2);
        if (tabs[mid] == elementMoving && ++mid > high) {
          break;
        }
        let [shiftX, shiftY] = getTabShift(tabs[mid], oldIndex);
        screenX = tabs[mid].screenX + shiftX;
        screenY = tabs[mid].screenY + shiftY;

        if (screenY + tabHeight < tabCenterY) {
          low = mid + 1;
        } else if (screenY > tabCenterY) {
          high = mid - 1;
        } else if (RTL_UI ? screenX + tabWidth < tabCenterX : screenX > tabCenterX) {
          high = mid - 1;
        } else if (RTL_UI ? screenX > tabCenterX : screenX + tabWidth < tabCenterX) {
          low = mid + 1;
        } else {
          newIndex = tabs[mid].elementIndex;
          break;
        }
      }

      if (newIndex >= oldIndex && newIndex < tabs.length) {
        newIndex++;
      }

      if (newIndex < 0) {
        newIndex = oldIndex;
      }

      if (newIndex == dragData.animDropElementIndex) {
        return;
      }

      // eslint-disable-next-line mozilla/valid-services
      Services.zen.playHapticFeedback();

      dragData.animDropElementIndex = newIndex;
      dragData.dropElement = tabs[Math.min(newIndex, tabs.length - 1)];
      dragData.dropBefore = newIndex < tabs.length;

      // Shift background tabs to leave a gap where the dragged tab
      // would currently be dropped.
      for (let tab of tabs) {
        if (tab != draggedTab) {
          let [shiftX, shiftY] = getTabShift(tab, newIndex);
          tab.style.transform = shiftX || shiftY ? `translate(${shiftX}px, ${shiftY}px)` : "";
        }
      }
    }

    #maybeClearVerticalPinnedGridDragOver() {
      if (this._fakeEssentialTab) {
        this._fakeEssentialTab.remove();
        delete this._fakeEssentialTab;
        for (let tab of this._tabbrowserTabs.visibleTabs.slice(0, gBrowser._numZenEssentials)) {
          tab.style.transform = "";
        }
        gZenWorkspaces.updateTabsContainers();
      }
    }

    #makeDragImageEssential(event) {
      const dt = event.dataTransfer;
      const draggedTab = event.dataTransfer.mozGetDataAt(TAB_DROP_TYPE, 0);
      if (draggedTab.hasAttribute("zen-essential")) {
        return;
      }
      const dragData = draggedTab._dragData;
      const [wrapper] = this.originalDragImageArgs;
      const tab = wrapper.firstElementChild;
      tab.setAttribute("zen-essential", "true");
      tab.setAttribute("pinned", "true");
      tab.setAttribute("selected", "true");
      const draggedTabRect = window.windowUtils.getBoundsWithoutFlushing(this._fakeEssentialTab);
      tab.style.minWidth = tab.style.maxWidth = wrapper.style.width = draggedTabRect.width + "px";
      tab.style.minHeight =
        tab.style.maxHeight =
        wrapper.style.height =
          draggedTabRect.height + "px";
      const offsetY = dragData.offsetY;
      const offsetX = dragData.offsetX;
      // Apply a transform translate to the tab in order to center it within the drag image
      tab.style.transform = `translate(${(54 - offsetX) / 2}px, ${(50 - offsetY) / 2}px)`;
      gZenPinnedTabManager.setEssentialTabIcon(tab);
      dt.updateDragImage(wrapper, -16, -16);
    }

    #makeDragImageNonEssential(event) {
      const dt = event.dataTransfer;
      const draggedTab = event.dataTransfer.mozGetDataAt(TAB_DROP_TYPE, 0);
      if (draggedTab.hasAttribute("zen-essential")) {
        return;
      }
      const wrapper = this.originalDragImageArgs[0];
      const tab = wrapper.firstElementChild;
      tab.style.setProperty("transition", "none", "important");
      tab.removeAttribute("zen-essential");
      tab.removeAttribute("pinned");
      tab.style.minWidth = tab.style.maxWidth = "";
      tab.style.minHeight = tab.style.maxHeight = "";
      tab.style.transform = "";
      const rect = window.windowUtils.getBoundsWithoutFlushing(draggedTab);
      wrapper.style.width = rect.width + "px";
      wrapper.style.height = rect.height + "px";
      setTimeout(() => {
        tab.style.transition = "";
        dt.updateDragImage(...this.originalDragImageArgs);
      }, 50);
    }
  };
}
