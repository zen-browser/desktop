/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export class ZenLibraryDragAndDrop extends window.ZenDragAndDrop {
  #section;
  /** @type {{element: Element, dropBefore: boolean, intoFolder: boolean}|null} */
  #target = null;
  #highlightedLabel = null;
  // The space whose theme the drag image currently wears, so it is only
  // restyled when the pointer crosses into a different card.
  #dragImageSpace = null;

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
    let shown = copy;
    if (item.group?.hasAttribute("split-view-group")) {
      item = item.group.labelElement;
      shown = copy.group;
    }
    const strip = gBrowser.tabContainer.tabDragAndDrop;
    strip.startTabDrag(event, item, {
      fromTabList: true,
      dragImageSource: shown,
      armLanding: this.#landingSupported,
    });
    this.#dragImageSpace = copy.closest(".zen-library-space")?.dataset.uuid;
    this.#styleDragImage(strip, this.#dragImageSpace);
  }

  #styleDragImage(strip, uuid) {
    const workspace = uuid && gZenWorkspaces.getWorkspaceFromId(uuid);
    if (!workspace) {
      return;
    }
    for (const clone of strip.originalDragImageArgs?.[0]?.querySelectorAll(
      "tab"
    ) ?? []) {
      clone.toggleAttribute("visuallyselected", true);
      clone.toggleAttribute("selected", true);
    }
    strip._recolorDragImage(workspace);
  }

  handle_dragover(event) {
    const item = this.#draggedItem(event);
    if (!item) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    this.#updateDragImageSpace(event);
    this._handle_tabDragOverToSplit(event);
    this.#updateDropTarget(event, item);
  }

  /**
   * Recolours the drag image to match the card under the pointer, so it reads
   * as the space it would drop into.
   *
   * @param {DragEvent} event
   */
  #updateDragImageSpace(event) {
    const uuid = event.target.closest(".zen-library-space")?.dataset.uuid;
    if (!uuid || uuid === this.#dragImageSpace) {
      return;
    }
    this.#dragImageSpace = uuid;
    const strip = gBrowser.tabContainer.tabDragAndDrop;
    this.#styleDragImage(strip, uuid);
    strip._refreshDragImage(event.dataTransfer);
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
    const tabs = moving.flatMap(element =>
      gBrowser.isTab(element) ? [element] : element.tabs
    );
    const fromElsewhere = tabs.filter(
      tab => tab.getAttribute("zen-workspace-id") !== uuid
    );
    const strip = gBrowser.tabContainer.tabDragAndDrop;
    const copyBefore = this.#section.copyForTab(tabs[0]);
    const placeBefore = copyBefore && strip._placeOf(copyBefore);
    if (fromElsewhere.length) {
      gZenWorkspaces.moveTabsToWorkspace(fromElsewhere, uuid);
    }
    const split = this._handle_dropCreateSplit(event, { activate: false });
    this.clearDragOverVisuals();
    if (!split && target) {
      const { element, dropBefore, intoFolder } = target;
      if (intoFolder) {
        element.addTabs(moving);
        const firstExisting = element.tabs.find(tab => !tabs.includes(tab));
        if (firstExisting) {
          gBrowser.moveTabsBefore(moving, firstExisting);
        }
      } else {
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
    }
    this.#land(tabs[0], placeBefore);
  }

  get #landingSupported() {
    return AppConstants.platform === "macosx" && !gReduceMotion;
  }

  /**
   * @param {Element} tab - The dropped tab
   * @param {string|null} placeBefore - Where its copy was before the drop;
   *   a copy still there stays in sight under the image
   */
  #land(tab, placeBefore) {
    if (!this.#landingSupported) {
      return;
    }
    const copy = this.#section.beginTabLanding(tab);
    if (copy) {
      gBrowser.tabContainer.tabDragAndDrop._landDragImageOnElements(
        [copy],
        new Map([[copy, placeBefore]])
      );
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
   * @param {Element|null} strip - A card's tab strip
   * @returns {Element|null} The last tab or folder label shown in it
   */
  #lastRow(strip) {
    if (!strip) {
      return null;
    }
    const rows = strip.querySelectorAll(
      "tab:not([zen-empty-tab]):not([zen-glance-tab]), .tab-group-label-container"
    );
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i].getBoundingClientRect().height > 0) {
        return rows[i];
      }
    }
    return null;
  }

  /**
   * Works out what a drop at the pointer would do and shows it on the copies.
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
    if (!copy) {
      copy = this.#lastRow(event.target.closest(".zen-library-space-tabs"));
    }
    if (copy?.hasAttribute("zen-glance-tab")) {
      copy = copy.parentElement.closest("tab");
    }
    if (copy?.classList.contains("tab-group-label-container")) {
      copy = copy.parentElement;
    } else if (copy?.group?.hasAttribute("split-view-group")) {
      copy = copy.group;
    }
    const element = copy && this._targetForDrop(copy);
    if (!element) {
      // A card with nothing in it takes the drop at its start.
      const strip = event.target.closest(".zen-library-space-tabs");
      if (strip && !this.#lastRow(strip)) {
        this.#target = null;
        gZenFolders.highlightGroupOnDragOver(null);
        this.#placeIndicatorIn(strip, 0);
        return;
      }
      this.clearDragOverVisuals();
      return;
    }
    if (moving.some(moved => moved === element || moved.contains(element))) {
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
      dropBefore = this._dropsBefore(event, rect);
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
    const strip = copy.closest(".zen-library-space-tabs");
    this.#placeIndicatorIn(
      strip,
      (dropBefore ? rect.top : rect.bottom) - strip.getBoundingClientRect().top
    );
  }

  /**
   * @param {Element} strip - A card's tab strip
   * @param {number} offset - Where in the strip's view the drop would go
   */
  #placeIndicatorIn(strip, offset) {
    const inset = 14;
    this._placeDropIndicator({
      parent: strip,
      left: inset,
      width: strip.getBoundingClientRect().width - 2 * inset,
      top: offset + strip.scrollTop,
    });
  }
}
