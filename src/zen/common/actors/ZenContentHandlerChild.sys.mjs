// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { AppConstants } from "resource://gre/modules/AppConstants.sys.mjs";
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

const LINK_ACTIONS = [
  {
    message: "ZenContentHandler:OpenGlance",
    modifiersPref: "zen.glance.activation-method",
  },
  {
    message: "ZenContentHandler:OpenSplit",
    modifiersPref: "zen.splitView.link-activation-method",
  },
  {
    message: "ZenContentHandler:OpenLittleWindow",
    modifiersPref: "zen.little-window.link-activation-method",
  },
];

const MODIFIERS = ["ctrl", "alt", "shift", "meta"];
const ACCEL = AppConstants.platform == "macosx" ? "meta" : "ctrl";

// A small threshold to allow for minor mouse jitter during a normal click.
// Anything beyond this is likely an intentional drag (like selecting text).
const CLICK_DRAG_THRESHOLD_PX = 4;

function modifiersMatch(event, pref) {
  const wanted = new Set(
    pref
      .split("+")
      .map(name => name.trim().toLowerCase())
      .map(name => (name == "accel" ? ACCEL : name))
  );
  if (!wanted.size || [...wanted].some(name => !MODIFIERS.includes(name))) {
    return false;
  }
  return MODIFIERS.every(name => event[`${name}Key`] == wanted.has(name));
}

export class ZenContentHandlerChild extends JSWindowActorChild {
  #mouseDownX = null;
  #mouseDownY = null;

  async handleEvent(event) {
    const handler = this[`on_${event.type}`];
    if (typeof handler === "function") {
      await handler.call(this, event);
    }
  }

  #actionForEvent(event) {
    return LINK_ACTIONS.find(action =>
      modifiersMatch(
        event,
        Services.prefs.getStringPref(action.modifiersPref, "")
      )
    );
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
    this.sendAsyncMessage("ZenContentHandler:RecordLinkClickData", {
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
    this.#sendClickDataToParent(node, event.target);

    this.#mouseDownX = event.clientX;
    this.#mouseDownY = event.clientY;
  }

  on_click(event) {
    // If the user drags to select text inside a link, we shouldn't open it.
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

    if (event.button !== 0 || event.defaultPrevented) {
      return;
    }
    const { node, href, principal } = this.#getTargetFromEvent(event);
    if (!node) {
      return;
    }
    const action = this.#actionForEvent(event);
    if (!action || this.#checkSecurity(href, principal)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.sendAsyncMessage(action.message, {
      url: href,
      triggeringPrincipal: principal,
    });
  }

  on_keydown(event) {
    if (event.defaultPrevented || event.key !== "Escape") {
      return;
    }
    this.sendAsyncMessage("ZenContentHandler:CloseGlance", {
      hasFocused:
        this.contentWindow.document.activeElement !==
        this.contentWindow.document.body,
    });
  }
}
