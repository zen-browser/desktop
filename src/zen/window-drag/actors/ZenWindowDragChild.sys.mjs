// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { XPCOMUtils } from "resource://gre/modules/XPCOMUtils.sys.mjs";

const lazy = {};

XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "dragRegionHeightPercentage",
  "zen.view.drag-window-from-content.height-percentage",
  10
);

XPCOMUtils.defineLazyServiceGetter(
  lazy,
  "zenWindowDragUtils",
  "@mozilla.org/zen/window-drag-utils;1",
  Ci.nsIZenWindowDragUtils
);

// Movement below this is considered a click, not a window drag. Fast
// clicks commonly slide a few pixels (especially on trackpads), and once
// the native move starts the OS swallows the mouseup — so keep this
// comfortably above click jitter or clicks in the region get lost.
const DRAG_START_THRESHOLD_PX = 4;

// Un-snapping a maximized or tiled window is more disruptive, so those
// need a firmer gesture, mirroring how native titlebars behave.
const SNAPPED_DRAG_START_THRESHOLD_PX = 50;

// Content that drives its own mouse interaction without being
// interactive HTML content in the spec sense.
const kAppContentTags = new Set(["audio", "canvas", "video"]);

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

const kGestureListenerOptions = { mozSystemGroup: true, capture: true };

const kGestureEvents = ["mousemove", "mouseup", "dragstart", "unload"];

export class ZenWindowDragChild extends JSWindowActorChild {
  #tracking = false;
  #dragging = false;
  #startScreenX = 0;
  #startScreenY = 0;
  // 0 while waiting for the ZenWindowDrag:IsSnapped answer; no drag can
  // start until the proper threshold is known.
  #dragThresholdPx = 0;

  handleEvent(event) {
    // Never let pages spoof the gesture with synthetic events.
    if (!event.isTrusted) {
      return;
    }
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
    this.#dragThresholdPx = 0;
    this.#tracking = true;
    this.#addGestureListeners();
    this.sendQuery("ZenWindowDrag:IsSnapped")
      .then(snapped => {
        if (this.#tracking) {
          this.#dragThresholdPx = snapped
            ? SNAPPED_DRAG_START_THRESHOLD_PX
            : DRAG_START_THRESHOLD_PX;
        }
      })
      .catch(() => this.#reset());
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
    if (!this.#dragThresholdPx) {
      return;
    }
    const point = this.#screenPoint(event);
    const threshold =
      this.#dragThresholdPx * this.contentWindow.devicePixelRatio;
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
    let target = event.explicitOriginalTarget;
    if (target?.nodeType === Node.TEXT_NODE) {
      // The hit-test landed on rendered text; a drag here should select
      // it instead, unless it isn't selectable.
      if (this.#isSelectableText(target)) {
        return true;
      }
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
    // The effective cursor, resolved the same way it is shown to the user.
    return lazy.zenWindowDragUtils.isInteractiveCursor(
      event.composedTarget,
      event.clientX,
      event.clientY
    );
  }

  #isSelectableText(node) {
    const parent = node.parentElement;
    return (
      !parent ||
      this.contentWindow.getComputedStyle(parent).userSelect !== "none"
    );
  }

  #isInteractiveElement(element) {
    // Gecko's own notion of interactive, editable or draggable content.
    if (lazy.zenWindowDragUtils.isInteractiveContent(element)) {
      return true;
    }
    if (kAppContentTags.has(element.localName)) {
      return true;
    }
    // Declarative signals the engine check doesn't cover: ARIA widget
    // roles and explicit tab stops.
    if (
      element.tabIndex >= 0 &&
      element !== this.document.body &&
      element !== this.document.documentElement
    ) {
      return true;
    }
    const role = element.getAttribute?.("role");
    return !!role && kInteractiveRoles.has(role.toLowerCase());
  }
}
