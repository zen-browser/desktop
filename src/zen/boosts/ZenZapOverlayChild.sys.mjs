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

  constructor(document, zenBoostsChild) {
    this.document = document;
    this.window = document.ownerGlobal;
    this.zenBoostsChild = zenBoostsChild;

    this.initialize();
    this.#setState(ZapOverlay.STATES.SELECTING);
  }

  async initialize() {
    if (this.#initialized) return;

    this.#content = this.document.insertAnonymousContent();
    this.#content.root.appendChild(this.fragment);
    this.initializeElements();
    this.#initialized = true;
  }

  initializeElements() {
    this.hoverDiv = this.getElementById('hover-div');
    this.zapComponent = this.getElementById('zap-component');

    this.cancelButton = this.getElementById('zap-cancel');
    this.cancelButton.addEventListener('click', this.cancelZap.bind(this));

    this.zapThisButton = this.getElementById('zap-this');
    this.zapThisButton.addEventListener('click', this.handleZap.bind(this));

    this.zapRelatedSlider = this.getElementById('zap-related');
    this.zapRelatedSlider.addEventListener('click', this.handleZap.bind(this));

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
        this.updatePathTextField();
      }
    });

    this.zapRelatedSlider.addEventListener('mouseleave', (e) => {
      e.target.style = ''; // Clear variable
      this.#relatedValueIndex = 0;

      this.updateHighlight();
      this.updatePathTextField();
    });
  }

  #setState(newState, data = null) {
    this.#currentState = newState;

    switch (newState) {
      case ZapOverlay.STATES.SELECTED:
        this.#selectedElement = data;
        this.#relatedValueIndex = 0; // Reset index

        this.hideHoverDiv();
        this.showZapComponent();
        this.updateHighlight();
        this.updatePathTextField();
        break;
      case ZapOverlay.STATES.SELECTING:
        this.#selectedElement = null;
        this.showHoverDiv();
        this.hideZapComponent();
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

  getElementById(id) {
    return this.content.root.getElementById(id);
  }

  get markup() {
    return `
    <template>
      <link rel="stylesheet" href="chrome://browser/content/zen-styles/content/zen-zap.css" />
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

  handleZap() {
    const cssPath = this.getSelectionPath();
    this.zenBoostsChild.addZapSelector(cssPath);

    this.#setState(ZapOverlay.STATES.SELECTING);
  }

  cancelZap() {
    this.#setState(ZapOverlay.STATES.SELECTING);
  }

  updateHighlight() {
    this.removeHighlight();

    const highlightContainerDiv = this.getElementById('highlight-container');
    highlightContainerDiv.style.display = 'initial';

    let counter = 0;
    for (const element of this.getSelection()) {
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
  }

  updatePathTextField() {
    const maxPathLength = 64;
    const selection = this.getSelection();
    const selectionPath = this.getSelectionPath();

    this.getElementById('zap-element-preview-text').innerHTML =
      `<b>[${selection.length}]</b> ${selectionPath.substring(0, Math.min(maxPathLength, selectionPath.length))}`;
  }

  removeHighlight() {
    const highlightContainerDiv = this.getElementById('highlight-container');
    highlightContainerDiv.style.display = 'none';

    // Clear all children elements
    highlightContainerDiv.innerHTML = '';
  }

  /**
   * Removes all event listeners and removes the overlay from the Anonymous Content
   */
  tearDown() {
    if (this.#content) {
      try {
        this.document.removeAnonymousContent(this.#content);
      } catch (e) {} // This might fail but that's not an issue
    }
    this.#initialized = false;
  }

  hideHoverDiv() {
    this.hoverDiv.style.display = 'none';
  }

  showHoverDiv() {
    this.hoverDiv.style.display = 'initial';
  }

  showZapComponent() {
    this.zapComponent.style.display = 'initial';
    this.setZapComponentPosition();
  }

  /**
   * Sets the aligned and clamped position for the zap component on the document
   * relative to #selectedElement
   */
  setZapComponentPosition() {
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

  hideZapComponent() {
    this.zapComponent.style.display = 'none';
  }

  /**
   * This function handles page events while the overlay is active
   * @param {Event} event The event which will be handled by the overlay
   * @param {Boolean} prevent True if the event should be prevented
   */
  handleEvent(event, prevent) {
    switch (event.type) {
      case 'click':
        this.handleClick(event);
        break;
      case 'mousemove':
        this.handleMouseMove(event);
        break;
      case 'scroll':
        this.handlePageChange(event);
        return;
      case 'resize':
        this.handlePageChange(event);
        return;
    }

    // Let the events for the zap controls pass through
    const closestID = event.originalTarget.closest('div')?.id ?? '';
    if (closestID != 'zap-controls' && prevent) {
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

  handlePageChange(event) {
    if (this.#currentState !== ZapOverlay.STATES.SELECTED) return;

    this.updateHighlight();
    this.setZapComponentPosition();
  }

  handleMouseMove(event) {
    if (this.#lastOverElement === event.target) return;
    this.#lastOverElement = event.target;

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

  handleClick(event) {
    if (this.#currentState === ZapOverlay.STATES.SELECTING)
      this.#setState(ZapOverlay.STATES.SELECTED, event.target);
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
            const selector = getIdentification(selectedElement, 0);

            if(selectedElement.parentNode && selectedElement.parentNode.tagName.toLowerCase() !== 'body') {
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
