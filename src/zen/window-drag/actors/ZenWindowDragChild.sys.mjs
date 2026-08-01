// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { XPCOMUtils } from "resource://gre/modules/XPCOMUtils.sys.mjs";

const lazy = {};

XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "dragRegionHeightPercentage",
  "zen.view.drag-window-from-content.height-percentage",
  30
);

// A small threshold to allow for minor mouse jitter during a normal click.
// Anything beyond this is considered an intentional window drag.
const DRAG_START_THRESHOLD_PX = 4;

const kInteractiveTags = new Set([
  "a",
  "area",
  "audio",
  "button",
  "canvas",
  "details",
  "dialog",
  "embed",
  "frame",
  "iframe",
  "img",
  "input",
  "label",
  "menu",
  "object",
  "optgroup",
  "option",
  "select",
  "summary",
  "textarea",
  "video",
]);

const kInteractiveRoles = new Set([
  "button",
  "checkbox",
  "combobox",
  "grid",
  "link",
  "listbox",
  "menu",
  "menubar",
  "menuitem",
  "option",
  "radio",
  "scrollbar",
  "searchbox",
  "slider",
  "spinbutton",
  "switch",
  "tab",
  "textbox",
  "toolbar",
  "tree",
  "treegrid",
]);

// Cursors that signal the page considers the area interactive or draggable.
const kInteractiveCursors = new Set([
  "pointer",
  "grab",
  "grabbing",
  "move",
  "all-scroll",
  "text",
  "vertical-text",
  "cell",
  "crosshair",
  "col-resize",
  "row-resize",
  "n-resize",
  "e-resize",
  "s-resize",
  "w-resize",
  "ne-resize",
  "nw-resize",
  "se-resize",
  "sw-resize",
  "ew-resize",
  "ns-resize",
  "nesw-resize",
  "nwse-resize",
]);

const kGestureListenerOptions = { mozSystemGroup: true, capture: true };

const kGestureEvents = ["mousemove", "mouseup", "dragstart", "unload"];

export class ZenWindowDragChild extends JSWindowActorChild {
  #tracking = false;
  #dragging = false;
  #startScreenX = 0;
  #startScreenY = 0;

  handleEvent(event) {
    switch (event.type) {
      case "mousedown":
        this.#onMouseDown(event);
        break;
      case "mousemove":
        this.#onMouseMove(event);
        break;
      case "mouseup":
        this.#onMouseUp(event);
        break;
      case "dragstart":
        // The gesture turned out to be a real content drag. Let it win.
        this.#reset();
        break;
      case "unload":
        this.#reset();
        break;
    }
  }

