/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export class ZapOverlay {
  document = null;
  window = null;
  #initialized = false;
  #content = null;

  domain = null;

  #currentState = null;
  #selectedElement = null;
  #lastOverElement = null;

  #relatedValueIndex = 0;

  static STATES = {
    SELECTING: 'selecting',
    SELECTED: 'selected',
  };

  /**
   * @param {*} document Webpage document
   * @param {*} zenBoostsChild Boost JSActor child
   */
  constructor(document, zenBoostsChild) {
    this.document = document;
    this.window = document.ownerGlobal;
    this.zenBoostsChild = zenBoostsChild;
  }

  /**
   * Initializes the zap mode and inserts anonymous content
   */
  async initialize() {
    if (this.#initialized) return;

    this.#content = this.document.insertAnonymousContent();
    this.#content.root.appendChild(this.fragment);
    this.#initializeElements();
    this.#setState(ZapOverlay.STATES.SELECTING);
    
    this.#initialized = true;
  }

  /**
   * Initializes all anonymous content and events
   */
  #initializeElements() {
    this.hoverDiv = this.getElementById('hover-div');
    this.zapComponent = this.getElementById('zap-component');

    this.cancelButton = this.getElementById('zap-cancel');
    this.cancelButton.addEventListener('click', this.#cancelZap.bind(this));

    this.zapThisButton = this.getElementById('zap-this');
    this.zapThisButton.addEventListener('click', this.#handleZap.bind(this));

    this.zapRelatedSlider = this.getElementById('zap-related');
    this.zapRelatedSlider.addEventListener('click', this.#handleZap.bind(this));

    this.zapDoneButton = this.getElementById('zap-done');
    this.zapDoneButton.addEventListener('click', this.#disableZapMode.bind(this));

    // Initialize the related elements button
    this.zapRelatedSlider.addEventListener('mousemove', (e) => {
      const r = e.target.getBoundingClientRect();
      const mouseX = e.clientX;
      const value = (mouseX - r.left) / r.width;
      e.target.style = `--related-elements-value: ${value * 100}%;`;

      const lastIndex = this.#relatedValueIndex;
      this.#relatedValueIndex = parseInt((value * 9 - 0.5).toFixed(0));

      if (lastIndex != this.#relatedValueIndex) {
        this.updateHighlight();
        this.#updatePathTextField();
      }
    });

    this.zapRelatedSlider.addEventListener('mouseleave', (e) => {
      e.target.style = ''; // Clear variable
      this.#relatedValueIndex = 0;

      this.updateHighlight();
      this.#updatePathTextField();
    });

    this.#updateZappedList();
  }

  /**
   * Sets the state of the zap mode
   * @param {STATES} newState New state
   * @param {*} data Optional additional data 
   */
  #setState(newState, data = null) {
    this.#currentState = newState;

    switch (newState) {
      case ZapOverlay.STATES.SELECTED:
        this.#selectedElement = data;
        this.#relatedValueIndex = 0; // Reset index

        this.#hideHoverDiv();
        this.#showZapComponent();
        this.updateHighlight();
        this.#updatePathTextField();
        break;
      case ZapOverlay.STATES.SELECTING:
        this.#selectedElement = null;
        this.#showHoverDiv();
        this.#hideZapComponent();
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
   */
  getElementById(id) {
    return this.content.root.getElementById(id);
  }

  get markup() {
    return `
    <template>
      <link rel="stylesheet" href="chrome://browser/content/zen-styles/content/zen-zap.css" />
      <div id="zap-border"></div>
      <div id="zap-component">
        <div id="zap-controls">
          <input type="button" id="zap-this" value="Zap this"/>
          <input type="button" id="zap-related" value="Zap all related elements">
          <input type="button" id="zap-cancel" value="Cancel"/>
        </div>
        <div id="zap-preview">
          <p id="zap-element-preview-text"><b>9</b> [test-element="12"] [data-test]</p>
        </div>
      </div>
      <div id="hover-div"></div>
      <div id="highlight-container"></div>
      <div id="highlight-shadow" style="display:none;"></div>
      <div id="zap-controls-container">
        <div id="zap-list">
        </div>
        <input type="button" id="zap-done" value="Done"/>
      </div>
    </template>
    `;
  }

  get fragment() {
    if (!this.template) {
      let parser = new DOMParser();
      let doc = parser.parseFromString(this.markup, 'text/html');
      this.template = this.document.importNode(doc.querySelector('template'), true);
    }
    let fragment = this.template.content.cloneNode(true);
    return fragment;
  }

  /**
   * Notifies listeners for an update in the zap list
   */
  onZapUpdate() {
    this.#updateZappedList();
    this.zenBoostsChild.sendNotify('zap-list-update');
  }

  /**
   * Handles the addition of the current zap selector
   */
  #handleZap() {
    const cssPath = this.getSelectionPath();
    this.zenBoostsChild.addZapSelector(cssPath);

    this.#setState(ZapOverlay.STATES.SELECTING);
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
    this.#setState(ZapOverlay.STATES.SELECTING);
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
    const zapList = this.getElementById('zap-list');
    zapList.innerHTML = '';
    
    const boostData = await this.zenBoostsChild.getWebsiteBoost();
    boostData.zapSelectors.forEach(selector => {
      const unzapButton = zapList.ownerDocument.createElement('input');
      unzapButton.type = 'button';
      unzapButton.id = 'unzap';
      unzapButton.value = 'X';
      unzapButton.setAttribute('selector', selector);
      zapList.appendChild(unzapButton);
    });

    if(boostData.zapSelectors.length == 0)
      zapList.innerHTML += '<p class="pcenter">Click elements on the page to <b>Zap</b> them</p>';
    else
      zapList.innerHTML += '<p>← Click to Unzap</p>';
  }

  /**
   * Handles the mouse enter event for the unzap buttons
   * @param {Event} event 
   */
  #unzapButtonHover(event) {
    const button = event.originalTarget;
    const selector = button.getAttribute('selector');
    this.zenBoostsChild.tempShowZappedElement([selector]);

    const { setTimeout } = ChromeUtils.importESModule("resource://gre/modules/Timer.sys.mjs");

    // This has to run on the next tick, as the elements we are trying to highlight do not exist yet.
    // The css has to load first and calculate the bounding boxes for the elements before we can highlight.
    setTimeout(() => {
      const selection = this.document.querySelectorAll(selector);
      if(selection.length != 0)
        this.showHightlight(selection);
    }, 10);

    this.#cancelZap();
  }

  /**
   * Handles the mouse exit event for the unzap buttons
   * @param {Event} event 
   */
  #unzapButtonUnhover(event) {
    this.zenBoostsChild.tempHideZappedElement();
    this.removeHighlight();
  }
  
  /**
   * Handles button clicks from the unzap list
   * @param {Event} event 
   */
  #unzapButtonClick(event) {
    const button = event.originalTarget;
    const selector = button.getAttribute('selector');
    this.#handleUnzap(selector);
    this.removeHighlight();
  }

  /**
   * Rebuilds the selection highlight
   */
  updateHighlight() {
    this.removeHighlight();
    this.showHightlight(this.getSelection());
  }

  /**
   * Highlights a selection of elements on the website
   * @param {List} selection A list of the web elements that should be highlighted
   */
  showHightlight(selection) {
    const highlightContainerDiv = this.getElementById('highlight-container');
    highlightContainerDiv.style.display = 'initial';

    let counter = 0;
    for (const element of selection) {
      if (counter >= 100) break; // Avoid too many instanced objects
      counter++;

      const padding = 5;
      const elementMeasurement = element?.getBoundingClientRect() ?? undefined;
      if (elementMeasurement == undefined) continue;

      const highlightDiv = this.document.createElement('div');
      highlightDiv.classList.add('highlight');

      Object.assign(highlightDiv.style, {
        left: `${elementMeasurement.left - padding}px`,
        top: `${elementMeasurement.top - padding}px`,
        width: `${elementMeasurement.width + padding * 2}px`,
        height: `${elementMeasurement.height + padding * 2}px`,
      });

      highlightContainerDiv.appendChild(highlightDiv);
    }

    this.getElementById('highlight-shadow').display = 'initial';
  }

  /**
   * Clears the highlight
   */
  removeHighlight() {
    const highlightContainerDiv = this.getElementById('highlight-container');
    highlightContainerDiv.style.display = 'none';

    // Clear all children elements
    highlightContainerDiv.innerHTML = '';
    this.getElementById('highlight-shadow').display = 'none';
  }

  /**
   * Updates the path display text on the zap component 
   * based on the current selection
   */
  #updatePathTextField() {
    const maxPathLength = 64;
    const selection = this.getSelection();
    const selectionPath = this.getSelectionPath();

    this.getElementById('zap-element-preview-text').innerHTML =
      `<b>[${selection.length}]</b> ${selectionPath.substring(0, Math.min(maxPathLength, selectionPath.length))}`;
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
    this.#initialized = false;
  }

  /**
   * Hides the hover selection box
   */
  #hideHoverDiv() {
    this.hoverDiv.style.display = 'none';
  }

  /**
   * Shows the hover selection box
   */
  #showHoverDiv() {
    this.hoverDiv.style.display = 'initial';
  }

  /**
   * Hides the zap component
   */
  #hideZapComponent() {
    this.zapComponent.style.display = 'none';
  }

  /**
   * Shows the zap component
   */
  #showZapComponent() {
    this.zapComponent.style.display = 'initial';
    this.#setZapComponentPosition();
  }

  /**
   * Sets the aligned and clamped position for the zap component on the document
   * relative to #selectedElement
   */
  #setZapComponentPosition() {
    const bounds = this.#selectedElement.getBoundingClientRect();
    const distance = 8;

    const zapComponentWidth = 407;
    const zapComponentHeight = 98;

    const windowWidth = this.window.innerWidth;
    const windowHeight = this.window.innerHeight;
    const windowPadding = 10;

    // This clamps the position so the zap component never goes out of the client bounds and adds a small padding
    const top = this.clamp(
      bounds.top + bounds.height + distance,
      windowPadding,
      windowHeight - zapComponentHeight - windowPadding
    );
    const left = this.clamp(
      bounds.left + bounds.width / 2 - zapComponentWidth / 2,
      windowPadding,
      windowWidth - zapComponentWidth - windowPadding
    );

    Object.assign(this.zapComponent.style, {
      top: `${top}px`,
      left: `${left}px`,
    });
  }

  /**
   * This function handles page events while the overlay is active
   * @param {Event} event The event which will be handled by the overlay
   * @param {Boolean} prevent True if the event should be prevented
   */
  handleEvent(event, prevent) {
    const interactableIDs = ['zap-controls', 'zap-list', 'zap-controls-container']
    const closestID = event?.originalTarget?.closest('div')?.id ?? '';
    const isZapContent = interactableIDs.includes(closestID);

    switch (event.type) {
      case 'click':
        this.#handleClick(event, isZapContent);
        break;
      case 'mousemove':
        this.#handleMouseMove(event, isZapContent);
        break;
      case 'mouseover':
        this.#handleHoverDelegation(event);
        break;
      case 'mouseout':
        this.#handleUnhoverDelegation(event);
        break;
      case 'scroll':
        this.#handlePageChange(event);
        return;
      case 'resize':
        this.#handlePageChange(event);
        return;
    }

    // Let the interactable ids pass through
    if(isZapContent) return;

    if (prevent) {
      // From ScreenshotsComponentChild.sys.mjs:103
      // Preventing a pointerdown event throws an error in debug builds.
      // See https://searchfox.org/mozilla-central/rev/b41bb321fe4bd7d03926083698ac498ebec0accf/widget/WidgetEventImpl.cpp#566-572
      // Don't prevent the default context menu.
      if (!['contextmenu', 'pointerdown'].includes(event.type)) {
        event.preventDefault();
      }
      event.stopImmediatePropagation();
    }
  }

  /**
   * Called after a page change to update the highlight and zap component position
   */
  #handlePageChange() {
    if (this.#currentState !== ZapOverlay.STATES.SELECTED) return;

    this.updateHighlight();
    this.#setZapComponentPosition();
  }

  /**
   * Handles the mouse move event
   * @param {Event} event Mouse move event params
   * @param {Boolean} isZapContent Flag if the target element is a zap related element
   */
  #handleMouseMove(event, isZapContent) {
    if (this.#lastOverElement === event.target) return;
    if (!isZapContent) this.#lastOverElement = event.target;
    
    if (isZapContent) this.#hideHoverDiv();
    else if(this.#currentState === ZapOverlay.STATES.SELECTING) this.#showHoverDiv();

    if (this.#currentState !== ZapOverlay.STATES.SELECTING || !event.target) return;

    const bounds = event.target.getBoundingClientRect();
    const padding = 5;

    Object.assign(this.getElementById('hover-div').style, {
      top: `${bounds.top - padding}px`,
      left: `${bounds.left - padding}px`,
      width: `${bounds.width + padding * 2}px`,
      height: `${bounds.height + padding * 2}px`,
    });
  }

  /**
   * Handles the mouse click event
   * @param {Event} event Mouse move event params
   * @param {Boolean} isZapContent Flag if the target element is a zap related element
   */
  #handleClick(event, isZapContent) {
    if (this.#currentState === ZapOverlay.STATES.SELECTING && !isZapContent)
      this.#setState(ZapOverlay.STATES.SELECTED, event.target);

    if(isZapContent && event.originalTarget.id == 'unzap')
      this.#unzapButtonClick(event);
  }

  /**
   * Handles the mouse enter event
   * @param {Event} event Mouse enter event params 
   */
  #handleHoverDelegation(event) {
    if(event.originalTarget.id == 'unzap')
      this.#unzapButtonHover(event);
  }

  /**
   * Handles the mouse leave event
   * @param {Event} event Mouse leave event params 
   */
  #handleUnhoverDelegation(event) {
    if(event.originalTarget.id == 'unzap')
      this.#unzapButtonUnhover(event);
  }

  /**
   * @param {Number} x Value
   * @param {Number} min Minimum limit
   * @param {Number} max Maximum limit
   * @returns A value which always lies between min and max
   */
  clamp(x, min, max) {
    return Math.min(Math.max(x, min), max);
  }

  /**
   * When selecting an area to zap there can be a set of zapped elements
   * since related elements can be included.
   * This method returns all targeted elements for the zapping process.
   * @returns {List} The list of selected elements
   */
  getSelection() {
    return this.document.querySelectorAll(this.getSelectionPath());
  }

  /**
   * Used for retreiving the css path from the selected element and taking
   * the related objects into account
   */
  getSelectionPath() {
    let path = [];

    const escape = (str) => CSS.escape(str);
    const nthChild = (element) => {
      if (!element.parentNode) return '';
      const parent = element.parentNode;
      const index = Array.prototype.indexOf.call(parent.children, element) + 1;

      if (index === 1) return ':first-child';
      if (index === parent.children.length) return ':last-child';
      return `:nth-child(${index})`;
    };
    const getIdentification = (element, specifity = 0) => {
      if (!element) return '';
      const id = specifity < 2 && element.id ? `#${escape(element.id)}` : '';
      const cls =
        specifity < 1 && element.classList.length > 0
          ? '.' + [...element.classList].map((c) => escape(c)).join('.')
          : '';
      const tag = element.tagName ? element.tagName.toLowerCase() : '';

      return `${tag}${id}${cls}`;
    };

    const build = () => path.toReversed().join('');

    let selectedElement = this.#selectedElement;

    switch (this.#relatedValueIndex) {
      case 0:
        path.push(nthChild(selectedElement));
        path.push(' > ');
        if (selectedElement.parentNode) {
          path.push(getIdentification(selectedElement.parentNode, 0));

          while (
            this.document.querySelectorAll(build()).length > 1 &&
            selectedElement.parentNode &&
            selectedElement.parentNode.tagName.toLowerCase() !== 'body'
          ) {
            selectedElement = selectedElement.parentNode;
            if (
              selectedElement.parentNode &&
              selectedElement.parentNode.tagName.toLowerCase() !== 'body'
            ) {
              path.push(' > ');
              path.push(nthChild(selectedElement.parentNode));
              path.push(getIdentification(selectedElement.parentNode, 0));
            }
          }
        }
        break;
      case 1:
        path.push(getIdentification(selectedElement, 1));
        path.push(' > ');
        path.push(getIdentification(selectedElement.parentNode, 0));
        break;
      case 2:
        path.push(getIdentification(selectedElement, 2));
        path.push(' > ');
        path.push(getIdentification(selectedElement.parentNode, 0));
        break;
      case 3:
        path.push('*');
        path.push(' > ');
        path.push(getIdentification(selectedElement.parentNode, 0));
        break;
      case 4:
        path.push(getIdentification(selectedElement, 2));
        path.push(' > ');
        path.push(getIdentification(selectedElement.parentNode, 2));
        break;
      case 5:
        path.push(getIdentification(selectedElement, 0));
        break;
      case 6:
        path.push(getIdentification(selectedElement, 1));
        break;
      case 7:
        path.push(getIdentification(selectedElement, 2));
        break;
    }

    return build();
  }
}
