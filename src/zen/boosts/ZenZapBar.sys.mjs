/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};

ChromeUtils.defineLazyGetter(lazy, "zapLocalization", () => {
  return new Localization(["browser/zen-boosts.ftl"], true);
});

let gLastSessionToken = 0;

/**
 * Browser chrome owner of the Zap controls for a single <browser>.
 *
 * The bar lives in the browser container's findbar grid row, so showing it
 * takes height from the content viewport. Its lifetime follows the browser,
 * not the page: the ZenBoosts actor pair only attaches the current top-level
 * document to it for the length of one Zap session.
 */
export class ZenZapBar {
  static #bars = new WeakMap();

  #browser = null;
  #window = null;
  #tab = null;
  #container = null;
  #bar = null;
  #list = null;
  #doneButton = null;

  #actor = null;
  #token = 0;
  #observing = false;
  #disposed = false;

  /**
   * Returns the bar owner for a browser, creating it on first use.
   *
   * @param {MozBrowser} browser
   * @returns {ZenZapBar|null} Null when the browser is not in a tabbed window
   */
  static forBrowser(browser) {
    let bar = ZenZapBar.#bars.get(browser);
    if (bar) {
      return bar;
    }
    const container = browser?.parentNode?.parentNode;
    if (!container || !browser.documentGlobal?.gBrowser) {
      return null;
    }
    bar = new ZenZapBar(browser);
    ZenZapBar.#bars.set(browser, bar);
    return bar;
  }

  constructor(browser) {
    this.#browser = browser;
    this.#window = browser.documentGlobal;
    this.#container = browser.parentNode.parentNode;
    this.#tab = this.#window.gBrowser.getTabForBrowser(browser);

    this.#container.addEventListener("findbaropen", this);
    this.#tab?.addEventListener("TabClose", this);
    this.#window.addEventListener("unload", this);
  }

  /**
   * Starts a Zap session for the given top-level page actor. Any previous
   * session in this browser is ended first.
   *
   * @param {JSWindowActorParent} actor
   * @returns {number} Session token, or 0 if the session was rejected
   */
  start(actor) {
    if (this.#disposed) {
      return 0;
    }
    this.#endSession({ notifyPage: true });

    const findbar = this.#container.querySelector(":scope > findbar");
    if (findbar && !findbar.hidden) {
      findbar.close(true);
    }

    this.#ensureBar();
    this.#renderList([]);
    this.#bar.hidden = false;

    this.#actor = actor;
    this.#token = ++gLastSessionToken;
    Services.obs.addObserver(this, "zen-boosts-disable-zap");
    this.#observing = true;
    return this.#token;
  }

  /**
   * @param {JSWindowActorParent} actor
   * @param {number} token
   * @returns {boolean} True if the actor and token own the active session
   */
  isCurrent(actor, token) {
    return !!this.#actor && this.#actor === actor && this.#token === token;
  }

  /**
   * Replaces the numbered Unzap list.
   *
   * @param {JSWindowActorParent} actor
   * @param {number} token
   * @param {Array<{selector: string, count: number}>} zaps
   */
  update(actor, token, zaps) {
    if (!this.isCurrent(actor, token) || !Array.isArray(zaps)) {
      return;
    }
    this.#renderList(zaps);
  }

  /**
   * Ends the session because the page stopped zapping.
   *
   * @param {JSWindowActorParent} actor
   * @param {number} token
   */
  release(actor, token) {
    if (this.isCurrent(actor, token)) {
      this.#endSession({ notifyPage: false });
    }
  }

  /**
   * Called when a page actor is destroyed. Only ends the session that actor
   * owns; the bar owner itself stays with the browser.
   *
   * @param {JSWindowActorParent} actor
   */
  detach(actor) {
    if (this.#actor && this.#actor === actor) {
      this.#endSession({ notifyPage: false });
    }
  }

  /**
   * Ends the active session, if any, and hides the bar.
   */
  stop() {
    this.#endSession({ notifyPage: true });
  }

  dispose() {
    if (this.#disposed) {
      return;
    }
    this.#endSession({ notifyPage: true });
    this.#disposed = true;

    this.#container.removeEventListener("findbaropen", this);
    this.#tab?.removeEventListener("TabClose", this);
    this.#window.removeEventListener("unload", this);
    this.#bar?.remove();

    ZenZapBar.#bars.delete(this.#browser);
    this.#bar = null;
    this.#list = null;
    this.#doneButton = null;
    this.#container = null;
    this.#tab = null;
    this.#window = null;
    this.#browser = null;
  }

