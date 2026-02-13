/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  ZapDissolve: "resource:///modules/ZenZapDissolve.sys.mjs",
  SelectorComponent: "resource:///modules/ZenSelectorComponent.sys.mjs",
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

  /**
   * @param {*} document Webpage document
   * @param {*} zenBoostsChild Boost JSActor child
   */
  constructor(document, zenBoostsChild) {
    this.document = document;
    this.window = document.ownerGlobal;
    this.zenBoostsChild = zenBoostsChild;

    this.#selectorComponent = new lazy.SelectorComponent(
      document,
      zenBoostsChild,
      this.#zapContentIDs,
      this.handleSelectComponentSelect.bind(this),
      [{ id: "zen-zap-this" }, { id: "zen-zap-related" }, { id: "zen-zap-cancel" }]
    );

    // Remove the bottom unzap bar to the safe area
    this.#selectorComponent.safeAreaPadding.bottom = 65;
  }

  /**
   * Initializes the zap mode and inserts anonymous content
   */
  async initialize() {
    if (this.#initialized) return;

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
    this.zapDoneButton.addEventListener("click", this.#disableZapMode.bind(this));

    this.#updateZappedList();
  }

  get content() {
    if (!this.#content || Cu.isDeadWrapper(this.#content)) {
      return null;
    }
    return this.#content;
  }

  /**
   * Helper for getting an anonymous element by id
   */
  getElementById(id) {
    return this.content.root.getElementById(id);
  }

  get markup() {
    // Fetch localizations
    let [done] = lazy.overlayLocalization.formatMessagesSync([{ id: "zen-zap-done" }]);

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
      this.template = this.document.importNode(doc.querySelector("template"), true);
    }
    let fragment = this.template.content.cloneNode(true);
    return fragment;
  }

  /**
   * Handles the onSelect callback from the SelectComponent
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
   */
  #handleZap(cssPath) {
    const useDissolve = Services.prefs.getBoolPref("zen.boosts.dissolve-on-zap");
    if (!this.window.gReduceMotion && useDissolve) {
      const elements = this.document.querySelectorAll(cssPath);

      let counter = 0;
      elements.forEach(async (element) => {
        // Do not allow more than 5 instances of this effect as it is expensive
        if (counter >= 6) return;
        counter++;

        const dissolveEffect = new lazy.ZapDissolve(this.document);
        await dissolveEffect.initialize();
        dissolveEffect.dissolve(element);
      });
    }

    this.zenBoostsChild.addZapSelector(cssPath);
    this.onZapUpdate();
  }

  /**
   * Handles the removal of a zap selector
   * @param {String} cssPath The css selector of the zap
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
   * @param {Event} event
   */
  async #updateZappedList() {
    const zapList = this.getElementById("zap-list");
    zapList.innerHTML = "";

    const boostData = await this.zenBoostsChild.getWebsiteBoost();
    boostData.zapSelectors.forEach((selector) => {
      const unzapButton = zapList.ownerDocument.createElement("input");
      unzapButton.type = "button";
      unzapButton.id = "zen-zap-unzap";

      const index = boostData.zapSelectors.indexOf(selector) + 1;
      const zappedElementsCount = selector == '' ? 0 : this.document.querySelectorAll(selector).length;

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
        { id: "zen-remove-zap-helper" }
      ]);

    if (boostData.zapSelectors.length == 0)
      zapList.innerHTML += `<p class="pcenter">${addZapHelper.value}</p>`;
    else zapList.innerHTML += `<p>${removeZapHelper.value}</p>`;
  }

  /**
   * Handles the mouse enter event for the unzap buttons
   * @param {Event} event
   */
  #unzapButtonHover(event) {
    const button = event.originalTarget;
    const selector = button.getAttribute("selector");
    this.zenBoostsChild.tempShowZappedElement(selector);

    button.value = '×';

    // This has to run with later, as the elements we are trying to highlight do not exist yet.
    // The css has to load first and calculate the bounding boxes for the elements before we can highlight.
    this.window.requestAnimationFrame((t) => {
      const selection = this.document.querySelectorAll(selector);
      if (selection.length != 0) this.#selectorComponent.showHighlight(selection);
    });

    // Cancle an ongoing select action
    this.#cancelZap();
  }

  /**
   * Handles the mouse exit event for the unzap buttons
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
   * @param {Event} event
   */
  #unzapButtonClick(event) {
    const button = event.originalTarget;
    const selector = button.getAttribute("selector");

    this.zenBoostsChild.tempHideZappedElement();
    this.#selectorComponent.removeHighlight();
    this.#selectorComponent.setState(lazy.SelectorComponent.STATES.SELECTING);

    this.#handleUnzap(selector);
  }

  /**
   * Removes all event listeners and removes the overlay from the Anonymous Content
   */
  tearDown() {
    this.#selectorComponent.tearDown();

    if (this.#content) {
      try {
        this.document.removeAnonymousContent(this.#content);
      } catch {
        /* This might fail but that's not an issue */
      }
    }

    this.#initialized = false;
  }

  /**
   * This function handles page events while the overlay is active
   * @param {Event} event The event which will be handled by the overlay
   * @param {Boolean} prevent True if the event should be prevented
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
   * @param {Event} event Mouse move event params
   */
  #handleClick(event) {
    if (event.originalTarget.id == "zen-zap-unzap") this.#unzapButtonClick(event);
  }

  /**
   * Handles the mouse enter event
   * @param {Event} event Mouse enter event params
   */
  #handleHoverDelegation(event) {
    if (event.originalTarget.id == "zen-zap-unzap") this.#unzapButtonHover(event);
  }

  /**
   * Handles the mouse leave event
   * @param {Event} event Mouse leave event params
   */
  #handleUnhoverDelegation(event) {
    if (event.originalTarget.id == "zen-zap-unzap") this.#unzapButtonUnhover(event);
  }
}
