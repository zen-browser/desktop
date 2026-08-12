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
  "zen.splitView.link-activation-method",
  "shift"
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
  "ctrl"
);

const ACTIVATION_METHODS = {
  ctrl: "ctrlKey",
  alt: "altKey",
  shift: "shiftKey",
  meta: "metaKey",
};

export class ZenSplitViewChild extends JSWindowActorChild {
  handleEvent(event) {
    const handler = this[`on_${event.type}`];
    if (typeof handler === "function") {
      handler.call(this, event);
    }
  }

  /**
   * The modifier that activates a split, or null when splitting on click is
   * not available. Glance keeps its own modifier: if both features are bound
   * to the same one, neither actor can tell which the user meant, so we stand
   * down rather than race Glance for the click.
   *
   * @returns {string|null} The activating modifier's event property name.
   */
  get #activationModifier() {
    const modifier = ACTIVATION_METHODS[lazy.activationMethod];
    if (!modifier) {
      return null;
    }
    if (
      lazy.glanceEnabled &&
      lazy.glanceActivationMethod === lazy.activationMethod
    ) {
      return null;
    }
    return modifier;
  }

  /**
   * Splitting is a single-modifier gesture, so a click carrying any other
   * modifier alongside it (ctrl+shift+click and friends) has to fall through
   * to the browser's own handling.
   *
   * @param {MouseEvent} event - The click event.
   * @param {string} modifier - The activating modifier's event property name.
   * @returns {boolean} True if the modifier is held and no other one is.
   */
  #onlyModifierHeld(event, modifier) {
    return (
      event[modifier] &&
      Object.values(ACTIVATION_METHODS).filter(name => event[name]).length === 1
    );
  }

  /**
   * @param {string} href - The link's URL.
   * @param {nsIPrincipal} principal - The principal of the link's document.
   * @returns {boolean} True if the link must not be opened in a split.
   */
  #isBlocked(href, principal) {
    if (
      lazy.blockJavascript &&
      Services.io.extractScheme(href) === "javascript"
    ) {
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

  on_click(event) {
    if (event.button !== 0 || event.defaultPrevented) {
      return;
    }
    const modifier = this.#activationModifier;
    if (!modifier || !this.#onlyModifierHeld(event, modifier)) {
      return;
    }
    const [href, node, principal] =
      lazy.BrowserUtils.hrefAndLinkNodeForClickEvent(event);
    if (!href || !node || this.#isBlocked(href, principal)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.sendAsyncMessage("ZenSplitView:OpenInSplit", {
      url: href,
      triggeringPrincipal: principal,
    });
  }
}