  #endSession({ notifyPage }) {
    const actor = this.#actor;
    this.#actor = null;
    this.#token = 0;

    if (this.#observing) {
      Services.obs.removeObserver(this, "zen-boosts-disable-zap");
      this.#observing = false;
    }
    if (this.#bar) {
      this.#bar.hidden = true;
      this.#list.replaceChildren();
    }

    if (actor && notifyPage) {
      try {
        actor.sendAsyncMessage("ZenBoost:DisableZapMode");
      } catch {
        // The page actor is already gone, so there is nothing to clean up.
      }
    }
  }

  #sendCommand(command, selector) {
    if (!this.#actor) {
      return;
    }
    try {
      this.#actor.sendAsyncMessage("ZenBoost:ZapCommand", {
        token: this.#token,
        command,
        selector,
      });
    } catch {
      this.#endSession({ notifyPage: false });
    }
  }

  #ensureBar() {
    if (this.#bar) {
      return;
    }
    const doc = this.#window.document;
    const [zapLabel] = lazy.zapLocalization.formatMessagesSync([
      { id: "zen-boost-zap" },
    ]);

    this.#bar = doc.createElement("div");
    this.#bar.className = "zen-zap-bar";
    this.#bar.setAttribute("role", "group");
    this.#bar.setAttribute("aria-label", zapLabel.value);
    this.#bar.hidden = true;

    this.#list = doc.createElement("div");
    this.#list.className = "zen-zap-bar-list";

    this.#doneButton = doc.createElement("button");
    this.#doneButton.className = "zen-zap-bar-done";
    doc.l10n.setAttributes(this.#doneButton, "zen-zap-done");
    this.#doneButton.addEventListener("click", this);

    this.#bar.append(this.#list, this.#doneButton);
    this.#browser.parentNode.after(this.#bar);
  }

  #renderList(zaps) {
    const doc = this.#window.document;
    const focusedIndex = [...this.#list.children].indexOf(doc.activeElement);

    const buttons = zaps.map(({ selector, count }, i) => {
      const index = i + 1;
      const [tooltip] = lazy.zapLocalization.formatMessagesSync([
        { id: "zen-unzap-tooltip", args: { elementCount: count } },
      ]);

      const button = doc.createElement("button");
      button.className = "zen-zap-bar-unzap";
      button.title = tooltip.value;
      button.zenZapSelector = selector;

      const number = doc.createElement("span");
      number.className = "zen-zap-bar-number";
      number.textContent = index;

      const cross = doc.createElement("span");
      cross.className = "zen-zap-bar-cross";
      cross.setAttribute("aria-hidden", "true");
      cross.textContent = "×";

      button.append(number, cross);
      for (const type of [
        "click",
        "mouseenter",
        "mouseleave",
        "focus",
        "blur",
      ]) {
        button.addEventListener(type, this);
      }
      return button;
    });

    const helper = doc.createElement("p");
    helper.className = "zen-zap-bar-helper";
    doc.l10n.setAttributes(
      helper,
      zaps.length ? "zen-remove-zap-helper" : "zen-add-zap-helper"
    );

    this.#bar.toggleAttribute("empty", !zaps.length);
    this.#list.replaceChildren(...buttons, helper);

    if (focusedIndex !== -1) {
      (
        buttons[Math.min(focusedIndex, buttons.length - 1)] ?? this.#doneButton
      ).focus();
    }
  }

  observe(subject, topic) {
    if (topic === "zen-boosts-disable-zap") {
      // ZenBoostsParent already relays this notification to the page.
      this.#endSession({ notifyPage: false });
    }
  }

  handleEvent(event) {
    switch (event.type) {
      case "findbaropen":
        this.stop();
        break;
      case "TabClose":
      case "unload":
        this.dispose();
        break;
      case "mouseenter":
      case "focus":
        this.#sendCommand("preview", event.currentTarget.zenZapSelector);
        break;
      case "mouseleave":
      case "blur":
        this.#sendCommand("clearPreview");
        break;
      case "click":
        if (event.currentTarget === this.#doneButton) {
          this.stop();
          this.#browser.focus();
        } else {
          this.#sendCommand("unzap", event.currentTarget.zenZapSelector);
        }
        break;
    }
  }
}
