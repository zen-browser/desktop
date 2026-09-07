// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { XPCOMUtils } from "resource://gre/modules/XPCOMUtils.sys.mjs";

import { ContentLinkHandling } from "resource:///actors/ContentLinkHandling.sys.mjs";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  E10SUtils: "resource://gre/modules/E10SUtils.sys.mjs",
  BrowserUtils: "resource://gre/modules/BrowserUtils.sys.mjs",
});

XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "blockJavascript",
  "browser.link.alternative_click.block_javascript",
  true,
);

XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "glanceEnabled",
  "zen.glance.enabled",
  true,
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
        href,
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

    const { href, node, principal } = this.#getTargetFromEvent(event);
    if (
      !event.isTrusted ||
      event.button !== 0 ||
      !href ||
      event.defaultPrevented ||
      event.composedTarget.isContentEditable ||
      event.composedTarget.ownerDocument?.designMode === "on"
    ) {
      return;
    }
    const shortcut = ContentLinkHandling.shortcut(event);
    let action = ContentLinkHandling.resolve(shortcut);
    const nativeAction = lazy.BrowserUtils.whereToOpenLink(event);
    if (action === "conflict") {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    // Keep the stock path (including foreground/background combinations) when
    // no action remaps this click. Suppress a stock shortcut explicitly moved
    // or disabled in Settings by opening its destination in the current tab.
    if (!action) {
      const movedDefault = ContentLinkHandling.assignments().some(
        (item) =>
          ["tab", "window"].includes(item.id) &&
          item.default === shortcut &&
          item.shortcut !== shortcut,
      );
      if (!movedDefault) {
        return;
      }
      action = "current";
    }
    if ((action === "tab" || action === "window") && action === nativeAction) {
      return;
    }
    if (action === "glance" && !lazy.glanceEnabled) {
      return;
    }
    if (
      Services.io.extractScheme(href) === "javascript" ||
      this.#checkSecurity(href, principal)
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (action === "glance") {
      this.#openGlance(href, principal);
    } else if (action === "split") {
      this.sendAsyncMessage("ContentLinkHandling:OpenSplitLink", { url: href });
    } else {
      const doc = event.composedTarget.ownerDocument;
      const referrer = Cc["@mozilla.org/referrer-info;1"].createInstance(
        Ci.nsIReferrerInfo,
      );
      if (node) {
        referrer.initWithElement(node);
      } else {
        referrer.initWithDocument(doc);
      }
      this.sendAsyncMessage("ContentLinkHandling:OpenLink", {
        action,
        href,
        referrerInfo: lazy.E10SUtils.serializeReferrerInfo(referrer),
        policyContainer: doc.policyContainer
          ? lazy.E10SUtils.serializePolicyContainer(doc.policyContainer)
          : null,
      });
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
