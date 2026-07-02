// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * Base class for UI components in Zen.
 * UI components are responsible for managing their own event listeners
 * and providing a consistent interface for handling events.
 */
export class ZenUIComponent {
  #window = null;
  #eventListeners = new Set();

  constructor(aWindow) {
    this.#window = aWindow;
    this.init();
    this.#window.addEventListener("unload", () => {
      if (typeof this.uninit === "function") {
        this.uninit();
      }
      for (const { type, options } of this.#eventListeners) {
        this.#window.removeEventListener(type, this, options);
      }
      this.#eventListeners.clear();
    });
  }

  get window() {
    return this.#window;
  }

  /**
   * Adds an event listener to the component that will automatically be removed when the window unloads.
   *
   * @param {string} type - The event type to listen for.
   * @param {object} options - The event listener function or an object containing options.
   * @returns {void}
   */
  addEventListener(type, options = {}) {
    this.#window.addEventListener(type, this, options);
    if (options?.once) {
      return;
    }
    this.#eventListeners.add({ type, options });
  }

  listenBrowserTabsProgress() {
    this.#window.gBrowser.addTabsProgressListener(this);
  }

  listenBrowserProgress() {
    this.#window.gBrowser.addProgressListener(this);
  }

  handleEvent(event) {
    const handlerName = "on_" + event.type;
    if (typeof this[handlerName] === "function") {
      this[handlerName](event);
    }
  }
}
