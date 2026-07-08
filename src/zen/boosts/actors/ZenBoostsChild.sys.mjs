// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const AGENT_SHEET = Ci.nsIStyleSheetService.AGENT_SHEET;

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  ZapOverlay: "resource:///modules/zen/boosts/ZenZapOverlayChild.sys.mjs",
  SelectorComponent:
    "resource:///modules/zen/boosts/ZenSelectorComponent.sys.mjs",
});

export class ZenBoostsChild extends JSWindowActorChild {
  #currentSheet = null;
  #currentState = ZenBoostsChild.STATES.NONE;
  #preventableEventsAdded = false;
  #zappedElementsTempShown = [];

  #overlay = null;

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

  actorCreated() {
    this.#applyBoostForPageIfAvailable();
  }

  didDestroy() {
    if (this.#currentState === ZenBoostsChild.STATES.ZAP) {
      this.disableZapMode();
    }
    this.#removeEventListeners();
  }

  /**
   * Inverse of https://searchfox.org/firefox-main/rev/1a8c62b86277005f907151bc5389cf5c5091e76f/gfx/src/nsColor.h#23-27
   *
   *  > #define NS_RGBA(_r, _g, _b, _a) \
   *  >  ((nscolor)(((_a) << 24) | ((_b) << 16) | ((_g) << 8) | (_r)))
   *
   * Converts [r, g, b] array to (uint32_t) NSColor
   * Make a color out of r,g,b,a values. This assumes that the r,g,b,a
   * values are properly constrained to 0-255.
   *
   * @param {Array} rgb - Array of red, green, blue values [0, 255]
   * @param {number} rgb.0 - Red color value [0, 255]
   * @param {number} rgb.1 - Green color value [0, 255]
   * @param {number} rgb.2 - Blue color value [0, 255]
   * @param {number} contrast - Contrast value (default 255)
   * @returns {number} NSColor integer representation
   */
  #rgbToNSColor([r, g, b], contrast = 255) {
    // Note will be using the alpha channel for contrast, since the colors will always
    // be fully opaque and we need an extra byte to store the contrast value. This allows
    // us to still use an nscolor as parameter instead of having to deal with WebIDL structs
    // shenanigans.
    // Take into account that its an unsigned int
    return ((contrast << 24) | (b << 16) | (g << 8) | r) >>> 0;
  }

  /**
   * Builds the packed primary accent NSColor for a boost, with the boost
   * contrast stored in the alpha byte. The complementary accent is not a
   * separate color: the backend derives it by rotating this accent's hue by
   * the boost's `secondaryDotAngleDegDelta`, which is sent separately.
   *
   * @param {number} hueDeg - Primary hue in degrees.
   * @param {number} sat - Saturation in [0, 1].
   * @param {number} light - Lightness in [0, 1].
   * @param {object} boostData - The current boost data.
   * @returns {number} The packed primary NSColor.
   */
  #buildBoostColor(hueDeg, sat, light, boostData) {
    return this.#rgbToNSColor(
      this.#hslToRgb(hueDeg / 360, sat, light),
      (1 - boostData.contrast) * 255
    );
  }

  /**
   * From ZenGradientGenerator.mjs
   * Converts an HSL color value to RGB. Conversion formula
   * adapted from https://en.wikipedia.org/wiki/HSL_color_space.
   * Assumes h, s, and l are contained in the set [0, 1] and
   * returns r, g, and b in the set [0, 255].
   *
   * @param   {number}  h       The hue
   * @param   {number}  s       The saturation
   * @param   {number}  l       The lightness
   * @returns  {Array}           The RGB representation
   */
  #hslToRgb(h, s, l) {
    const { round } = Math;
    let r, g, b;

    if (s === 0) {
      r = g = b = l; // achromatic
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = this.#hueToRgb(p, q, h + 1 / 3);
      g = this.#hueToRgb(p, q, h);
      b = this.#hueToRgb(p, q, h - 1 / 3);
    }

    return [round(r * 255), round(g * 255), round(b * 255)];
  }

  /**
   * From ZenGradientGenerator.mjs
   * Inverse of hslToRgb
   * Converts an RGB color value to HSL. Conversion formula
   * adapted from https://en.wikipedia.org/wiki/HSL_color_space.
   * Assumes r, g, and b are contained in the set [0, 255] and
   * returns h, s, and l in the set [0, 1].
   *
   * @param   {number}  r       The red value
   * @param   {number}  g       The green value
   * @param   {number}  b       The blue value
   * @returns  {Array}           The HSL representation
   */
  #rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    let max = Math.max(r, g, b);
    let min = Math.min(r, g, b);
    let d = max - min;
    let h;
    if (d === 0) {
      h = 0;
    } else if (max === r) {
      h = ((g - b) / d) % 6;
    } else if (max === g) {
      h = (b - r) / d + 2;
    } else if (max === b) {
      h = (r - g) / d + 4;
    }
    let l = (min + max) / 2;
    let s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    return [h * 60, s, l];
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
      case "ZenBoost:BoostDataUpdated": {
        const { unloadStyles = false } = message.data || {};
        this.#applyBoostForPageIfAvailable(unloadStyles);
        break;
      }
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
        if (this.#currentState === ZenBoostsChild.STATES.NONE) {
          this.#startZappingOverlay();
        } else if (this.#currentState === ZenBoostsChild.STATES.ZAP) {
          this.disableZapMode();
        }
        break;
      case "ZenBoost:TogglePickerMode":
        if (this.#currentState === ZenBoostsChild.STATES.NONE) {
          this.#startPickingOverlay();
        } else if (this.#currentState === ZenBoostsChild.STATES.PICKER) {
          this.disablePickerMode();
        }
        break;
      case "ZenBoost:ZapModeEnabled":
        return this.#currentState === ZenBoostsChild.STATES.ZAP;
      case "ZenBoost:ZapModeAny": {
        const { boostData } = (await this.getWebsiteBoost())?.boostEntry || {};
        return !!boostData?.zapSelectors?.length;
      }
      case "ZenBoost:SelectorPickerModeEnabled":
        return this.#currentState === ZenBoostsChild.STATES.PICKER;
      case "ZenBoost:OpenInspector":
        this.sendAsyncMessage("ZenBoost:OpenInspector");
        break;
      case "ZenBoost:DisableSizeOverride":
        this.disableSizeOverride();
        break;
    }
    return null;
  }

  /**
   * From ZenGradientGenerator.mjs
   * Helper function for hslToRgb conversion
   *
   * @param {number} p
   * @param {number} q
   * @param {number} t
   */
  #hueToRgb(p, q, t) {
    if (t < 0) {
      t += 1;
    }
    if (t > 1) {
      t -= 1;
    }
    if (t < 1 / 6) {
      return p + (q - p) * 6 * t;
    }
    if (t < 1 / 2) {
      return q;
    }
    if (t < 2 / 3) {
      return p + (q - p) * (2 / 3 - t) * 6;
    }
    return p;
  }

  get #hostWithoutPort() {
    const host = this.browsingContext.topWindow?.location.host;
    return host?.split(":")[0];
  }

  /**
   * Aquires the boost data for this website
   *
   * @returns {object} Boost data for the current website
   */
  getWebsiteBoost() {
    const domain = this.#hostWithoutPort;
    if (!domain) {
      return null;
    }

    return this.sendQuery("ZenBoost:GetBoostForDomain", domain);
  }

  /**
   * Applies the boost settings for the current page if available.
   *
   * @param {boolean} unloadStyles - Indicates whether to unload styles.
   */
  async #applyBoostForPageIfAvailable(unloadStyles = false) {
    const browsingContext = this.browsingContext;

    // Prevent applying boosts to iframes or non-top-level browsing contexts.
    // It makes the tab crash if we try to load stylesheets into an iframe's
    if (!browsingContext || browsingContext.parent !== null) {
      return;
    }

    const boost = await this.getWebsiteBoost();

    if (unloadStyles) {
      this.#unloadCurrentStyleSheet();
    }

    if (boost) {
      const { boostData } = boost.boostEntry;
      if (boost.styleSheet) {
        this.#loadStyleSheet(boost.styleSheet);
      }

      if (
        boostData.sizeOverride &&
        isFinite(boostData.sizeOverride) &&
        boostData.sizeOverride !== 1
      ) {
        browsingContext.fullZoom = boostData.sizeOverride;
      }

      browsingContext.isZenBoostsInverted = boostData.smartInvert;
      if (boostData.enableColorBoost) {
        let primaryColor;
        if (boostData.autoTheme) {
          // Workspace color is converted to the HSL color space
          let primaryGradientColor = boost.workspaceGradient[0]?.c ?? [
            0, 0, 0.6,
          ];
          boost.workspaceGradient.forEach(color => {
            if (color.isPrimary) {
              primaryGradientColor = this.#rgbToHsl(
                color.c[0],
                color.c[1],
                color.c[2]
              );
            }
          });

          // Workspace color is converted back to rgb
          // using the same modifiers as the color above
          primaryColor = this.#buildBoostColor(
            primaryGradientColor[0],
            1 - boostData.saturation,
            0.1 + 0.9 * boostData.brightness,
            boostData
          );
        } else {
          primaryColor = this.#buildBoostColor(
            boostData.dotAngleDeg,
            /* already is [0, 1] */
            1 - boostData.saturation,
            /* lightness range from [0.1, 0.9] */
            0.1 + 0.9 * boostData.brightness,
            boostData
          );
        }
        browsingContext.zenBoostsData = primaryColor;
        // The complementary accent is derived in the backend by rotating the
        // primary accent's hue by this delta (in degrees).
        browsingContext.zenBoostsComplementaryRotation =
          boostData.secondaryDotAngleDegDelta ?? 0;
        return;
      }
    } else {
      browsingContext.isZenBoostsInverted = false;
    }
    browsingContext.zenBoostsData = 0;
    browsingContext.zenBoostsComplementaryRotation = 0;
  }

  /**
   * Loads the given stylesheet into the website
   *
   * @param {object} styleSheet The stylesheet
   */
  #loadStyleSheet(styleSheet) {
    const browsingContext = this.browsingContext;
    styleSheet.uri = Services.io.newURI(styleSheet.uri);

    if (this.#currentSheet?.uuid !== styleSheet.uuid) {
      if (this.#currentSheet) {
        this.#unloadCurrentStyleSheet();
      }
      browsingContext.window.windowGlobalChild.browsingContext.window.windowUtils.loadSheet(
        styleSheet.uri,
        AGENT_SHEET
      );
      this.#currentSheet = styleSheet;
    }
  }

  /**
   * Unloads the currently loaded stylesheet
   */
  #unloadCurrentStyleSheet() {
    const browsingContext = this.browsingContext;
    if (this.#currentSheet && browsingContext) {
      browsingContext.window.windowGlobalChild.browsingContext.window.windowUtils.removeSheet(
        this.#currentSheet.uri,
        AGENT_SHEET
      );
      this.#currentSheet = null;
    }
  }

  async #startZappingOverlay() {
    if (this.#currentState === ZenBoostsChild.STATES.ZAP) {
      return;
    }
    this.#currentState = ZenBoostsChild.STATES.ZAP;

    this.#overlay = new lazy.ZapOverlay(this.document, this);
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

  addZapSelector(selector) {
    const domain = this.#hostWithoutPort;
    this.sendQuery("ZenBoost:ZapSelector", {
      action: "add",
      selector,
      domain,
    });
  }

  removeZapSelector(selector) {
    const domain = this.#hostWithoutPort;
    this.sendQuery("ZenBoost:ZapSelector", {
      action: "remove",
      selector,
      domain,
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
    this.sendNotify("zap-state-update");
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

  disableSizeOverride() {
    const browsingContext = this.browsingContext;
    if (!browsingContext || browsingContext.parent !== null) {
      return;
    }
    browsingContext.fullZoom = 1;
  }

  sendNotify(topic, msg = null) {
    this.sendAsyncMessage("ZenBoost:Notify", { topic, msg });
  }
}
