// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const AGENT_SHEET = Ci.nsIStyleSheetService.AGENT_SHEET;

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  ZapOverlay: "resource:///modules/ZenZapOverlayChild.sys.mjs",
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
  };

  static OVERLAY_EVENTS = ["click", "pointerdown", "pointermove", "pointerup", "scroll", "resize"];

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

  /**
   * Called when the actor is destroyed. Cleans up the events.
   */
  didDestroy() {
    this.#removeEventListeners();
  }

  /**
   * Inverse of https://searchfox.org/firefox-main/rev/1a8c62b86277005f907151bc5389cf5c5091e76f/gfx/src/nsColor.h#23-27
   *
   *  > #define NS_RGBA(_r, _g, _b, _a) \
   *  >  ((nscolor)(((_a) << 24) | ((_b) << 16) | ((_g) << 8) | (_r)))
   *
   * Converts [r, g, b] array to NSColor
   * Make a color out of r,g,b,a values. This assumes that the r,g,b,a
   * values are properly constrained to 0-255.
   * @param {Array} rgb - Array of red, green, blue values [0, 255]
   * @param {number} contrast - Contrast value (default 255)
   * @returns {number} NSColor integer representation
   */
  #rgbToNSColor([r, g, b], contrast = 255) {
    // Note will be using the alpha channel for contrast, since the colors will always
    // be fully opaque and we need an extra byte to store the contrast value. This allows
    // us to still use an nscolor as parameter instead of having to deal with WebIDL structs
    // shenanigans.
    return (contrast << 24) | (b << 16) | (g << 8) | r;
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
   * @return  {Array}           The RGB representation
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
   * @return  {Array}           The HSL representation
   */
  #rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    let max = Math.max(r, g, b);
    let min = Math.min(r, g, b);
    let d = max - min;
    let h;
    if (d === 0) h = 0;
    else if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else if (max === b) h = (r - g) / d + 4;
    let l = (min + max) / 2;
    let s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    return [h * 60, s, l];
  }

  /**
   * Handles DOM events for the actor. Applies boost settings when a document
   * element is inserted.
   * @param {Event} event - The DOM event to handle.
   */
  handleEvent(event) {
    switch (event.type) {
      case "unload":
        if (this.#currentState === ZenBoostsChild.STATES.ZAP) {
          this.disableZapMode();
        }
        break;
      case "DOMDocElementInserted":
        this.#applyBoostForPageIfAvailable();
        break;
      default:
        break;
    }
  }

  handleZapEvent(event) {
    if (
      [...ZenBoostsChild.OVERLAY_EVENTS, ...ZenBoostsChild.PREVENTABLE_EVENTS].includes(event.type)
    ) {
      this.#overlay.handleEvent(event, ZenBoostsChild.PREVENTABLE_EVENTS.includes(event.type));
    }
  }

  /**
   * Adds necessary event listeners to the document
   * to prevent content interactions
   */
  #addEventListeners() {
    this._handleZapEvent = this.handleZapEvent.bind(this);

    this._disableZapMode = this.disableZapMode.bind();
    // this.contentWindow.addEventlistener("unload", this._disableZapMode);

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
    // this.contentWindow.removeEventListener("unload", this._disableZapMode);

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
   * @param {Object} message - The message object containing name and data.
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
      case "ZenBoost:ToggleZapMode":
        if (this.#currentState === ZenBoostsChild.STATES.NONE) {
          this.#startZappingOverlay();
        } else if (this.#currentState === ZenBoostsChild.STATES.ZAP) {
          this.disableZapMode();
        }
        break;
      case "ZenBoost:ZapModeEnabled":
        return this.#currentState === ZenBoostsChild.STATES.ZAP;
    }
  }

  /**
   * From ZenGradientGenerator.mjs
   * Helper function for hslToRgb conversion
   */
  #hueToRgb(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  }

  /**
   * Aquires the boost data for this website
   * @returns Boost data for the current website
   */
  async getWebsiteBoost() {
    const domain = this.browsingContext.topWindow?.location?.host;
    if (!domain) return null;

    return this.sendQuery("ZenBoost:GetBoostForDomain", domain);
  }

  /**
   * Aquires the stylesheet for this website
   * @returns Generated stylesheet string for this website
   */
  async getWebsiteStyle() {
    const domain = this.browsingContext.topWindow?.location?.host;
    if (!domain) return null;
    const styleSheet = (await this.sendQuery("ZenBoost:GetStyleForDomain", domain)).styleSheet; 
    return styleSheet;
  }

  /**
   * Applies the boost settings for the current page if available.
   * @param {boolean} unloadStyles - Indicates whether to unload styles.
   */
  async #applyBoostForPageIfAvailable(unloadStyles = false) {
    const browsingContext = this.browsingContext;
    // Prevent applying boosts to iframes or non-top-level browsing contexts.
    // It makes the tab crash if we try to load stylesheets into an iframe's
    if (!browsingContext || browsingContext.parent !== null) {
      return null;
    }

    const domain = browsingContext.topWindow?.location?.host;
    if (!domain) return null;

    const boost = await this.getWebsiteBoost();
    const styleSheet = await this.getWebsiteStyle();

    if (unloadStyles) {
      this.#unloadCurrentStyleSheet();
    }

    if (boost) {
      if (styleSheet)
        this.#loadStyleSheet(styleSheet);

      if (boost.enableColorBoost) {
        let prefersColorSchemeOverride = "none";
        if (boost.smartInvert) {
          prefersColorSchemeOverride = boost.topWindowIsDarkMode ? "light" : "dark";
        }

        browsingContext.prefersColorSchemeOverride = prefersColorSchemeOverride;

        // Has to be a finite value for zoom to work correctly
        // TODO: Figure out something better for site size override
        // browsingContext.fullZoom = boost.siteSizeOverride;

        let colorWheelColor = this.#hslToRgb(
          boost.dotAngleDeg / 360,
          /* already is [0, 1] */
          boost.dotDistance * (1 - boost.saturation),
          /* lightness range from [0.1, 0.7] */
          0.1 + boost.dotDistance * 0.6 * boost.brightness
        );

        let primaryGradientColor = boost.workspaceGradient[0].c ?? this.#rgbToHsl([75, 75, 75]);

        // Workspace color is converted to the HSL color space
        boost.workspaceGradient.forEach((color) => {
          if (color.isPrimary)
            primaryGradientColor = this.#rgbToHsl(color.c[0], color.c[1], color.c[2]);
        });
        // Workspace color is converted back to rgb
        // using the same modifiers as the color above
        primaryGradientColor = this.#hslToRgb(
          primaryGradientColor[0] / 360,
          primaryGradientColor[1] * (1 - boost.saturation),
          0.1 + primaryGradientColor[2] * 0.6 * boost.brightness
        );

        const rgbColor = boost.autoTheme ? primaryGradientColor : colorWheelColor;
        const nsColor = this.#rgbToNSColor(rgbColor, (1 - boost.contrast) * 255);
        browsingContext.zenBoostsData = nsColor;
        return;
      }

      browsingContext.zenBoostsData = 0;
      browsingContext.prefersColorSchemeOverride = 'none';
    }
  }

  /**
   * Loads the given stylesheet into the website
   * @param {Object} styleSheet The stylesheet
   */
  #loadStyleSheet(styleSheet) {
    const browsingContext = this.browsingContext;
    styleSheet.uri = Services.io.newURI(styleSheet.uri);
    
    if (this.#currentSheet?.uuid !== styleSheet.uuid) {
      if (this.#currentSheet)
        this.#unloadCurrentStyleSheet();
      browsingContext.window.windowUtils.loadSheet(styleSheet.uri, AGENT_SHEET);
      this.#currentSheet = styleSheet;
    }
  }

  /**
   * Unloads the currently loaded stylesheet
   */
  #unloadCurrentStyleSheet() {
    const browsingContext = this.browsingContext;
    if (this.#currentSheet && browsingContext) {
      browsingContext.window.windowUtils.removeSheet(this.#currentSheet.uri, AGENT_SHEET);
      this.#currentSheet = null;
    }
  }

  async #startZappingOverlay() {
    if (this.#currentState === ZenBoostsChild.STATES.ZAP) return;
    this.#currentState = ZenBoostsChild.STATES.ZAP;

    this.#overlay = new lazy.ZapOverlay(this.document, this);
    this.#overlay.initialize();

    this.#addEventListeners();
    this.sendNotify("zap-state-update");
  }

  addZapSelector(selector) {
    const domain = this.browsingContext.topWindow?.location?.host;
    this.sendQuery("ZenBoost:ZapSelector", { 
      action: "add",
      selector: selector, 
      domain: domain 
    });
  }

  removeZapSelector(selector) {
    const domain = this.browsingContext.topWindow?.location?.host;
    this.sendQuery("ZenBoost:ZapSelector", {
      action: "remove",
      selector: selector,
      domain: domain,
    });
  }

  async tempShowZappedElement(selector) {
    this.document.querySelectorAll(selector).forEach(element => {
      element.setAttribute('zen-zap-unhide', 'true');
    });

    if(!this.#zappedElementsTempShown.includes(selector))
      this.#zappedElementsTempShown.push(selector);
  }

  async tempHideZappedElement() {
    this.#zappedElementsTempShown.forEach(selector => {
      this.document.querySelectorAll(selector).forEach(element => {
        element.removeAttribute('zen-zap-unhide');
      });
    });

    this.#zappedElementsTempShown = [];
  }

  disableZapMode() {
    if (this.#currentState === ZenBoostsChild.STATES.NONE) return;
    this.#currentState = ZenBoostsChild.STATES.NONE;

    this.#overlay?.tearDown();
    this.#overlay = null;

    this.#removeEventListeners();
    this.sendNotify("zap-state-update");
  }

  sendNotify(topic) {
    this.sendQuery("ZenBoost:Notify", { topic });
  }
}
