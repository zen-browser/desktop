/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { html } from "chrome://global/content/vendor/lit.all.mjs";
import { MozLitElement } from "chrome://global/content/lit-utils.mjs";

class ZenZapBar extends MozLitElement {
  static properties = {
    entries: { type: Array },
    _tooltips: { state: true },
    _hoveredIndex: { state: true },
  };

  #framedContainer = null;

  constructor() {
    super();
    this.entries = [];
    this._tooltips = [];
    this._hoveredIndex = -1;
  }

  connectedCallback() {
    super.connectedCallback();
    this.#closeFindBar();
    this.#framedContainer = this.closest(".browserSidebarContainer");
    this.#framedContainer?.toggleAttribute("zen-zapping", true);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#framedContainer?.removeAttribute("zen-zapping");
    this.#framedContainer = null;
  }

  willUpdate(changedProperties) {
    if (changedProperties.has("entries")) {
      this.toggleAttribute("empty", !this.entries.length);
      this._hoveredIndex = -1;
      this.#updateTooltips();
    }
  }

  #closeFindBar() {
    const tab = this.browser && gBrowser.getTabForBrowser(this.browser);
    if (tab && gBrowser.isFindBarInitialized(tab)) {
      gBrowser.getCachedFindBar(tab).close();
    }
  }

  async #updateTooltips() {
    const entries = this.entries;
    const tooltips = await document.l10n.formatValues(
      entries.map(({ count }) => ({
        id: "zen-unzap-tooltip",
        args: { elementCount: count },
      }))
    );
    if (this.entries === entries) {
      this._tooltips = tooltips;
    }
  }

  #onHover(index, selector) {
    this._hoveredIndex = index;
    this.#send("ZenBoost:ZapBarHover", { selector });
  }

  #onUnhover() {
    this._hoveredIndex = -1;
    this.#send("ZenBoost:ZapBarUnhover");
  }

  /**
   * Sends a message to the zapped document. The actor may already be gone
   * when the page navigated away, in which case the bar is about to be
   * removed anyway.
   *
   * @param {string} messageName The message name
   * @param {object} [data] The message data
   */
  #send(messageName, data = null) {
    try {
      this.actor?.sendAsyncMessage(messageName, data);
    } catch {
      // The actor was destroyed; nothing to deliver to.
    }
  }

  render() {
    return html`
      <link
        rel="stylesheet"
        href="chrome://browser/content/zen-styles/zen-zap-bar.css"
      />
      <div class="zen-zap-bar-list">
        ${this.entries.map(
          ({ selector }, index) => html`
            <button
              class="zen-zap-bar-unzap"
              title=${this._tooltips[index] ?? ""}
              @mouseenter=${() => this.#onHover(index, selector)}
              @mouseleave=${() => this.#onUnhover()}
              @click=${() => this.#send("ZenBoost:ZapBarUnzap", { selector })}
            >
              ${this._hoveredIndex === index ? "×" : index + 1}
            </button>
          `
        )}
        <span
          class="zen-zap-bar-helper"
          data-l10n-id=${
            this.entries.length ? "zen-remove-zap-helper" : "zen-add-zap-helper"
          }
        ></span>
      </div>
      <button
        class="zen-zap-bar-done"
        data-l10n-id="zen-zap-done"
        @click=${() => this.#send("ZenBoost:DisableZapMode")}
      ></button>
    `;
  }
}

customElements.define("zen-zap-bar", ZenZapBar);
