// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { XPCOMUtils } from "resource://gre/modules/XPCOMUtils.sys.mjs";
import {
  MAX_STROKES,
  createGestureIcon,
  getGesturePref,
} from "resource:///modules/zen/mousegestures/ZenMouseGestures.sys.mjs";

const lazy = {};

XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "minDistance",
  "zen.mouse-gestures.min-distance",
  40,
);
XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "showTrack",
  "zen.mouse-gestures.show-track",
  true,
);
XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "showHint",
  "zen.mouse-gestures.show-hint",
  true,
);

ChromeUtils.defineLazyGetter(lazy, "l10n", () => {
  return new Localization(["browser/preferences/zen-preferences.ftl"], true);
});

// The main axis has to be this many times longer than the other one,
// otherwise the movement is too diagonal to tell what the user meant.
const AXIS_DOMINANCE_RATIO = 1.5;

// How far the mouse has to go before a plain right click turns into
// something worth drawing a trail for.
const UI_START_DISTANCE = 10;

// Skip trail points closer together than this.
const TRAIL_POINT_SPACING = 2;

// Fraction of the viewport the scroll actions move by.
const SCROLL_PAGE_FRACTION = 0.85;

// The context menu is dispatched right after the mouseup that ends the
// gesture; this is how long we keep swallowing it.
const CONTEXT_MENU_SUPPRESS_MS = 250;

const kRightButton = 2;

const kGestureListenerOptions = { mozSystemGroup: true, capture: true };

const kGestureEvents = ["mousemove", "mouseup", "dragstart", "unload"];

export class ZenMouseGesturesChild extends JSWindowActorChild {
  #tracking = false;
  #cancelled = false;
  #anchorX = 0;
  #anchorY = 0;
  #startX = 0;
  #startY = 0;
  #maxDistance = 0;
  #strokes = [];
  #suppressContextMenuUntil = 0;

  #ui = null;
  #trailLine = null;
  #hint = null;
  #hintIcon = null;
  #hintLabel = null;
  #trailPoints = [];

