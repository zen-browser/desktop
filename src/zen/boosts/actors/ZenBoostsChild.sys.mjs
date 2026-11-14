// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  ZapOverlay: "resource:///modules/zen/boosts/ZenZapOverlayChild.sys.mjs",
  SelectorComponent:
    "resource:///modules/zen/boosts/ZenSelectorComponent.sys.mjs",
});

export class ZenBoostsChild extends JSWindowActorChild {
  #currentState = ZenBoostsChild.STATES.NONE;
  #preventableEventsAdded = false;
  #zappedElementsTempShown = [];

  #overlay = null;
  // The mode the overlay was started in, "zap" or "focus"
  #zapMode = "zap";

  static STATES = {
    NONE: "none",
    ZAP: "zap",
    PICKER: "picker",
  };

  static OVERLAY_EVENTS = [
    "click",
    "pointerdown",
    "pointermove",
    "pointerup",
    "scroll",
    "resize",
  ];

  // A list of events that will be prevented from
  // reaching the document
  static PREVENTABLE_EVENTS = [
    "click",
    "pointerdown",
    "pointermove",
    "pointerup",
    "mousemove",
    "mousedown",
    "mouseup",
    "mouseenter",
    "mouseover",
    "mouseout",
    "mouseleave",
    "touchstart",
    "touchmove",
    "touchend",
    "dblclick",
    "auxclick",
    "keypress",
    "contextmenu",
    "pointerenter",
    "pointerover",
    "pointerout",
    "pointerleave",
  ];

  // Caching the events in sets for performance
  static ALL_EVENTS_SET = new Set([
    ...ZenBoostsChild.OVERLAY_EVENTS,
    ...ZenBoostsChild.PREVENTABLE_EVENTS,
  ]);

  static PREVENTABLE_SET = new Set(ZenBoostsChild.PREVENTABLE_EVENTS);

  didDestroy() {
    if (this.#currentState === ZenBoostsChild.STATES.ZAP) {
      this.disableZapMode();
    }
    this.#removeEventListeners();
  }

