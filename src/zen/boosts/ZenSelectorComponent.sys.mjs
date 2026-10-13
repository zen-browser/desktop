/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};

ChromeUtils.defineLazyGetter(lazy, "overlayLocalization", () => {
  return new Localization(["browser/zen-boosts.ftl"], true);
});

export class SelectorComponent {
  document = null;
  window = null;
  #initialized = false;
  #content = null;

  #currentState = null;
  #selectedElement = null;
  #lastOverElement = null;

  #relatedValueIndex = 0;

  static STATES = {
    SELECTING: "selecting",
    SELECTED: "selected",
  };

  #zenContentIDs = [];
  #onSelect = null;
  #localizationArray = [
    { id: "zen-select-this" },
    { id: "zen-select-related" },
    { id: "zen-select-cancel" },
  ];

  safeAreaPadding = { left: 0, right: 0, top: 0, bottom: 0 };

  /**
   * @param {Document} document Webpage document
   * @param {ZenBoostsChild} zenBoostsChild Boost JSActor child
   * @param {string[]} additionalZenContentIDs Additional IDs that will be considered as non website content
   * @param {Function<string>} onSelect Callback for when a selection was made. The parameter is the css selector
   * @param {object[]} localizationArray An array of 3 { id: 'l10n-id' } fluent IDs for localization going from the inputs left to right
   */
  constructor(
    document,
    zenBoostsChild,
    additionalZenContentIDs,
    onSelect,
    localizationArray = null
  ) {
    this.document = document;
    this.window = document.documentGlobal;
    this.zenBoostsChild = zenBoostsChild;
    this.#onSelect = onSelect;

    if (localizationArray != null) {
      this.#localizationArray = localizationArray;
    }

    const baseSelectorIDs = ["select-controls", "select-controls-container"];
    this.#zenContentIDs = [...additionalZenContentIDs, ...baseSelectorIDs];
  }

  /**
   * Initializes the zap mode and inserts anonymous content
   */
  async initialize() {
    if (this.#initialized) {
      return;
    }

    this.#content = this.document.insertAnonymousContent();
    this.#content.root.appendChild(this.fragment);
    this.#initializeElements();
    this.setState(SelectorComponent.STATES.SELECTING);

    this.#initialized = true;
  }

  /**
   * Initializes all anonymous content and events
   */
  #initializeElements() {
    this.hoverDiv = this.getElementById("hover-div");
    this.selectorComponent = this.getElementById("select-component");

    this.cancelButton = this.getElementById("select-cancel");
    this.cancelButton.addEventListener("click", this.#cancelSelect.bind(this));

    this.selectThisButton = this.getElementById("select-this");
    this.selectThisButton.addEventListener(
      "click",
      this.#handleSelect.bind(this)
    );

    this.selectRelatedSlider = this.getElementById("select-related");
    this.selectRelatedSlider.addEventListener(
      "click",
      this.#handleSelect.bind(this)
    );

    // Initialize the related elements button
    this.selectRelatedSlider.addEventListener("mousemove", e => {
      const r = e.currentTarget.getBoundingClientRect();
      const mouseX = e.clientX;

      let value = (mouseX - r.left) / r.width;
      value = Math.max(0, Math.min(1, value));

      e.target.style = `--related-elements-value: ${value * 100}%;`;

      const lastIndex = this.#relatedValueIndex;
      this.#relatedValueIndex = Math.round(value * 8);

      if (lastIndex != this.#relatedValueIndex) {
        this.updateHighlight();
        this.#updatePathTextField();
      }
    });

    this.selectRelatedSlider.addEventListener("mouseout", e => {
      e.currentTarget.style.removeProperty("--related-elements-value");

      this.#relatedValueIndex = 0;
      this.updateHighlight();
      this.#updatePathTextField();
    });
  }

  /**
   * Sets the state of the zap mode
   *
   * @param {STATES} newState New state
   * @param {*} data Optional additional data
   */
  setState(newState, data = null) {
    this.#currentState = newState;

    switch (newState) {
      case SelectorComponent.STATES.SELECTED:
        this.#selectedElement = data;
        this.#relatedValueIndex = 0; // Reset index

        this.#hideHoverDiv();
        this.#showSelectorComponent();
        this.updateHighlight();
        this.#updatePathTextField();
        break;
      case SelectorComponent.STATES.SELECTING:
        this.#selectedElement = null;
        this.#showHoverDiv();
        this.#hideSelectorComponent();
        this.removeHighlight();
        break;
    }
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
    let [thisElement, relatedElements, cancelAction] =
      lazy.overlayLocalization.formatMessagesSync(this.#localizationArray);

    return `
    <template>
      <link rel="stylesheet" href="chrome://browser/content/zen-styles/content/zen-selector.css" />
      <div id="select-component">
        <div id="select-controls">
          <input type="button" id="select-this" value="${thisElement.value}"/>
          <input type="button" id="select-related" value="${relatedElements.value}"/>
          <input type="button" id="select-cancel" value="${cancelAction.value}"/>
        </div>
        <div id="selector-preview">
          <p id="selector-element-preview-text"></p>
        </div>
      </div>
      <div id="hover-div"></div>
      <div id="highlight-container"></div>
      <div id="highlight-shadow" style="display:none;"></div>
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
   * Handles the addition of the current zap selector
   */
  #handleSelect() {
    const cssPath = this.getSelectionPath(
      this.document,
      this.#relatedValueIndex,
      this.#selectedElement
    );

    this.removeHighlight();
    this.#resetHoverDiv();

    // The highlight should be gone before the onSelect is called
    this.window.requestAnimationFrame(() => {
      this.setState(SelectorComponent.STATES.SELECTING);
      if (cssPath) {
        this.#onSelect(cssPath);
      }
    });
  }

  /**
   * Cancles the current selection operation
   */
  #cancelSelect() {
    this.setState(SelectorComponent.STATES.SELECTING);
  }

  /**
   * Rebuilds the selection highlight
   */
  updateHighlight() {
    this.removeHighlight();
    this.showHighlight(this.getSelection());
  }

  /**
   * Highlights a selection of elements on the website
   *
   * @param {List} selection A list of the web elements that should be highlighted
   */
  showHighlight(selection) {
    const highlightContainerDiv = this.getElementById("highlight-container");
    highlightContainerDiv.style.display = "initial";

    let counter = 0;
    for (const element of selection) {
      if (counter >= 100) {
        break;
      } // Avoid too many instanced objects
      counter++;

      const padding = 5;
      const elementMeasurement = element?.getBoundingClientRect() ?? undefined;
      if (elementMeasurement == undefined) {
        continue;
      }

      const highlightDiv = this.document.createElement("div");
      highlightDiv.classList.add("highlight");

      Object.assign(highlightDiv.style, {
        left: `${elementMeasurement.left - padding}px`,
        top: `${elementMeasurement.top - padding}px`,
        width: `${elementMeasurement.width + padding * 2}px`,
        height: `${elementMeasurement.height + padding * 2}px`,
      });

      highlightContainerDiv.appendChild(highlightDiv);
    }

    this.getElementById("highlight-shadow").style.display = "initial";
  }

  /**
   * Clears the highlight
   */
  removeHighlight() {
    const highlightContainerDiv = this.getElementById("highlight-container");
    highlightContainerDiv.style.display = "none";

    // Clear all children elements
    highlightContainerDiv.innerHTML = "";
    this.getElementById("highlight-shadow").style.display = "none";
  }

  /**
   * Updates the path display text on the selector component
   * based on the current selection
   */
  #updatePathTextField() {
    const maxPathLength = 64;
    const selection = this.getSelection();
    const selectionPath = this.getSelectionPath(
      this.document,
      this.#relatedValueIndex,
      this.#selectedElement
    );

    if (!selectionPath) {
      return;
    }

    const pathText = `<b>[${selection.length}]</b> ${selectionPath.substring(0, Math.min(maxPathLength, selectionPath.length))}`;
    this.getElementById("selector-element-preview-text").setHTML(pathText);
  }

  /**
   * Removes all event listeners and removes the overlay from the Anonymous Content
   */
  tearDown() {
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
   * Hides the hover selection box
   */
  #hideHoverDiv() {
    this.hoverDiv.style.display = "none";
  }

  /**
   * Shows the hover selection box
   */
  #showHoverDiv() {
    this.hoverDiv.style.display = "initial";
  }

  /**
   * Resets the hover selection box bounds
   */
  #resetHoverDiv() {
    Object.assign(this.getElementById("hover-div").style, {
      top: `0px`,
      left: `0px`,
      width: `0px`,
      height: `0px`,
    });
  }

  /**
   * Hides the selector component
   */
  #hideSelectorComponent() {
    this.selectorComponent.style.visibility = "hidden";
    this.selectorComponent.setAttribute("is-appearing", "false");
  }

  /**
   * Shows the selector component
   */
  #showSelectorComponent() {
    this.selectorComponent.style.visibility = "visible";
    this.#setSelectorComponentPosition();
  }

  /**
   * Sets the aligned and clamped position for the zap component on the document
   * relative to #selectedElement
   */
  #setSelectorComponentPosition() {
    const bounds = this.#selectedElement.getBoundingClientRect();
    const distance = 8;

    const rect = this.selectorComponent.getBoundingClientRect();
    const zapComponentWidth = rect.width;
    const zapComponentHeight = rect.height;

    const windowWidth = this.window.innerWidth;
    const windowHeight = this.window.innerHeight;
    const windowPadding = 10;

    this.selectorComponent.setAttribute("is-appearing", "false");

    // This clamps the position so the zap component never goes out of the client bounds and adds a small padding
    const top = this.clamp(
      bounds.top + bounds.height + distance,
      windowPadding + this.safeAreaPadding.top,
      windowHeight -
        zapComponentHeight -
        windowPadding -
        this.safeAreaPadding.bottom
    );
    const left = this.clamp(
      bounds.left + bounds.width / 2 - zapComponentWidth / 2,
      windowPadding + this.safeAreaPadding.left,
      windowWidth -
        zapComponentWidth -
        windowPadding -
        this.safeAreaPadding.right
    );

    Object.assign(this.selectorComponent.style, {
      top: `${top}px`,
      left: `${left}px`,
    });

    // Adjust transform origin for animation
    const targetCenterX = bounds.left + bounds.width / 2;
    const targetBottomY = bounds.top + bounds.height;
    let originX = this.clamp(targetCenterX - left, 0, zapComponentWidth);
    let originY = this.clamp(targetBottomY - top, 0, zapComponentHeight);

    this.selectorComponent.style.transformOrigin = `${originX}px ${originY}px`;

    this.window.requestAnimationFrame(() => {
      this.selectorComponent.setAttribute("is-appearing", "true");
    });
  }

  /**
   * This function handles page events while the overlay is active
   *
   * @param {Event} event The event which will be handled by the overlay
   * @param {boolean} prevent True if the event should be prevented
   */
  handleEvent(event, prevent) {
    let isZenContent = false;
    if (event?.originalTarget?.closest) {
      const closestID = event.originalTarget.closest("div")?.id ?? "";
      isZenContent = this.#zenContentIDs.includes(closestID);
    }

    switch (event.type) {
      case "click":
        this.#handleClick(event, isZenContent);
        break;
      case "mousemove":
        this.#handleMouseMove(event, isZenContent);
        break;
      case "scroll":
        this.#handlePageChange(event);
        return;
      case "resize":
        this.#handlePageChange(event);
        return;
    }

    // Let the interactable ids pass through
    if (isZenContent) {
      return;
    }

    if (prevent) {
      // From ScreenshotsComponentChild.sys.mjs:103
      // Preventing a pointerdown event throws an error in debug builds.
      // See https://searchfox.org/mozilla-central/rev/b41bb321fe4bd7d03926083698ac498ebec0accf/widget/WidgetEventImpl.cpp#566-572
      // Don't prevent the default context menu.
      if (!["contextmenu", "pointerdown"].includes(event.type)) {
        event.preventDefault();
      }
      event.stopImmediatePropagation();
    }
  }

  /**
   * Called after a page change to update the highlight and selector component position
   */
  #handlePageChange() {
    if (this.#currentState !== SelectorComponent.STATES.SELECTED) {
      return;
    }

    this.updateHighlight();
    this.#setSelectorComponentPosition();
  }

  /**
   * Handles the mouse move event
   *
   * @param {Event} event Mouse move event params
   * @param {boolean} isZenContent Flag if the target element is a zen related element
   */
  #handleMouseMove(event, isZenContent) {
    if (this.#lastOverElement === event.target) {
      return;
    }
    if (!isZenContent) {
      this.#lastOverElement = event.target;
      if (this.#currentState === SelectorComponent.STATES.SELECTING) {
        this.#showHoverDiv();
      }
    } else {
      this.#hideHoverDiv();
    }

    if (
      this.#currentState !== SelectorComponent.STATES.SELECTING ||
      !event.target
    ) {
      return;
    }

    const bounds = event.target.getBoundingClientRect();
    const padding = 5;

    Object.assign(this.getElementById("hover-div").style, {
      top: `${bounds.top - padding}px`,
      left: `${bounds.left - padding}px`,
      width: `${bounds.width + padding * 2}px`,
      height: `${bounds.height + padding * 2}px`,
    });
  }

  /**
   * Handles the mouse click event
   *
   * @param {Event} event Mouse move event params
   * @param {boolean} isZenContent Flag if the target element is a zen related element
   */
  #handleClick(event, isZenContent) {
    // Safeguards for protecting anonymous content from being zapped
    if (
      event.target === this.document.documentElement ||
      event.target === this.document.body ||
      !this.document.documentElement.contains(event.target)
    ) {
      return;
    }

    if (
      this.#currentState === SelectorComponent.STATES.SELECTING &&
      !isZenContent
    ) {
      this.setState(SelectorComponent.STATES.SELECTED, event.target);
    }
  }

  /**
   * @param {number} x Value
   * @param {number} min Minimum limit
   * @param {number} max Maximum limit
   * @returns {number} A value which always lies between min and max
   */
  clamp(x, min, max) {
    return Math.min(Math.max(x, min), max);
  }

  /**
   * When selecting an area to zap there can be a set of zapped elements
   * since related elements can be included.
   * This method returns all targeted elements for the zapping process.
   *
   * @returns {Element[]} An array of selected elements
   */
  getSelection() {
    const selector = this.getSelectionPath(
      this.document,
      this.#relatedValueIndex,
      this.#selectedElement
    );
    if (!selector) {
      return [];
    }

    return this.document.querySelectorAll(selector);
  }

  /**
   * Used for retreiving the css path from the selected element and taking
   * the related objects into account
   *
   * @param {Element} document
   * @param {Element} relatedValueIndex
   * @param {Element} selectedElement
   */
  getSelectionPath(document, relatedValueIndex, selectedElement) {
    let path = [];

    const cssescape = str => CSS.escape(str);

    // Body and Html nodes are not considered valid here
    const isValidNode = element => {
      if (!element) {
        return false;
      } else if (element.tagName.toLowerCase() === "body") {
        return false;
      } else if (element.tagName.toLowerCase() === "html") {
        return false;
      }
      return true;
    };

    const nthChild = element => {
      if (!element) {
        return "";
      }
      if (!element.parentNode) {
        return "";
      }
      const parent = element.parentNode;
      const index = Array.prototype.indexOf.call(parent.children, element) + 1;

      if (index === 1) {
        return ":first-child";
      }
      if (index === parent.children.length) {
        return ":last-child";
      }
      return `:nth-child(${index})`;
    };

    const getIdentification = (element, specifity = 0) => {
      if (!element) {
        return "";
      }
      const id = specifity < 2 && element.id ? `#${cssescape(element.id)}` : "";
      const cls =
        specifity < 1 && element.classList.length
          ? "." + [...element.classList].map(c => cssescape(c)).join(".")
          : "";
      const tag = element.tagName ? element.tagName.toLowerCase() : "";
      return `${tag}${id}${cls}`;
    };

    const traverse = (element, specifity = 0, pathArray) => {
      let currentElement = element;
      if (!isValidNode(currentElement)) {
        return;
      }

      pathArray.push(nthChild(currentElement));
      pathArray.push(getIdentification(currentElement, specifity));

      if (currentElement && currentElement.parentNode) {
        pathArray.push(" > ");
        pathArray.push(getIdentification(currentElement.parentNode, 0));
        const tempBuild = build(pathArray);

        while (
          tempBuild &&
          document.querySelectorAll(tempBuild).length > 1 &&
          isValidNode(currentElement.parentNode)
        ) {
          currentElement = currentElement.parentNode;
          pathArray.push(" > ");
          pathArray.push(nthChild(currentElement.parentNode));
          pathArray.push(getIdentification(currentElement.parentNode, 0));
        }
      }
    };

    const build = pathArray => pathArray.toReversed().join("");

    const findBestExactSelector = (element, doc) => {
      let buildMap = new Map();

      let pathExactElement = [];
      traverse(element, 0, pathExactElement);

      const pathExactElementBuilt = build(pathExactElement);
      const pathExactElementLength = (
        pathExactElementBuilt ? doc.querySelectorAll(pathExactElementBuilt) : []
      ).length;

      buildMap.set(pathExactElementLength, pathExactElementBuilt);

      let pathTypeElement = [];
      pathTypeElement.push(getIdentification(element, 2));
      if (isValidNode(element.parentNode)) {
        pathTypeElement.push(" > ");
        traverse(element.parentNode, 0, pathTypeElement);
      }

      const pathTypeElementBuilt = build(pathTypeElement);
      const pathTypeElementLength = (
        pathTypeElementBuilt ? doc.querySelectorAll(pathTypeElementBuilt) : []
      ).length;

      if (!buildMap.has(pathTypeElementLength)) {
        buildMap.set(pathTypeElementLength, pathTypeElementBuilt);
      }

      let parentExactElement = [];
      if (isValidNode(element.parentNode)) {
        traverse(element.parentNode, 0, parentExactElement);
      }

      const pathParentElementBuilt = build(parentExactElement);
      const pathParentElementLength = (
        pathParentElementBuilt
          ? doc.querySelectorAll(pathParentElementBuilt)
          : []
      ).length;

      if (!buildMap.has(pathParentElementLength)) {
        buildMap.set(pathParentElementLength, pathParentElementBuilt);
      }

      let smallestLength = Number.MAX_VALUE;
      let smallestLengthPath = null;
      buildMap.forEach((buildPath, length) => {
        if (length < smallestLength) {
          smallestLength = length;
          smallestLengthPath = buildPath;
        }
      });

      return smallestLengthPath;
    };

    if (!isValidNode(selectedElement)) {
      return null;
    }
    switch (relatedValueIndex) {
      // Sometimes getting the exact element we want is not guaranteed by
      // one specific path builder. It is best to build multiple possible paths
      // and decide which one is best.
      default:
      case 0:
        return findBestExactSelector(selectedElement, document);
      // Getting the exact parent element of selected element
      case 1:
        if (!isValidNode(selectedElement.parentNode)) {
          return null;
        }
        traverse(selectedElement.parentNode, 0, path);
        break;
      // Getting the type of selected element with same exact parent
      case 2:
        path.push(getIdentification(selectedElement, 2));
        if (isValidNode(selectedElement.parentNode)) {
          path.push(" > ");
          path.push(getIdentification(selectedElement.parentNode, 0));
        }
        break;
      // Getting the same type of selected element with same parent type
      case 3:
        path.push(getIdentification(selectedElement, 2));
        if (isValidNode(selectedElement.parentNode)) {
          path.push(" > ");
          path.push(getIdentification(selectedElement.parentNode, 2));
        }
        break;
      // Getting the same type of selected element
      case 4:
        path.push(getIdentification(selectedElement, 2));
        break;
      // Getting the same type of the parent
      case 5:
        if (!isValidNode(selectedElement.parentNode)) {
          return null;
        }
        path.push(getIdentification(selectedElement.parentNode, 2));
        break;
      // Get any element with same parent
      case 6:
        if (!isValidNode(selectedElement.parentNode)) {
          return null;
        }

        path.push("*");
        path.push(" > ");
        traverse(selectedElement.parentNode, 0, path);
        break;
      // Get elements with similar classes
      case 7:
        path.push(getIdentification(selectedElement, 1));
        break;
    }

    return build(path);
  }
}
