// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { XPCOMUtils } from "resource://gre/modules/XPCOMUtils.sys.mjs";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  BrowserUtils: "resource://gre/modules/BrowserUtils.sys.mjs",
});

XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "blockJavascript",
  "browser.link.alternative_click.block_javascript",
  true
);

XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "activationMethod",
  "zen.glance.activation-method",
  "ctrl"
);

// A small threshold to allow for minor mouse jitter during a normal click.
// Anything beyond this is likely an intentional drag (like selecting text).
const CLICK_DRAG_THRESHOLD_PX = 4;

export class ZenGlanceChild extends JSWindowActorChild {
  #mouseDownX = null;
  #mouseDownY = null;

  constructor() {
    super();
  }

  handleEvent(event) {
    const handler = this[`on_${event.type}`];
    if (typeof handler === "function") {
      handler.call(this, event);
    }
  }

  #ensureOnlyKeyModifiers(event) {
    return !(event.ctrlKey ^ event.altKey ^ event.shiftKey ^ event.metaKey);
  }

  #openGlance(href, principal) {
    this.sendAsyncMessage("ZenGlance:OpenGlance", {
      url: href,
      triggeringPrincipal: principal,
    });
  }

  #sendClickDataToParent(node, originalTarget) {
    if (!node) {
      node = originalTarget;
    }
    if (!node?.getBoundingClientRect) {
      return;
    }
    // Get the largest element we can get. If the `A` element
    // is a parent of the original target, use the anchor element,
    // otherwise use the original target.
    let rect = node.getBoundingClientRect();
    if (node !== originalTarget) {
      const originalTargetRect = originalTarget.getBoundingClientRect();
      if (
        originalTargetRect.width * originalTargetRect.height >
        rect.width * rect.height
      ) {
        rect = originalTargetRect;
      }
    }
    // Change the rect to make sure we take into account zoom.
    const zoom = this.browsingContext.fullZoom;
    this.sendAsyncMessage("ZenGlance:RecordLinkClickData", {
      clientX: rect.left * zoom,
      clientY: rect.top * zoom,
      width: rect.width * zoom,
      height: rect.height * zoom,
    });
  }

  /**
   * Returns the closest A element from the event target
   * and the element to record (originalTarget or target)
   *
   * @param {Event} event
   */
  #getTargetFromEvent(event) {
    // get closest A element
    let [href, node, principal] =
      lazy.BrowserUtils.hrefAndLinkNodeForClickEvent(event);
    return {
      href,
      node,
      principal,
    };
  }

  #checkSecurity(href, principal) {
    if (
      lazy.blockJavascript &&
      Services.io.extractScheme(href) == "javascript"
    ) {
      // We don't want to open new tabs or windows for javascript: links.
      return true;
    }

    try {
      Services.scriptSecurityManager.checkLoadURIStrWithPrincipal(
        principal,
        href
      );
    } catch (e) {
      return true;
    }
    return false;
  }

  on_mousedown(event) {
    // The glance animates out of the clicked element, which can only be
    // measured now. Measuring flushes layout and messages the parent, so
    // skip it for presses no glance can follow.
    if (this.#canLeadToGlance(event)) {
      const { node } = this.#getTargetFromEvent(event);
      this.#sendClickDataToParent(node, event.target);
    }

    this.#mouseDownX = event.clientX;
    this.#mouseDownY = event.clientY;
  }

  /**
   * Whether a glance can follow this mousedown. In pinned tabs any element can
   * open one, since links to other domains open in a glance (even through
   * window.open()). Elsewhere it takes a click with a modifier key or the
   * context menu, which opens on Ctrl+click on macOS.
   *
   * @param {MouseEvent} event
   * @returns {boolean}
   */
  #canLeadToGlance(event) {
    return (
      this.browsingContext.isAppTab ||
      event.button === 2 ||
      event.ctrlKey ||
      event.altKey ||
      event.shiftKey ||
      event.metaKey
    );
  }

  on_click(event) {
    // If the user drags to select text inside a link, we shouldn't open glance.
    if (this.#mouseDownX !== null && this.#mouseDownY !== null) {
      const deltaX = Math.abs(event.clientX - this.#mouseDownX);
      const deltaY = Math.abs(event.clientY - this.#mouseDownY);
      this.#mouseDownX = null;
      this.#mouseDownY = null;
      if (
        deltaX > CLICK_DRAG_THRESHOLD_PX ||
        deltaY > CLICK_DRAG_THRESHOLD_PX
      ) {
        return;
      }
    }

    if (
      event.button !== 0 ||
      event.defaultPrevented ||
      this.#ensureOnlyKeyModifiers(event)
    ) {
      return;
    }
    const activationMethod = lazy.activationMethod;
    if (activationMethod === "ctrl" && !event.ctrlKey) {
      return;
    } else if (activationMethod === "alt" && !event.altKey) {
      return;
    } else if (activationMethod === "shift" && !event.shiftKey) {
      return;
    } else if (activationMethod === "meta" && !event.metaKey) {
      return;
    }
    const { node, href, principal } = this.#getTargetFromEvent(event);
    if (!node || this.#checkSecurity(href, principal)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.#openGlance(href, principal);
  }

  on_keydown(event) {
    if (event.defaultPrevented || event.key !== "Escape") {
      return;
    }
    this.sendAsyncMessage("ZenGlance:CloseGlance", {
      hasFocused:
        this.contentWindow.document.activeElement !==
        this.contentWindow.document.body,
    });
  }
}
