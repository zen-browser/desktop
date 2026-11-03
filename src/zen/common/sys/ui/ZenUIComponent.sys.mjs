// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * Base class for per-window UI components in Zen.
 *
 * A component is created once for every browser window. It owns its event
 * listeners, which are removed automatically when the window unloads, and
 * dispatches DOM events to `on_<eventType>` methods.
 *
 * Components are not constructed by hand during startup. Instead, register
 * them in the feature's component manifest so the browser creates them once
 * the window has finished its delayed startup:
 *
 *   category browser-window-delayed-startup resource:///modules/zen/ui/ZenProgressBar.sys.mjs ZenProgressBar.create
 */
export class ZenUIComponent {
  #window = null;
  #eventListeners = new Set();

  /**
   * Category manager entry point. Creates and initializes the component for
   * the given window.
   *
   * @param {Window} aWindow - The browser window to attach the component to.
   * @returns {ZenUIComponent} The created component.
   */
  static create(aWindow) {
    const component = new this(aWindow);
    component.init();
    return component;
  }

  constructor(aWindow) {
    this.#window = aWindow;
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

  get document() {
    return this.#window.document;
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
