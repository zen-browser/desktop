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

  #selectorComponent = null;
  #mode = "zap";

  #dissolvePoolSize = 5;
  #dissolveEffectPool = [];
  #currentDissolveIndex = 0;

  /**
   * @param {*} document Webpage document
   * @param {*} zenBoostsChild Boost JSActor child
   * @param {string} [mode] "zap" hides what is picked, "focus" hides
   *   everything but what is picked, applied on click without the popup
   */
  constructor(document, zenBoostsChild, mode = "zap") {
    this.document = document;
    this.window = document.documentGlobal;
    this.zenBoostsChild = zenBoostsChild;
    this.#mode = mode;

    this.#selectorComponent = new lazy.SelectorComponent(
      document,
      zenBoostsChild,
      [],
      this.handleSelectComponentSelect.bind(this),
      [
        { id: "zen-zap-this" },
        { id: "zen-zap-related" },
        { id: "zen-zap-cancel" },
      ],
      { immediate: mode === "focus" }
    );
  }

  get mode() {
    return this.#mode;
  }

  /**
   * Initializes the zap mode and the element picker
   */
  async initialize() {
    if (this.#initialized) {
      console.warn(
        "[ZenZapOverlayChild]: Skipping initialize because initialized."
      );
      return;
    }

    this.#selectorComponent.initialize();

    this.#initialized = true;
    this.updateZapList();
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

  /**
   * Handles the onSelect callback from the SelectComponent
   *
   * @param {string} cssSelector The CSS selector of the selected element
   */
  handleSelectComponentSelect(cssSelector) {
    this.#handleZap(cssSelector, this.#mode);
  }

  /**
   * Notifies listeners for an update in the zap list
   */
  onZapUpdate() {
    this.updateZapList();
    this.zenBoostsChild.sendNotify("zap-list-update");
  }

  /**
   * Handles the addition of the given zap selector
   *
   * @param {string} cssPath The css selector of the zap
   * @param {string} mode The mode to add it to, "zap" or "focus"
   */
  #handleZap(cssPath, mode) {
    const useDissolve = Services.prefs.getBoolPref(
      "zen.boosts.dissolve-on-zap"
    );
    if (mode === "zap" && !this.window.gReduceMotion && useDissolve) {
      const elements = this.document.querySelectorAll(cssPath);

      let counter = 0;
      elements.forEach(async element => {
        if (counter >= this.#dissolvePoolSize) {
          return;
        }
        counter++;

        this.#getNextDissolveEffect().then(dissolve => {
          dissolve.dissolve(element, () => {
            this.zenBoostsChild.addZapSelector(cssPath);
            this.onZapUpdate();

            this.window.requestAnimationFrame(() => {
              element.style.removeProperty("opacity");
            });
          });
          element.style.setProperty("opacity", "0", "important");
        });
      });
    } else {
      this.zenBoostsChild.addZapSelector(cssPath, mode);
      this.onZapUpdate();
    }

    if (mode === "focus") {
      this.zenBoostsChild.disableZapMode();
    }
  }

  /**
   * Cancels the current zap operation
   */
  #cancelZap() {
    this.#selectorComponent.setState(lazy.SelectorComponent.STATES.SELECTING);
  }

  /**
   * Sends the zapped selectors, together with how many elements each one
   * currently matches, to the chrome bar. Focus entries are not listed.
   */
  async updateZapList() {
    const boost = await this.zenBoostsChild.getWebsiteBoost();
    if (!this.#initialized || !boost) {
      return;
    }

    const { zapSelectors = [] } = boost.boostEntry.boostData;
    const entries = zapSelectors.map(selector => {
      let count = 0;
      try {
        count = selector ? this.document.querySelectorAll(selector).length : 0;
      } catch {
        // An invalid selector matches nothing.
      }
      return { selector, count };
    });

    this.zenBoostsChild.sendZapBarUpdate(entries);
  }

  /**
   * Temporarily reveals and highlights the elements hidden by a zap while the
   * matching unzap button in the chrome bar is hovered.
   *
   * @param {string} selector The zapped selector
   */
  previewZap(selector) {
    this.zenBoostsChild.tempShowZappedElement(selector);

    // The revealed elements get their layout on the next frame, only then can
    // the highlight be measured.
    this.window.requestAnimationFrame(() => {
      if (!this.#initialized) {
        return;
      }
      const selection = this.document.querySelectorAll(selector);
      if (selection.length) {
        this.#selectorComponent.showHighlight(selection);
      }
    });

    this.#cancelZap();
  }

  /**
   * Ends the preview started by previewZap.
   */
  endZapPreview() {
    this.zenBoostsChild.tempHideZappedElement();
    this.#selectorComponent.removeHighlight();
  }

  /**
   * Removes a zap selector after its unzap button was pressed in the chrome bar
   *
   * @param {string} selector The zapped selector
   */
  unzap(selector) {
    this.endZapPreview();
    this.#cancelZap();

    this.zenBoostsChild.removeZapSelector(selector);
    this.onZapUpdate();
  }

  /**
   * Tears down the element picker and the dissolve effects
   */
  tearDown() {
    this.#initialized = false;

    this.#selectorComponent.tearDown();
    this.#selectorComponent = null;

    this.#dissolveEffectPool.forEach(dissolve => {
      dissolve.tearDown();
    });

    this.window = null;
    this.document = null;
  }

  /**
   * This function handles page events while the overlay is active
   *
   * @param {Event} event The event which will be handled by the overlay
   * @param {boolean} prevent True if the event should be prevented
   */
  handleEvent(event, prevent) {
    this.#selectorComponent?.handleEvent(event, prevent);
  }
}