  get #dragRegionHeight() {
    const percentage =
      Math.max(0, Math.min(100, lazy.dragRegionHeightPercentage)) / 100;
    return this.contentWindow.innerHeight * percentage;
  }

  #screenPoint(event) {
    const dpr = this.contentWindow.devicePixelRatio;
    return {
      screenX: Math.round(event.screenX * dpr),
      screenY: Math.round(event.screenY * dpr),
    };
  }

  #onMouseDown(event) {
    if (this.#tracking || this.#dragging) {
      // The native OS move swallows the mouseup, so a stale gesture may
      // still be tracked. Recover and evaluate this mousedown normally.
      this.#reset();
    }
    if (
      event.button !== 0 ||
      event.buttons !== 1 ||
      event.detail !== 1 ||
      event.defaultPrevented ||
      event.ctrlKey ||
      event.altKey ||
      event.shiftKey ||
      event.metaKey
    ) {
      return;
    }
    const doc = this.document;
    if (doc.fullscreenElement || doc.pointerLockElement) {
      return;
    }
    // Only handle events from the top document itself; anything inside an
    // (i)frame belongs to the page.
    if (event.composedTarget?.ownerDocument !== doc) {
      return;
    }
    if (event.clientY > this.#dragRegionHeight) {
      return;
    }
    let overContent = true;
    try {
      overContent = this.#isEventOverDraggableContent(event);
    } catch (e) {
      console.error("ZenWindowDrag: eligibility check failed", e);
    }
    if (overContent) {
      return;
    }
    const { screenX, screenY } = this.#screenPoint(event);
    this.#startScreenX = screenX;
    this.#startScreenY = screenY;
    this.#tracking = true;
    this.#addGestureListeners();
  }

  #onMouseMove(event) {
    if (!this.#tracking) {
      return;
    }
    // We missed the mouseup (e.g. the OS consumed it during the native
    // move, or it happened outside the window).
    if (!(event.buttons & 1)) {
      this.#reset();
      return;
    }
    if (this.#dragging) {
      // Keep the page from extending a text selection under the gesture.
      event.preventDefault();
      return;
    }
    const point = this.#screenPoint(event);
    const threshold =
      DRAG_START_THRESHOLD_PX * this.contentWindow.devicePixelRatio;
    if (
      Math.hypot(
        point.screenX - this.#startScreenX,
        point.screenY - this.#startScreenY
      ) < threshold
    ) {
      return;
    }
    this.#dragging = true;
    // The mousedown may have moved the caret or started a stray selection.
    this.contentWindow.getSelection()?.removeAllRanges();
    // The OS takes over the drag from here.
    this.sendAsyncMessage("ZenWindowDrag:StartDrag");
    event.preventDefault();
  }

  #onMouseUp(event) {
    if (!this.#tracking || event.button !== 0) {
      return;
    }
    if (this.#dragging) {
      event.preventDefault();
      event.preventClickEvent();
    }
    this.#reset();
  }

  #reset() {
    this.#tracking = false;
    this.#dragging = false;
    this.#removeGestureListeners();
  }

  #addGestureListeners() {
    const win = this.contentWindow;
    for (const type of kGestureEvents) {
      win.addEventListener(type, this, kGestureListenerOptions);
    }
  }

  #removeGestureListeners() {
    const win = this.contentWindow;
    if (!win) {
      return;
    }
    for (const type of kGestureEvents) {
      win.removeEventListener(type, this, kGestureListenerOptions);
    }
  }

  /**
   * Returns true if starting a window drag here would fight with content
   * that the page wants to be clickable, draggable or selectable.
   *
   * @param {MouseEvent} event
   */
  #isEventOverDraggableContent(event) {
    // Scrollbars and other native anonymous parts only dispatch to the
    // system group, which is us. Never treat those as a window drag.
    if (event.originalTarget?.isNativeAnonymous) {
      return true;
    }
    let target = event.composedTarget;
    if (target?.nodeType === Node.TEXT_NODE) {
      target = target.parentElement;
    }
    if (!target || target.nodeType !== Node.ELEMENT_NODE) {
      return true;
    }
    for (let node = target; node; node = node.flattenedTreeParentNode) {
      if (node.nodeType !== Node.ELEMENT_NODE) {
        continue;
      }
      if (this.#isInteractiveElement(node)) {
        return true;
      }
    }
    return this.#hasInteractiveCursor(target);
  }

  #isInteractiveElement(element) {
    if (kInteractiveTags.has(element.localName)) {
      return true;
    }
    // Covers [draggable="true"] and elements draggable by default,
    // like links and images.
    if (element.draggable) {
      return true;
    }
    if (element.isContentEditable) {
      return true;
    }
    if (
      element.tabIndex >= 0 &&
      element !== this.document.body &&
      element !== this.document.documentElement
    ) {
      return true;
    }
    const role = element.getAttribute?.("role");
    if (role && kInteractiveRoles.has(role.toLowerCase())) {
      return true;
    }
    // Inline event handlers are a strong hint of a custom widget.
    if (
      element.onclick ||
      element.onmousedown ||
      element.onpointerdown ||
      element.ondragstart
    ) {
      return true;
    }
    return false;
  }

  #hasInteractiveCursor(element) {
    const style = element.ownerGlobal?.getComputedStyle(element);
    if (!style) {
      return false;
    }
    const cursor = style.cursor.split(",").pop().trim();
    return kInteractiveCursors.has(cursor);
  }
}