  handleEvent(event) {
    // Never let pages spoof a gesture with synthetic events.
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
      case "contextmenu":
        this.#onContextMenu(event);
        break;
      case "dragstart":
      case "unload":
        this.#reset();
        break;
    }
  }

  didDestroy() {
    this.#reset();
  }

  #onMouseDown(event) {
    // Recover from a mouseup we never saw.
    this.#reset();
    this.#suppressContextMenuUntil = 0;

    if (
      event.button !== kRightButton ||
      event.defaultPrevented ||
      event.ctrlKey ||
      event.altKey ||
      event.shiftKey ||
      event.metaKey
    ) {
      return;
    }
    if (this.document.pointerLockElement) {
      return;
    }
    this.#anchorX = this.#startX = event.clientX;
    this.#anchorY = this.#startY = event.clientY;
    this.#maxDistance = 0;
    this.#strokes = [];
    this.#cancelled = false;
    this.#tracking = true;
    this.#addGestureListeners();
  }

  #onMouseMove(event) {
    if (!this.#tracking) {
      return;
    }
    // The button was released somewhere we couldn't see it.
    if (!(event.buttons & kRightButton)) {
      this.#reset();
      return;
    }
    const x = event.clientX;
    const y = event.clientY;
    this.#maxDistance = Math.max(
      this.#maxDistance,
      Math.hypot(x - this.#startX, y - this.#startY),
    );
    if (this.#maxDistance >= UI_START_DISTANCE) {
      this.#addTrailPoint(x, y);
    }
    this.#updateStrokes(x, y);
  }

  /**
   * Adds the stroke the mouse is currently making to the gesture, once it
   * has gone far enough in one clear direction.
   */
  #updateStrokes(x, y) {
    const dx = x - this.#anchorX;
    const dy = y - this.#anchorY;
    if (Math.hypot(dx, dy) < lazy.minDistance) {
      return;
    }
    const direction = this.#getDirection(dx, dy);
    if (!direction) {
      return;
    }
    // Keep going the same way, or turn into a new stroke.
    this.#anchorX = x;
    this.#anchorY = y;
    if (direction === this.#strokes.at(-1) || this.#cancelled) {
      return;
    }
    if (this.#strokes.length >= MAX_STROKES) {
      this.#cancelled = true;
    } else {
      this.#strokes.push(direction);
    }
    this.#updateHint();
  }

  #onMouseUp(event) {
    if (!this.#tracking || event.button !== kRightButton) {
      return;
    }
    const isGesture =
      this.#cancelled ||
      this.#strokes.length > 0 ||
      this.#maxDistance >= lazy.minDistance;
    const action = this.#cancelled ? "none" : this.#getAction();
    this.#reset();
    if (!isGesture) {
      // Plain right click, leave the context menu alone.
      return;
    }
    event.preventDefault();
    event.preventClickEvent();
    this.#suppressContextMenuUntil = event.timeStamp + CONTEXT_MENU_SUPPRESS_MS;
    this.#perform(action);
  }

  #onContextMenu(event) {
    if (event.timeStamp > this.#suppressContextMenuUntil) {
      return;
    }
    this.#suppressContextMenuUntil = 0;
    // ContextMenuChild bails out on default-prevented events.
    event.preventDefault();
  }

  /**
   * @param {number} dx
   * @param {number} dy
   * @returns {string|null} left, right, up, down, or null when the movement
   *   is too diagonal to tell.
   */
  #getDirection(dx, dy) {
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (absX >= absY * AXIS_DOMINANCE_RATIO) {
      return dx < 0 ? "left" : "right";
    }
    if (absY >= absX * AXIS_DOMINANCE_RATIO) {
      return dy < 0 ? "up" : "down";
    }
    return null;
  }

  /**
   * @returns {string} What the gesture made so far is set to do.
   */
  #getAction() {
    if (!this.#strokes.length) {
      return "none";
    }
    return Services.prefs.getStringPref(
      getGesturePref(this.#strokes.join("-")),
      "none",
    );
  }

  #perform(action) {
    const win = this.contentWindow;
    const pageStep = win.innerHeight * SCROLL_PAGE_FRACTION;
    switch (action) {
      case "scroll-up":
        win.scrollBy({ top: -pageStep, behavior: "smooth" });
        break;
      case "scroll-down":
        win.scrollBy({ top: pageStep, behavior: "smooth" });
        break;
      case "scroll-top":
        win.scrollTo({ top: 0, behavior: "smooth" });
        break;
      case "scroll-bottom":
        win.scrollTo({
          top: this.document.documentElement.scrollHeight,
          behavior: "smooth",
        });
        break;
      case "none":
        break;
      default:
        this.sendAsyncMessage("ZenMouseGestures:Action", { action });
    }
  }

  #reset() {
    this.#tracking = false;
    this.#removeUI();
    const win = this.contentWindow;
    if (!win) {
      return;
    }
    for (const type of kGestureEvents) {
      win.removeEventListener(type, this, kGestureListenerOptions);
    }
  }

  #addGestureListeners() {
    const win = this.contentWindow;
    for (const type of kGestureEvents) {
      win.addEventListener(type, this, kGestureListenerOptions);
    }
  }

  // The trail and the hint are anonymous content, so the page can neither
  // see nor restyle them.

  #ensureUI() {
    if (this.#ui || !(lazy.showTrack || lazy.showHint)) {
      return;
    }
    this.#ui = this.document.insertAnonymousContent();
    const root = this.#ui.root;
    root.appendChild(this.#createFragment());
    this.#trailLine = root.getElementById("zen-gesture-trail-line");
    this.#hint = root.getElementById("zen-gesture-hint");
    this.#hintIcon = root.getElementById("zen-gesture-hint-icon");
    this.#hintLabel = root.getElementById("zen-gesture-hint-label");
    root
      .getElementById("zen-gesture-ui")
      .style.setProperty(
        "--zen-primary-color",
        Services.prefs.getStringPref("zen.theme.accent-color", ""),
      );
  }

  #createFragment() {
    const parser = new DOMParser();
    const doc = parser.parseFromString(
      `<template>
        <link rel="stylesheet" href="chrome://browser/content/zen-styles/content/zen-mouse-gestures.css" />
        <div id="zen-gesture-ui">
          <svg id="zen-gesture-trail" aria-hidden="true">
            <polyline id="zen-gesture-trail-line" points="" />
          </svg>
          <div id="zen-gesture-hint" aria-hidden="true" hidden="true">
            <div id="zen-gesture-hint-icon"></div>
            <div id="zen-gesture-hint-label"></div>
          </div>
        </div>
      </template>`,
      "text/html",
    );
    const template = this.document.importNode(
      doc.querySelector("template"),
      true,
    );
    return template.content.cloneNode(true);
  }

  #removeUI() {
    this.#trailPoints = [];
    if (!this.#ui) {
      return;
    }
    const ui = this.#ui;
    this.#ui = this.#trailLine = this.#hint = null;
    this.#hintIcon = this.#hintLabel = null;
    try {
      this.document.removeAnonymousContent(ui);
    } catch (e) {
      // The document is already gone, and the trail with it.
    }
  }

  #addTrailPoint(x, y) {
    this.#ensureUI();
    if (!this.#ui || !lazy.showTrack) {
      return;
    }
    const last = this.#trailPoints.at(-1);
    if (last && Math.hypot(x - last.x, y - last.y) < TRAIL_POINT_SPACING) {
      return;
    }
    // The trail starts where the gesture did, not where we noticed it.
    if (!last) {
      this.#trailPoints.push({ x: this.#startX, y: this.#startY });
    }
    this.#trailPoints.push({ x, y });
    this.#trailLine.setAttribute(
      "points",
      this.#trailPoints.map((point) => `${point.x},${point.y}`).join(" "),
    );
  }

  #updateHint() {
    if (!lazy.showHint) {
      return;
    }
    this.#ensureUI();
    if (!this.#ui) {
      return;
    }
    const action = this.#cancelled ? "none" : this.#getAction();
    if (action === "none") {
      this.#hint.hidden = true;
      return;
    }
    const [message] = lazy.l10n.formatMessagesSync([
      { id: `zen-mouse-gestures-action-${action}` },
    ]);
    this.#hintIcon.replaceChildren(
      createGestureIcon(this.document, this.#strokes.join("-")),
    );
    this.#hintLabel.textContent =
      message?.attributes?.find((attr) => attr.name === "label")?.value ?? "";
    this.#hint.hidden = false;
  }
}
