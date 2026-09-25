/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  ZapDissolve: "resource:///modules/zen/boosts/ZenZapDissolve.sys.mjs",
  SelectorComponent:
    "resource:///modules/zen/boosts/ZenSelectorComponent.sys.mjs",
});

export class ZapOverlay {
  document = null;
  window = null;
  #initialized = false;
  #content = null;

  #selectorComponent = null;

  #dissolvePoolSize = 5;
  #dissolveEffectPool = [];
  #currentDissolveIndex = 0;

  /**
   * @param {*} document Webpage document
   * @param {*} zenBoostsChild Boost JSActor child
   */
  constructor(document, zenBoostsChild) {
    this.document = document;
    this.window = document.documentGlobal;
    this.zenBoostsChild = zenBoostsChild;

    this.#selectorComponent = new lazy.SelectorComponent(
      document,
      zenBoostsChild,
      [],
      this.handleSelectComponentSelect.bind(this),
      [
        { id: "zen-zap-this" },
        { id: "zen-zap-related" },
        { id: "zen-zap-cancel" },
      ]
    );
  }

  /**
   * Initializes the zap mode and inserts anonymous content
   */
  async initialize() {
    if (this.#initialized) {
      console.warn(
        "[ZenZapOverlayChild]: Skipping initialize because initialized."
      );
      return;
    }

    this.#selectorComponent.initialize();

    this.#content = this.document.insertAnonymousContent();
    this.#content.root.appendChild(this.fragment);

    this.#initialized = true;
    this.#updateZappedList();
  }

  /**
   * Lazily loads the next available dissolve effect.
   * The returned effect might not currently be ready to trigger again.
   *
   * @returns {Promise<ZapDissolve>} Dissolve effect
   */
  async #getNextDissolveEffect() {
    // Effect does not exist yet, create and initialize
    if (this.#currentDissolveIndex >= this.#dissolveEffectPool.length) {
      const dissolveEffect = new lazy.ZapDissolve(this.document);
      await dissolveEffect.initialize();
      this.#dissolveEffectPool.push(dissolveEffect);
    }

    // Capture current index and increment for next call
    const returnIndex = this.#currentDissolveIndex;
    this.#currentDissolveIndex =
      (this.#currentDissolveIndex + 1) % this.#dissolvePoolSize;

    return this.#dissolveEffectPool[returnIndex];
  }

  get content() {
    if (!this.#content || Cu.isDeadWrapper(this.#content)) {
      return null;
    }
    return this.#content;
  }

  /**
   * Helper for getting an anonymous element by id
   *
   * @param {string} id The id of the element
   */
  getElementById(id) {
    return this.content.root.getElementById(id);
  }

  get markup() {
    return `
    <template>
      <link rel="stylesheet" href="chrome://browser/content/zen-styles/content/zen-zap.css" />
      <div id="zap-border"></div>
    </template>
    `;
  }

  get fragment() {
    if (!this.template) {
      let parser = new DOMParser();
      let doc = parser.parseFromString(this.markup, "text/html");
      this.template = this.document.importNode(
        doc.querySelector("template"),
        true
      );
    }
    let fragment = this.template.content.cloneNode(true);
    return fragment;
  }

  /**
   * Handles the onSelect callback from the SelectComponent
   *
   * @param {string} cssSelector The CSS selector of the selected element
   */
  handleSelectComponentSelect(cssSelector) {
    this.#handleZap(cssSelector);
  }

  /**
   * Notifies listeners for an update in the zap list
   */
  onZapUpdate() {
    if (!this.#initialized) {
      return;
    }
    this.#updateZappedList();
    this.zenBoostsChild.sendNotify("zap-list-update");
  }

  /**
   * Handles the addition of the given zap selector
   *
   * @param {string} cssPath The css selector of the zap
   */
  #handleZap(cssPath) {
    const useDissolve = Services.prefs.getBoolPref(
      "zen.boosts.dissolve-on-zap"
    );
    if (!this.window.gReduceMotion && useDissolve) {
      const elements = this.document.querySelectorAll(cssPath);

      let counter = 0;
      elements.forEach(async element => {
        if (counter >= this.#dissolvePoolSize) {
          return;
        }
        counter++;

        this.#getNextDissolveEffect().then(dissolve => {
          dissolve.dissolve(element, async () => {
            element.ownerGlobal.requestAnimationFrame(() => {
              element.style.removeProperty("opacity");
            });

            await this.zenBoostsChild.addZapSelector(cssPath);
            this.onZapUpdate();
          });
          element.style.setProperty("opacity", "0", "important");
        });
      });
    } else {
      this.zenBoostsChild.addZapSelector(cssPath).then(() => {
        this.onZapUpdate();
      });
    }
  }

  /**
   * Handles the removal of a zap selector
   *
   * @param {string} cssPath The css selector of the zap
   */
  async #handleUnzap(cssPath) {
    await this.zenBoostsChild.removeZapSelector(cssPath);
    this.onZapUpdate();
  }

  /**
   * Cancles the current zap operation
   */
  #cancelZap() {
    this.#selectorComponent.setState(lazy.SelectorComponent.STATES.SELECTING);
  }

  /**
   * Sends the zapped selectors and their element counts to the chrome Zap bar
   */
  async #updateZappedList() {
    const boost = await this.zenBoostsChild.getWebsiteBoost();
    if (!this.#initialized) {
      return;
    }
    const zapSelectors = boost?.boostEntry.boostData.zapSelectors ?? [];

    this.zenBoostsChild.updateZapBar(
      zapSelectors.map(selector => ({
        selector,
        count: selector ? this.document.querySelectorAll(selector).length : 0,
      }))
    );
  }

  /**
   * Handles a command from an Unzap button in the chrome Zap bar
   *
   * @param {string} command One of "preview", "clearPreview" or "unzap"
   * @param {string} selector The zapped selector the button represents
   */
  handleBarCommand(command, selector) {
    switch (command) {
      case "preview":
        if (typeof selector !== "string") {
          return;
        }
        this.zenBoostsChild.tempHideZappedElement();
        this.zenBoostsChild.tempShowZappedElement(selector);
        this.#cancelZap();

        // The unhide rule has to apply before the elements have bounding boxes to highlight.
        this.window.requestAnimationFrame(() => {
          if (!this.#initialized) {
            return;
          }
          const selection = this.document.querySelectorAll(selector);
          if (selection.length) {
            this.#selectorComponent.showHighlight(selection);
          }
        });
        break;
      case "clearPreview":
        this.zenBoostsChild.tempHideZappedElement();
        this.#selectorComponent.removeHighlight();
        break;
      case "unzap":
        if (typeof selector !== "string") {
          return;
        }
        this.zenBoostsChild.tempHideZappedElement();
        this.#selectorComponent.removeHighlight();
        this.#cancelZap();
        this.#handleUnzap(selector);
        break;
    }
  }

  /**
   * Removes all event listeners and removes the overlay from the Anonymous Content
   */
  tearDown() {
    this.#selectorComponent.tearDown();
    this.#selectorComponent = null;

    this.#dissolveEffectPool.forEach(dissolve => {
      dissolve.tearDown();
    });

    if (this.#content) {
      try {
        this.document.removeAnonymousContent(this.#content);
      } catch {
        /* This might fail but that's not an issue */
      }
    }

    this.window = null;
    this.document = null;
    this.#initialized = false;
  }

  /**
   * This function handles page events while the overlay is active
   *
   * @param {Event} event The event which will be handled by the overlay
   * @param {boolean} prevent True if the event should be prevented
   */
  handleEvent(event, prevent) {
    this.#selectorComponent.handleEvent(event, prevent);
  }
}
