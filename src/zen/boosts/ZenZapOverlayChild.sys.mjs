/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  ZapDissolve: "resource:///modules/zen/boosts/ZenZapDissolve.sys.mjs",
  SelectorComponent:
    "resource:///modules/zen/boosts/ZenSelectorComponent.sys.mjs",
});

ChromeUtils.defineLazyGetter(lazy, "overlayLocalization", () => {
  return new Localization(["browser/zen-boosts.ftl"], true);
});

export class ZapOverlay {
  document = null;
  window = null;
  #initialized = false;
  #content = null;

  #zapContentIDs = ["zap-list", "zap-controls-container"];
  #selectorComponent = null;

  #dissolvePoolSize = 5;
  #dissolveEffectPool = [];
  #currentDissolveIndex = 0;
  #onZapDoneClick = null;

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
      this.#zapContentIDs,
      this.handleSelectComponentSelect.bind(this),
      [
        { id: "zen-zap-this" },
        { id: "zen-zap-related" },
        { id: "zen-zap-cancel" },
      ]
    );

    // Remove the bottom unzap bar to the safe area
    this.#selectorComponent.safeAreaPadding.bottom = 65;
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
    this.#initializeElements();

    this.#initialized = true;
  }

  /**
   * Initializes all anonymous content and events
   */
  #initializeElements() {
    this.zapDoneButton = this.getElementById("zap-done");
    this.#onZapDoneClick = this.#disableZapMode.bind(this);
    this.zapDoneButton.addEventListener("click", this.#onZapDoneClick);

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
    // Fetch localizations
    let [done] = lazy.overlayLocalization.formatMessagesSync([
      { id: "zen-zap-done" },
    ]);

    return `
    <template>
      <link rel="stylesheet" href="chrome://browser/content/zen-styles/content/zen-zap.css" />
      <div id="zap-controls-container">
        <div id="zap-list">
        </div>
        <input type="button" id="zap-done" value="${done.value}"/>
      </div>
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
      this.zenBoostsChild.addZapSelector(cssPath);
      this.onZapUpdate();
    }
  }

  /**
   * Handles the removal of a zap selector
   *
   * @param {string} cssPath The css selector of the zap
   */
  #handleUnzap(cssPath) {
    this.zenBoostsChild.removeZapSelector(cssPath);
    this.onZapUpdate();
  }

  /**
   * Cancles the current zap operation
   */
  #cancelZap() {
    this.#selectorComponent.setState(lazy.SelectorComponent.STATES.SELECTING);
  }

  /**
   * Helper function for leaving the zap mode
   */
  #disableZapMode() {
    this.zenBoostsChild.disableZapMode();
  }

  /**
   * Rebuilds the unzap button list at the bottom of the website
   */
  async #updateZappedList() {
    const zapList = this.getElementById("zap-list");
    zapList.innerHTML = "";

    const boost = await this.zenBoostsChild.getWebsiteBoost();
    const { boostData } = boost.boostEntry;

    boostData.zapSelectors.forEach(selector => {
      const unzapButton = zapList.ownerDocument.createElement("input");
      unzapButton.type = "button";
      unzapButton.id = "zen-zap-unzap";

      const index = boostData.zapSelectors.indexOf(selector) + 1;
      const zappedElementsCount =
        selector == "" ? 0 : this.document.querySelectorAll(selector).length;

      const [tooltip] = lazy.overlayLocalization.formatMessagesSync([
        {
          id: "zen-unzap-tooltip",
          args: { elementCount: zappedElementsCount },
        },
      ]);

      unzapButton.value = index;
      unzapButton.title = tooltip.value;

      unzapButton.setAttribute("index", index);
      unzapButton.setAttribute("selector", selector);
      zapList.appendChild(unzapButton);
    });

    // Fetch localizations
    let [addZapHelper, removeZapHelper] =
      lazy.overlayLocalization.formatMessagesSync([
        { id: "zen-add-zap-helper" },
        { id: "zen-remove-zap-helper" },
      ]);

    if (!boostData.zapSelectors.length) {
      const addZapHelperText = zapList.ownerDocument.createElement("p");
      addZapHelperText.setHTML(addZapHelper.value);
      addZapHelperText.classList.add("pcenter");
      zapList.appendChild(addZapHelperText);
    } else {
      const removeZapHelperText = zapList.ownerDocument.createElement("p");
      removeZapHelperText.setHTML(removeZapHelper.value);
      zapList.appendChild(removeZapHelperText);
    }
  }

  /**
   * Handles the mouse enter event for the unzap buttons
   *
   * @param {Event} event
   */
  #unzapButtonHover(event) {
    const button = event.originalTarget;
    const selector = button.getAttribute("selector");
    this.zenBoostsChild.tempShowZappedElement(selector);

    button.value = "×";

    // This has to run with later, as the elements we are trying to highlight do not exist yet.
    // The css has to load first and calculate the bounding boxes for the elements before we can highlight.
    this.window.requestAnimationFrame(() => {
      const selection = this.document.querySelectorAll(selector);
      if (selection.length) {
        this.#selectorComponent.showHighlight(selection);
      }
    });

    // Cancle an ongoing select action
    this.#cancelZap();
  }

  /**
   * Handles the mouse exit event for the unzap buttons
   *
   * @param {Event} event
   */
  #unzapButtonUnhover(event) {
    const button = event.originalTarget;
    button.value = button.getAttribute("index");

    this.zenBoostsChild.tempHideZappedElement();
    this.#selectorComponent.removeHighlight();
  }

  /**
   * Handles button clicks from the unzap list
   *
   * @param {Event} event
   */
  #unzapButtonClick(event) {
    const button = event.originalTarget;
    const selector = button.getAttribute("selector");

    this.zenBoostsChild.tempHideZappedElement();
    this.#selectorComponent.removeHighlight();
    this.#cancelZap();

    // In order to avoid the clicked element being null when the
    // SelectorComponent receives it, push the list re-creation to the next frame
    this.window.requestAnimationFrame(() => {
      this.#handleUnzap(selector);
    });
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

    if (this.zapDoneButton && this.#onZapDoneClick) {
      this.zapDoneButton.removeEventListener("click", this.#onZapDoneClick);
    }
    this.#onZapDoneClick = null;
    this.zapDoneButton = null;

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
    switch (event.type) {
      case "click":
        this.#handleClick(event);
        break;
      case "mouseover":
        this.#handleHoverDelegation(event);
        break;
      case "mouseout":
        this.#handleUnhoverDelegation(event);
    }

    this.#selectorComponent.handleEvent(event, prevent);
  }

  /**
   * Handles the mouse click event
   *
   * @param {Event} event Mouse move event params
   */
  #handleClick(event) {
    if (event.originalTarget.id == "zen-zap-unzap") {
      this.#unzapButtonClick(event);
    }
  }

  /**
   * Handles the mouse enter event
   *
   * @param {Event} event Mouse enter event params
   */
  #handleHoverDelegation(event) {
    if (event.originalTarget.id == "zen-zap-unzap") {
      this.#unzapButtonHover(event);
    }
  }

  /**
   * Handles the mouse leave event
   *
   * @param {Event} event Mouse leave event params
   */
  #handleUnhoverDelegation(event) {
    if (event.originalTarget.id == "zen-zap-unzap") {
      this.#unzapButtonUnhover(event);
    }
  }
}
