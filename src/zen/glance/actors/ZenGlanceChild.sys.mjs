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

export class ZenGlanceChild extends JSWindowActorChild {
  #activationMethod;

  constructor() {
    super();
  }

  async handleEvent(event) {
    const handler = this[`on_${event.type}`];
    if (typeof handler === "function") {
      await handler.call(this, event);
    }
  }

  async #initActivationMethod() {
    this.#activationMethod = await this.sendQuery(
      "ZenGlance:GetActivationMethod"
    );
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
    const originalTargetRect = originalTarget.getBoundingClientRect();
    if (
      originalTargetRect.width * originalTargetRect.height >
      rect.width * rect.height
    ) {
      rect = originalTargetRect;
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
    const { node } = this.#getTargetFromEvent(event);
    // We record the link data anyway, even if the glance may be invoked
    // or not. We have some cases where glance would open, for example,
    // when clicking on a link with a different domain where glance would open.
    // The problem is that at that stage we don't know the rect or even what
    // element has been clicked, so we send the data here.
    this.#sendClickDataToParent(node, event.target);
  }

  on_click(event) {
    const { node, href, principal } = this.#getTargetFromEvent(event);
    if (
      event.button !== 0 ||
      !node ||
      event.defaultPrevented ||
      this.#ensureOnlyKeyModifiers(event)
    ) {
      return;
    }
    const activationMethod = this.#activationMethod;
    if (activationMethod === "ctrl" && !event.ctrlKey) {
      return;
    } else if (activationMethod === "alt" && !event.altKey) {
      return;
    } else if (activationMethod === "shift" && !event.shiftKey) {
      return;
    } else if (activationMethod === "meta" && !event.metaKey) {
      return;
    }
    if (this.#checkSecurity(href, principal)) {
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

  async on_DOMContentLoaded() {
    await this.#initActivationMethod();
  }
}
