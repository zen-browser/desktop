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
  "glanceEnabled",
  "zen.glance.enabled",
  true
);

XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "glanceActivationMethod",
  "zen.glance.activation-method",
  "shift"
);

XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "splitActivationMethod",
  "zen.content-link-handling.split-activation-method",
  "alt"
);

// A small threshold to allow for minor mouse jitter during a normal click.
// Anything beyond this is likely an intentional drag (like selecting text).
const CLICK_DRAG_THRESHOLD_PX = 4;

export class ContentLinkHandlingChild extends JSWindowActorChild {
  #mouseDownX = null;
  #mouseDownY = null;

  constructor() {
    super();
  }

  async handleEvent(event) {
    const handler = this[`on_${event.type}`];
    if (typeof handler === "function") {
      await handler.call(this, event);
    }
  }

  #openGlance(href, principal) {
    this.sendAsyncMessage("ContentLinkHandling:OpenGlance", {
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
    const originalTargetRect = originalTarget.getBoundingClientRect();
    if (
      originalTargetRect.width * originalTargetRect.height >
      rect.width * rect.height
    ) {
      rect = originalTargetRect;
    }
    // Change the rect to make sure we take into account zoom.
    const zoom = this.browsingContext.fullZoom;
    this.sendAsyncMessage("ContentLinkHandling:RecordLinkClickData", {
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
    const { node } = this.#getTargetFromEvent(event);
    // We record the link data anyway, even if the glance may be invoked
    // or not. We have some cases where glance would open, for example,
    // when clicking on a link with a different domain where glance would open.
    // The problem is that at that stage we don't know the rect or even what
    // element has been clicked, so we send the data here.
    if (lazy.glanceEnabled) {
      this.#sendClickDataToParent(node, event.target);
    }

    this.#mouseDownX = event.clientX;
    this.#mouseDownY = event.clientY;
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

    const { href, principal } = this.#getTargetFromEvent(event);
    if (
      !event.isTrusted ||
      event.button !== 0 ||
      !href ||
      event.defaultPrevented ||
      [event.ctrlKey, event.altKey, event.shiftKey, event.metaKey].filter(
        Boolean
      ).length !== 1
    ) {
      return;
    }
    const openGlance =
      lazy.glanceEnabled && event[`${lazy.glanceActivationMethod}Key`] === true;
    if (!openGlance && event[`${lazy.splitActivationMethod}Key`] !== true) {
      return;
    }
    if (!openGlance && Services.io.extractScheme(href) === "javascript") {
      return;
    }
    if (this.#checkSecurity(href, principal)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (openGlance) {
      this.#openGlance(href, principal);
    } else {
      this.sendAsyncMessage("ContentLinkHandling:OpenSplitLink", { url: href });
    }
  }

  on_keydown(event) {
    if (
      !lazy.glanceEnabled ||
      event.defaultPrevented ||
      event.key !== "Escape"
    ) {
      return;
    }
    this.sendAsyncMessage("ContentLinkHandling:CloseGlance", {
      hasFocused:
        this.contentWindow.document.activeElement !==
        this.contentWindow.document.body,
    });
  }
}
