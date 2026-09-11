/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Tab strip drag and drop for the copies of the strips the space cards show.
 *
 * A drag starts on the real tab through the sidebar strip's own instance,
 * which also ends it, as the real tab is what the drag session holds. Over
 * the copies, drags get the same targets the sidebar offers: next to a tab
 * or split, into a folder, or held over a tab to split with it. A drop acts
 * on the real elements, in the card's space.
 */
export class ZenLibraryDragAndDrop extends window.ZenDragAndDrop {
  #section;
  /** @type {{element: Element, dropBefore: boolean, intoFolder: boolean}|null} */
  #target = null;
  #highlightedLabel = null;

  /**
   * @param {ZenLibrarySpacesSection} section - The section showing the
   *   copies; it maps each copy back to the real element
   */
  constructor(section) {
    super(section);
    this.#section = section;
  }

  _targetForDrop(element) {
    return this.#section.realElementFor(element) ?? element;
  }

  /**
   * @param {DragEvent} event
   * @returns {Element|null} The dragged tab, or the label of the dragged
   *   split view, when it comes from this window
   */
  #draggedItem(event) {
    if (this.getDropEffectForTabDrag(event) !== "move") {
      return null;
    }
    const item = event.dataTransfer.mozGetDataAt(TAB_DROP_TYPE, 0);
    if (!item || item.documentGlobal !== window) {
      return null;
    }
    return gBrowser.isTab(item) || this.#isSplitViewLabel(item) ? item : null;
  }

  #isSplitViewLabel(item) {
    return (
      gBrowser.isTabGroupLabel(item) &&
      !!item.group?.hasAttribute("split-view-group")
    );
  }

  /**
   * The tabs and split views a drag moves, from the drag data set on the
   * dragged item.
   *
   * @param {Element} item - The dragged tab or split view label
   * @returns {Element[]} Tabs and split view groups
   */
  #movingElements(item) {
    const moving = item._dragData?.movingTabs ?? [item];
    return moving.map(element =>
      gBrowser.isTabGroupLabel(element) ? element.group : element
    );
  }

  /**
   * @param {DragEvent} event
   * @param {Element} copy - The copied tab being dragged
   */
  startTabDrag(event, copy) {
    let item = this._targetForDrop(copy);
    if (!gBrowser.isTab(item)) {
      return;
    }
    // A tab of a split view moves along with the whole split view, as it
    // does in the strip, which drags it by its label.
    let shown = copy;
    if (item.group?.hasAttribute("split-view-group")) {
      item = item.group.labelElement;
      shown = copy.group;
    }
    const strip = gBrowser.tabContainer.tabDragAndDrop;
    strip.startTabDrag(event, item, { fromTabList: true });
    // The strip built its drag image from the real item, which has no size
    // when its space is not on screen; build it from the grabbed copy.
    strip._tempDragImageParent?.remove();
    const image = strip._createDragImageForTabs([shown]);
    const rect = shown.getBoundingClientRect();
    strip.originalDragImageArgs = [
      image,
      event.clientX - rect.left,
      event.clientY - rect.top,
    ];
    event.dataTransfer.setDragImage(...strip.originalDragImageArgs);
  }

  handle_dragover(event) {
    const item = this.#draggedItem(event);
    if (!item) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    this._handle_tabDragOverToSplit(event);
    this.#updateDropTarget(event, item);
  }

  handle_dragleave(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      this.clearDragOverVisuals();
    }
  }

  handle_drop(event) {
    const item = this.#draggedItem(event);
    if (!item) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    const target = this.#target;
    const uuid = event.currentTarget.closest(".zen-library-space").dataset.uuid;
    const moving = this.#movingElements(item);
    // The tabs themselves, also for split views, which move as a whole.
    const tabs = moving.flatMap(element =>
      gBrowser.isTab(element) ? [element] : element.tabs
    );
    const fromElsewhere = tabs.filter(
      tab => tab.getAttribute("zen-workspace-id") !== uuid
    );
    if (fromElsewhere.length) {
      gZenWorkspaces.moveTabsToWorkspace(fromElsewhere, uuid);
    }
    const split = this._handle_dropCreateSplit(event);
    this.clearDragOverVisuals();
    if (split || !target) {
      return;
    }
    const { element, dropBefore, intoFolder } = target;
    if (intoFolder) {
      element.addTabs(moving);
      // addTabs appends to the folder's end; the strip drops onto a folder at
      // its start, so move ahead of the first tab that was already there.
      const firstExisting = element.tabs.find(tab => !tabs.includes(tab));
      if (firstExisting) {
        gBrowser.moveTabsBefore(moving, firstExisting);
      }
      return;
    }
    const pinned = gBrowser.isTab(element)
      ? element.pinned
      : (element.tabs?.[0]?.pinned ?? element.pinned);
    for (const tab of tabs) {
      if (pinned && !tab.pinned) {
        gBrowser.pinTab(tab);
      } else if (!pinned && tab.pinned) {
        gBrowser.unpinTab(tab);
      }
    }
    if (dropBefore) {
      gBrowser.moveTabsBefore(moving, element);
    } else {
      gBrowser.moveTabsAfter(moving, element);
    }
  }

  clearDragOverVisuals(options) {
    super.clearDragOverVisuals(options);
    gZenFolders.highlightGroupOnDragOver(null);
    this.#highlightedLabel?.removeAttribute("dragover");
    this.#highlightedLabel = null;
    this.#target = null;
  }

  /**
   * Works out what a drop at the pointer would do and shows it on the
   * copies: the strip's line next to a tab, split or folder, or the folder
   * opening up when the drop would go into it.
   *
   * @param {DragEvent} event
   * @param {Element} item - The dragged tab or split view label
   */
  #updateDropTarget(event, item) {
    if (this._splitDropReady) {
      return;
    }
    const movingTabs = item._dragData?.movingTabs ?? [item];
    const moving = this.#movingElements(item);
    let copy = event.target.closest("tab, .tab-group-label-container");
    if (copy?.hasAttribute("zen-glance-tab")) {
      copy = copy.parentElement.closest("tab");
    }
    if (copy?.classList.contains("tab-group-label-container")) {
      copy = copy.parentElement;
    } else if (copy?.group?.hasAttribute("split-view-group")) {
      copy = copy.group;
    }
    const element = copy && this._targetForDrop(copy);
    if (
      !element ||
      moving.some(moved => moved === element || moved.contains(element))
    ) {
      this.clearDragOverVisuals();
      return;
    }
    const isFolder = !!element.isZenFolder;
    const box = isFolder ? copy.labelContainerElement : copy;
    const rect = box.getBoundingClientRect();
    const overlap = (event.clientY - rect.top) / rect.height;
    let dropBefore;
    let intoFolder = false;
    if (isFolder) {
      // Only the edges of a folder's label drop next to the folder; the
      // rest of it drops inside.
      const threshold =
        Services.prefs.getIntPref(
          "zen.tabs.folder-dragover-threshold-percent"
        ) / 100;
      if (overlap < threshold) {
        dropBefore = true;
      } else if (
        overlap > 1 - threshold &&
        (copy.collapsed || element.childGroupsAndTabs.length < 2)
      ) {
        dropBefore = false;
      } else {
        intoFolder = true;
      }
    } else {
      const threshold =
        Services.prefs.getIntPref(
          "browser.tabs.dragDrop.moveOverThresholdPercent"
        ) / 100;
      dropBefore = overlap <= threshold;
    }

    const previous = this.#target;
    this.#target = { element, dropBefore, intoFolder };
    const changed =
      previous?.element !== element ||
      previous.dropBefore !== dropBefore ||
      previous.intoFolder !== intoFolder;
    if (!changed) {
      return;
    }
    if (previous) {
      // eslint-disable-next-line mozilla/valid-services
      Services.zen.playHapticFeedback();
    }

    this.#highlightedLabel?.removeAttribute("dragover");
    this.#highlightedLabel = null;
    if (intoFolder) {
      gZenPinnedTabManager.removeTabContainersDragoverClass();
      gZenFolders.highlightGroupOnDragOver(copy, movingTabs);
      this.#highlightedLabel = box;
      box.setAttribute("dragover", "true");
      return;
    }
    gZenFolders.highlightGroupOnDragOver(null);
    // The strip's indicator is placed within the card's strip, so it scrolls
    // with the copies.
    const strip = copy.closest(".zen-library-space-tabs");
    const indicator = gZenPinnedTabManager.dragIndicator;
    if (indicator.parentNode !== strip) {
      strip.appendChild(indicator);
    }
    const stripRect = strip.getBoundingClientRect();
    const separation = 4;
    indicator.setAttribute("orientation", "horizontal");
    indicator.style.setProperty(
      "--indicator-left",
      `${rect.left - stripRect.left + separation / 2}px`
    );
    indicator.style.setProperty(
      "--indicator-width",
      `${rect.width - separation}px`
    );
    indicator.style.top = `${Math.round(
      (dropBefore ? rect.top : rect.bottom) - stripRect.top + strip.scrollTop
    )}px`;
    indicator.style.removeProperty("left");
  }
}