  handleZapEvent(event) {
    if (ZenBoostsChild.ALL_EVENTS_SET.has(event.type)) {
      this.#overlay.handleEvent(
        event,
        ZenBoostsChild.PREVENTABLE_SET.has(event.type)
      );
    }
  }

  /**
   * Adds necessary event listeners to the document
   * to prevent content interactions
   */
  #addEventListeners() {
    this._handleZapEvent = this.handleZapEvent.bind(this);
    this._disableZapMode = this.disableZapMode.bind(this);

    for (let event of ZenBoostsChild.OVERLAY_EVENTS) {
      this.document.addEventListener(event, this._handleZapEvent, true);
    }

    for (let event of ZenBoostsChild.PREVENTABLE_EVENTS) {
      this.document.addEventListener(event, this._handleZapEvent, true);
    }
    this.#preventableEventsAdded = true;
  }

  /**
   * Removes the event listeners from the document
   */
  #removeEventListeners() {
    for (let event of ZenBoostsChild.OVERLAY_EVENTS) {
      this.document.removeEventListener(event, this._handleZapEvent, true);
    }

    if (this.#preventableEventsAdded) {
      for (let event of ZenBoostsChild.PREVENTABLE_EVENTS) {
        this.document.removeEventListener(event, this._handleZapEvent, true);
      }
    }
    this.#preventableEventsAdded = false;
  }

  /**
   * Handles messages received from the parent actor.
   *
   * @param {object} message - The message object containing name and data.
   */
  async receiveMessage(message) {
    switch (message.name) {
      case "ZenBoost:BoostDataUpdated":
        if (this.#currentState === ZenBoostsChild.STATES.ZAP) {
          this.#overlay?.updateZapList();
        }
        break;
      case "ZenBoost:DisableZapMode":
        if (this.#currentState === ZenBoostsChild.STATES.ZAP) {
          this.disableZapMode();
        }
        break;
      case "ZenBoost:DisablePickerMode":
        if (this.#currentState === ZenBoostsChild.STATES.PICKER) {
          this.disablePickerMode();
        }
        break;
      case "ZenBoost:ToggleZapMode":
        this.#toggleZapMode(message.data?.mode === "focus" ? "focus" : "zap");
        break;
      case "ZenBoost:TogglePickerMode":
        if (this.#currentState === ZenBoostsChild.STATES.NONE) {
          this.#startPickingOverlay();
        } else if (this.#currentState === ZenBoostsChild.STATES.PICKER) {
          this.disablePickerMode();
        }
        break;
      case "ZenBoost:ZapModeEnabled":
        return this.#isZapModeEnabled(message.data?.mode);
      case "ZenBoost:ZapModeAny":
        return this.#hasZapEntries(message.data?.mode);
      case "ZenBoost:SelectorPickerModeEnabled":
        return this.#currentState === ZenBoostsChild.STATES.PICKER;
      case "ZenBoost:OpenInspector":
        this.sendAsyncMessage("ZenBoost:OpenInspector");
        break;
      case "ZenBoost:ZapBarHover":
      case "ZenBoost:ZapBarUnhover":
      case "ZenBoost:ZapBarUnzap":
        this.#handleZapBarMessage(message);
        break;
    }
    return null;
  }

  /**
   * Handles the interactions coming from the chrome zap bar. They are only
   * meaningful while zap mode is active on this document.
   *
   * @param {object} message - The message object containing name and data.
   */
  #handleZapBarMessage(message) {
    if (this.#currentState !== ZenBoostsChild.STATES.ZAP || !this.#overlay) {
      return;
    }
    switch (message.name) {
      case "ZenBoost:ZapBarHover":
        this.#overlay.previewZap(message.data.selector);
        break;
      case "ZenBoost:ZapBarUnhover":
        this.#overlay.endZapPreview();
        break;
      case "ZenBoost:ZapBarUnzap":
        this.#overlay.unzap(message.data.selector);
        break;
    }
  }

  get #hostWithoutPort() {
    const host = this.browsingContext.topWindow?.location.host;
    return host?.split(":")[0];
  }

  /**
   * Aquires the zap and focus selectors of the boost for this website
   *
   * @returns {Promise<{zapSelectors: string[], focusSelectors: string[]}|null>}
   *   The selectors, or null when the website has no active boost
   */
  getZapSelectors() {
    const domain = this.#hostWithoutPort;
    if (!domain) {
      return null;
    }

    return this.sendQuery("ZenBoost:GetZapSelectors", domain);
  }

  async #toggleZapMode(mode) {
    if (this.#currentState === ZenBoostsChild.STATES.ZAP) {
      const sameMode = this.#zapMode === mode;
      this.disableZapMode();
      if (sameMode) {
        return;
      }
    } else if (this.#currentState !== ZenBoostsChild.STATES.NONE) {
      return;
    }

    if (mode === "focus") {
      const matching = await this.#matchingFocusSelectors();
      if (matching.length) {
        this.clearZapSelectors("focus", matching);
        this.sendNotify("zap-list-update");
        this.sendNotify("zap-state-update");
        return;
      }
    }
    this.#startZappingOverlay(mode);
  }

  /**
   * @param {string} [mode] Restrict the check to "zap" or "focus"
   * @returns {boolean} Whether zap mode is active, in that mode if given
   */
  #isZapModeEnabled(mode) {
    return (
      this.#currentState === ZenBoostsChild.STATES.ZAP &&
      (!mode || this.#zapMode === mode)
    );
  }

  /**
   * @param {string} [mode] Restrict the check to "zap" or "focus"
   * @returns {Promise<boolean>} Whether the boost has entries, of that mode
   *   if given. Focus entries only count when they match on this page.
   */
  async #hasZapEntries(mode) {
    const selectors = await this.getZapSelectors();
    const zapAny = !!selectors?.zapSelectors.length;
    const focusAny = !!(await this.#matchingFocusSelectors(selectors)).length;
    if (mode === "zap") {
      return zapAny;
    }
    if (mode === "focus") {
      return focusAny;
    }
    return zapAny || focusAny;
  }

  /**
   * @param {object} [selectors] The boost selectors, fetched when omitted
   * @returns {Promise<string[]>} The focus selectors with a match on this page
   */
  async #matchingFocusSelectors(selectors = null) {
    const data = selectors ?? (await this.getZapSelectors());
    return (data?.focusSelectors ?? []).filter(selector => {
      try {
        return !!this.document.querySelector(selector);
      } catch {
        return false;
      }
    });
  }

  async #startZappingOverlay(mode = "zap") {
    if (this.#currentState === ZenBoostsChild.STATES.ZAP) {
      return;
    }
    this.#currentState = ZenBoostsChild.STATES.ZAP;
    this.#zapMode = mode;

    if (mode === "zap") {
      this.#sendToZapBar("ZenBoost:ZapBarState", { visible: true });
    }
    this.#overlay = new lazy.ZapOverlay(this.document, this, mode);
    this.#overlay.initialize();

    this.#addEventListeners();
    this.sendNotify("zap-state-update");
  }

  async #startPickingOverlay() {
    if (this.#currentState === ZenBoostsChild.STATES.PICKER) {
      return;
    }
    this.#currentState = ZenBoostsChild.STATES.PICKER;

    this.#overlay = new lazy.SelectorComponent(
      this.document,
      this,
      [], // No additional IDs needed
      this.onPickerSelection.bind(this)
    );

    this.#overlay.initialize();

    this.#addEventListeners();
    this.sendNotify("selector-picker-state-update", "onenable");
  }

  onPickerSelection(cssSelector) {
    this.sendNotify("selector-picker-picked", cssSelector);
  }

  /**
   * @param {string} selector The selector to add
   * @param {string} [mode] "zap" hides the selection, "focus" hides everything else
   */
  addZapSelector(selector, mode = "zap") {
    const domain = this.#hostWithoutPort;
    this.sendQuery("ZenBoost:ZapSelector", {
      action: "add",
      selector,
      domain,
      mode,
    });
  }

  /**
   * @param {string} mode Clear the "zap" or "focus" entries of the boost
   * @param {string[]|null} [selectors] Only clear these entries of that mode
   */
  clearZapSelectors(mode, selectors = null) {
    const domain = this.#hostWithoutPort;
    this.sendQuery("ZenBoost:ZapSelector", {
      action: "clear",
      selector: "*",
      domain,
      mode,
      selectors,
    });
  }

  /**
   * @param {string} selector The selector to remove
   * @param {string} [mode] The list it was added to, "zap" or "focus"
   */
  removeZapSelector(selector, mode = "zap") {
    const domain = this.#hostWithoutPort;
    this.sendQuery("ZenBoost:ZapSelector", {
      action: "remove",
      selector,
      domain,
      mode,
    });
  }

  async tempShowZappedElement(selector) {
    this.document.querySelectorAll(selector).forEach(element => {
      element.setAttribute("zen-zap-unhide", "true");
    });

    if (!this.#zappedElementsTempShown.includes(selector)) {
      this.#zappedElementsTempShown.push(selector);
    }
  }

  async tempHideZappedElement() {
    this.#zappedElementsTempShown.forEach(selector => {
      this.document.querySelectorAll(selector).forEach(element => {
        element.removeAttribute("zen-zap-unhide");
      });
    });

    this.#zappedElementsTempShown = [];
  }

  disableZapMode() {
    if (this.#currentState === ZenBoostsChild.STATES.NONE) {
      return;
    }
    this.#currentState = ZenBoostsChild.STATES.NONE;

    this.#overlay?.tearDown();
    this.#overlay = null;

    this.#removeEventListeners();
    this.#sendToZapBar("ZenBoost:ZapBarState", { visible: false });
    this.sendNotify("zap-state-update");
  }

  /**
   * Sends the current zap list to the chrome bar
   *
   * @param {{selector: string, count: number}[]} entries The zapped selectors
   */
  sendZapBarUpdate(entries) {
    this.#sendToZapBar("ZenBoost:ZapBarUpdate", { entries });
  }

  /**
   * The chrome bar is torn down by the parent actor when this actor dies, so a
   * message that can no longer be sent (e.g. from didDestroy) is dropped.
   *
   * @param {string} name The message name
   * @param {object} data The message data
   */
  #sendToZapBar(name, data) {
    try {
      this.sendAsyncMessage(name, data);
    } catch {
      // Actor already destroyed.
    }
  }

  disablePickerMode() {
    if (this.#currentState === ZenBoostsChild.STATES.NONE) {
      return;
    }
    this.#currentState = ZenBoostsChild.STATES.NONE;

    this.#overlay?.tearDown();
    this.#overlay = null;

    this.#removeEventListeners();
    this.sendNotify("selector-picker-state-update", "ondisable");
  }

  sendNotify(topic, msg = null) {
    this.sendAsyncMessage("ZenBoost:Notify", { topic, msg });
  }
}
