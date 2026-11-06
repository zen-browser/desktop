/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { nsZenMultiWindowFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";

const kMinLayerAlpha = 0.2;
const kMaxLayerAlpha = 0.88;
const kMinTranslucentLayerAlpha = 0.85;
const kMinWindowAlpha = 0.35;
const kMaxWindowAlpha = 1;
const kTextOpacity = 0.9;
const kTextTint = 0.12;
const kGradientStops = 12;
const kGradientChroma = 0;
const kGradientHueEase = 0;
const kBaseGradientStart = 0;
const kBaseGradientEnd = 0.75;
const kOverlayStart = 0;
const kOverlayEnd = 1;
const kOverlayMaxAlpha = 0.9;
const kOverlayStrips = 64;
const kOverlayAngle = 180;
const kOverlayReferenceAspect = 16 / 10;
const kTextures = ["none", "grain", "sand", "denim", "tweed"];
const kDefaultTexture = "grain";
const kGrainDefault = 10 / 16;

function toLinear(c) {
  const a = Math.abs(c);
  return (
    Math.sign(c) * (a <= 0.04045 ? a / 12.92 : ((a + 0.055) / 1.055) ** 2.4)
  );
}

function toGamma(c) {
  const a = Math.abs(c);
  return (
    Math.sign(c) * (a <= 0.0031308 ? a * 12.92 : 1.055 * a ** (1 / 2.4) - 0.055)
  );
}

function srgbToLinear(channel) {
  return toLinear(channel / 255);
}

function linearToSrgb(c) {
  return Math.min(255, Math.max(0, toGamma(c) * 255));
}

function rgbToOklab([r, g, b]) {
  const [lr, lg, lb] = [r, g, b].map(srgbToLinear);
  const l = Math.cbrt(
    0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb
  );
  const m = Math.cbrt(
    0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb
  );
  const s = Math.cbrt(
    0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb
  );
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToRgb([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map(linearToSrgb);
}

function parseSinePath(pathStr) {
  const points = [];
  const commands = pathStr.match(/[MCL]\s*[\d\s.\-,]+/g);
  if (!commands) {
    return points;
  }

  commands.forEach(command => {
    const type = command.charAt(0);
    const coordsStr = command.slice(1).trim();
    const coords = coordsStr.split(/[\s,]+/).map(Number);

    switch (type) {
      case "M":
        points.push({ x: coords[0], y: coords[1], type: "M" });
        break;
      case "C":
        if (coords.length >= 6 && coords.length % 6 === 0) {
          for (let i = 0; i < coords.length; i += 6) {
            points.push({
              x1: coords[i],
              y1: coords[i + 1],
              x2: coords[i + 2],
              y2: coords[i + 3],
              x: coords[i + 4],
              y: coords[i + 5],
              type: "C",
            });
          }
        }
        break;
      case "L":
        points.push({ x: coords[0], y: coords[1], type: "L" });
        break;
    }
  });
  return points;
}

const lazy = {};

ChromeUtils.defineLazyGetter(lazy, "MAX_OPACITY", () => {
  return parseFloat(
    document.getElementById("PanelUI-zen-gradient-generator-opacity").max
  );
});

ChromeUtils.defineLazyGetter(lazy, "MIN_OPACITY", () => {
  return parseFloat(
    document.getElementById("PanelUI-zen-gradient-generator-opacity").min
  );
});

ChromeUtils.defineLazyGetter(lazy, "browserBackgroundElement", () => {
  return document.getElementById("zen-browser-background");
});

ChromeUtils.defineLazyGetter(lazy, "toolbarBackgroundElement", () => {
  return document.getElementById("zen-toolbar-background");
});

const EXPLICIT_LIGHTNESS_TYPE = "explicit-lightness";
const EXPLICIT_BLACKWHITE_TYPE = "explicit-black-white";

/**
 * A class that manages the theme picker for Zen Workspaces.
 * It allows users to create and customize gradients for their workspace themes.
 */
export class nsZenThemePicker extends nsZenMultiWindowFeature {
  static MAX_DOTS = 3;

  currentOpacity = 0.5;
  dots = [];
  useAlgo = "";
  #lastNoiseTexture = null;
  #lastNoiseTextureType = null;
  currentTextureType = kDefaultTexture;
  #currentLightness = 50;

  #allowTransparencyOnSidebar = Services.prefs.getBoolPref(
    "zen.theme.acrylic-sidebar",
    false
  );

  #linePath = `M 51.373 27.395 L 367.037 27.395`;
  #sinePath = `M 51.373 27.395 C 60.14 -8.503 68.906 -8.503 77.671 27.395 C 86.438 63.293 95.205 63.293 103.971 27.395 C 112.738 -8.503 121.504 -8.503 130.271 27.395 C 139.037 63.293 147.803 63.293 156.57 27.395 C 165.335 -8.503 174.101 -8.503 182.868 27.395 C 191.634 63.293 200.4 63.293 209.167 27.395 C 217.933 -8.503 226.7 -8.503 235.467 27.395 C 244.233 63.293 252.999 63.293 261.765 27.395 C 270.531 -8.503 279.297 -8.503 288.064 27.395 C 296.83 63.293 305.596 63.293 314.363 27.395 C 323.13 -8.503 331.896 -8.503 340.662 27.395 M 314.438 27.395 C 323.204 -8.503 331.97 -8.503 340.737 27.395 C 349.503 63.293 358.27 63.293 367.037 27.395`;

  #sinePoints = parseSinePath(this.#sinePath);

  #colorPage = 0;
  #gradientsCache = new Map();
  #nativeAccentColorCache = null;

  constructor() {
    super();
    this.#initNativeAccentColorInvalidation();
    if (
      !gZenWorkspaces.shouldHaveWorkspaces ||
      gZenWorkspaces.privateWindowOrDisabled
    ) {
      return;
    }
    this.promiseInitialized = new Promise(resolve => {
      this._resolveInitialized = resolve;
    });
    this.dragStartPosition = null;

    this.isLegacyVersion =
      Services.prefs.getIntPref("zen.theme.gradient-legacy-version", 1) === 0;

    ChromeUtils.defineLazyGetter(this, "panel", () =>
      document.getElementById("PanelUI-zen-gradient-generator")
    );
    ChromeUtils.defineLazyGetter(this, "toolbox", () =>
      document.getElementById("TabsToolbar")
    );
    ChromeUtils.defineLazyGetter(this, "customColorInput", () =>
      document.getElementById("PanelUI-zen-gradient-generator-custom-input")
    );
    ChromeUtils.defineLazyGetter(this, "customColorList", () =>
      document.getElementById("PanelUI-zen-gradient-generator-custom-list")
    );

    ChromeUtils.defineLazyGetter(this, "sliderWavePath", () =>
      document
        .getElementById("PanelUI-zen-gradient-slider-wave")
        .querySelector("path")
    );

    this.panel.addEventListener(
      "popupshowing",
      this.handlePanelOpen.bind(this)
    );
    this.panel.addEventListener(
      "popuphidden",
      this.handlePanelClose.bind(this)
    );
    this.panel.addEventListener("command", this.handlePanelCommand.bind(this));

    document
      .getElementById("PanelUI-zen-gradient-generator-opacity")
      .addEventListener("input", this.onOpacityChange.bind(this));

    // Call the rest of the initialization
    this.initContextMenu();
    this.initPredefinedColors();

    this._resolveInitialized();
    delete this._resolveInitialized;

    this.initCustomColorInput();
    this.initTextureInput();
    this.initSchemeButtons();
    this.initColorPages();

    const darkModeChange = this.handleDarkModeChange.bind(this);
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", darkModeChange);

    XPCOMUtils.defineLazyPreferenceGetter(
      this,
      "windowSchemeType",
      "zen.view.window.scheme",
      2,
      darkModeChange
    );

    XPCOMUtils.defineLazyPreferenceGetter(
      this,
      "darkModeBias",
      "zen.theme.dark-mode-bias",
      "0.5"
    );
  }

  handleDarkModeChange() {
    this.#nativeAccentColorCache = null;
    this.updateCurrentWorkspace();
    Services.obs.notifyObservers(null, "zen-theme-change");
  }

  get isDarkMode() {
    if (PrivateBrowsingUtils.isWindowPrivate(window)) {
      return true;
    }
    switch (this.windowSchemeType) {
      case 0:
        return true;
      case 1:
        return false;
      default:
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  get colorHarmonies() {
    return [
      { type: "complementary", angles: [180] },
      { type: "singleAnalogous", angles: [310] },
      { type: "splitComplementary", angles: [150, 210] },
      { type: "analogous", angles: [50, 310] },
      { type: "triadic", angles: [120, 240] },
      { type: "floating", angles: [] },
    ];
  }

  initContextMenu() {
    const menu = window.MozXULElement.parseXULToFragment(`
        <menuitem id="zenToolbarThemePicker"
                  data-lazy-l10n-id="zen-workspaces-change-theme"
                  command="cmd_zenOpenZenThemePicker"/>
      `);
    document.getElementById("zen-toolbar-context-set-profile").before(menu);
  }

  openThemePicker(event) {
    const fromForm = event.explicitOriginalTarget?.classList?.contains(
      "zen-workspace-creation-edit-theme-button"
    );
    const isRightSide = window.gZenVerticalTabsManager._prefsRightSide;
    PanelMultiView.openPopup(this.panel, this.toolbox, {
      position: isRightSide ? "topleft topright" : "topright topleft",
      triggerEvent: event,
      y: fromForm ? -160 : 0,
      x: -10,
    });
  }

  initCustomColorInput() {
    this.customColorInput.addEventListener("change", event => {
      // Prevent the popup from closing when the input is focused
      this.openThemePicker(event);
    });
  }

  initPredefinedColors() {
    document
      .getElementById("PanelUI-zen-gradient-generator-color-pages")
      .addEventListener("click", async event => {
        const target = event.target;
        const rawPosition = target.getAttribute("data-position");
        if (!rawPosition) {
          return;
        }
        const algo = target.getAttribute("data-algo");
        const lightness = target.getAttribute("data-lightness");
        const numDots = parseInt(target.getAttribute("data-num-dots"));
        if (numDots < this.dots.length) {
          for (let i = numDots; i < this.dots.length; i++) {
            this.dots[i].element.remove();
          }
          this.dots = this.dots.slice(0, numDots);
        }
        const type =
          target.getAttribute("data-type") || EXPLICIT_LIGHTNESS_TYPE;
        const exactColor = target.getAttribute("data-color");
        // Generate new gradient from the single color given
        const [x, y] = rawPosition.split(",").map(pos => parseInt(pos));
        let dots = [
          {
            ID: 0,
            position: { x, y },
            isPrimary: true,
            type,
          },
        ];
        for (let i = 1; i < numDots; i++) {
          dots.push({
            ID: i,
            position: { x: 0, y: 0 },
            type,
          });
        }
        this.useAlgo = algo;
        if (lightness !== null) {
          this.#currentLightness = lightness;
        }
        dots = this.calculateCompliments(dots, "update", this.useAlgo);
        this.handleColorPositions(dots, true);
        if (exactColor) {
          this.dots[0]?.element.style.setProperty(
            "--zen-theme-picker-dot-color",
            `rgb(${exactColor})`
          );
        }
        this.updateCurrentWorkspace();
      });
  }

  initColorPages() {
    const leftButton = document.getElementById(
      "PanelUI-zen-gradient-generator-color-page-left"
    );
    const rightButton = document.getElementById(
      "PanelUI-zen-gradient-generator-color-page-right"
    );
    const pagesWrapper = document.getElementById(
      "PanelUI-zen-gradient-generator-color-pages"
    );
    const pages = pagesWrapper.children;
    pagesWrapper.addEventListener("wheel", event => {
      event.preventDefault();
      event.stopPropagation();
    });
    leftButton.addEventListener("command", () => {
      this.#colorPage = (this.#colorPage - 1 + pages.length) % pages.length;
      // Scroll to the next page, by using scrollLeft
      pagesWrapper.scrollLeft =
        (this.#colorPage * pagesWrapper.scrollWidth) / pages.length;
      rightButton.disabled = false;
      leftButton.disabled = this.#colorPage === 0;
    });
    rightButton.addEventListener("command", () => {
      this.#colorPage = (this.#colorPage + 1) % pages.length;
      // Scroll to the next page, by using scrollLeft
      pagesWrapper.scrollLeft =
        (this.#colorPage * pagesWrapper.scrollWidth) / pages.length;
      leftButton.disabled = false;
      rightButton.disabled = this.#colorPage === pages.length - 1;
    });
  }

  initSchemeButtons() {
    const buttons = document.getElementById(
      "PanelUI-zen-gradient-generator-scheme"
    );
    buttons.addEventListener("click", event => {
      const target = event.target.closest(".subviewbutton");
      if (!target) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const scheme = target.id.replace(
        "PanelUI-zen-gradient-generator-scheme-",
        ""
      );
      if (!scheme) {
        return;
      }
      const themeInt = {
        auto: 2,
        light: 1,
        dark: 0,
      }[scheme];
      if (themeInt === undefined) {
        return;
      }
      Services.prefs.setIntPref("zen.view.window.scheme", themeInt);
    });
  }

  initTextureInput() {
    const wrapper = document.getElementById(
      "PanelUI-zen-gradient-generator-texture-wrapper"
    );
    const wrapperWidth =
      window.windowUtils.getBoundsWithoutFlushing(wrapper).width;
    // Add elements in a circular pattern, where the center is the center of the wrapper
    for (let i = 0; i < 16; i++) {
      const dot = document.createElement("div");
      dot.classList.add("zen-theme-picker-texture-dot", "no-squircles");
      const position = (i / 16) * Math.PI * 2 + wrapperWidth;
      dot.style.left = `${Math.cos(position) * 50 + 50}%`;
      dot.style.top = `${Math.sin(position) * 50 + 50}%`;
      wrapper.appendChild(dot);
    }
    this._textureFace = document.createElement("div");
    this._textureFace.classList.add(
      "zen-theme-picker-texture-face",
      "no-squircles"
    );
    wrapper.appendChild(this._textureFace);
    this._textureHandler = document.createElement("div");
    this._textureHandler.id = "PanelUI-zen-gradient-generator-texture-handler";
    this._textureHandler.classList.add("no-squircles");
    this._textureHandler.addEventListener(
      "mousedown",
      this.onTextureHandlerMouseDown.bind(this)
    );
    wrapper.appendChild(this._textureHandler);
    wrapper.addEventListener("click", this.onTextureWrapperClick.bind(this));
    wrapper.addEventListener("wheel", this.onTextureWrapperWheel.bind(this), {
      passive: true,
    });
  }

  onTextureWrapperClick(event) {
    if (event.target === this._textureHandler || this._textureMoved) {
      this._textureMoved = false;
      return;
    }
    this.cycleTexture(1);
  }

  // Trackpad swipes over the knob step through the texture styles.
  onTextureWrapperWheel(event) {
    const now = Date.now();
    if (now - (this._lastTextureWheelEvent ?? 0) > 200) {
      this._textureWheelDelta = 0;
    }
    this._lastTextureWheelEvent = now;
    this._textureWheelDelta = (this._textureWheelDelta ?? 0) + event.deltaX;
    if (
      Math.abs(this._textureWheelDelta) < 40 ||
      now - (this._lastTextureCycle ?? 0) < 350
    ) {
      return;
    }
    this.cycleTexture(Math.sign(this._textureWheelDelta));
    this._textureWheelDelta = 0;
    this._lastTextureCycle = now;
  }

  cycleTexture(step) {
    const index = kTextures.indexOf(this.currentTextureType);
    this.currentTextureType =
      kTextures[(index + step + kTextures.length) % kTextures.length];
    if (this.currentTextureType === "none") {
      this.currentTexture = 0;
    } else if (!this.currentTexture) {
      this.currentTexture = kGrainDefault;
    }
    /* eslint-disable-next-line mozilla/valid-services */
    Services.zen.playHapticFeedback();
    this.updateCurrentWorkspace();
  }

  onTextureHandlerMouseDown(event) {
    this._textureMoved = false;
    event.preventDefault();
    this._onTextureMouseMove = this.onTextureMouseMove.bind(this);
    this._onTextureMouseUp = this.onTextureMouseUp.bind(this);
    document.addEventListener("mousemove", this._onTextureMouseMove);
    document.addEventListener("mouseup", this._onTextureMouseUp);
  }

  onTextureMouseMove(event) {
    this._textureMoved = true;
    event.preventDefault();
    const wrapper = document.getElementById(
      "PanelUI-zen-gradient-generator-texture-wrapper"
    );
    const wrapperRect = window.windowUtils.getBoundsWithoutFlushing(wrapper);
    // Determine how much rotation there is based on the mouse position and the center of the wrapper
    const rotation = Math.atan2(
      event.clientY - wrapperRect.top - wrapperRect.height / 2,
      event.clientX - wrapperRect.left - wrapperRect.width / 2
    );
    const previousTexture = this.currentTexture;
    this.currentTexture = (rotation * 180) / Math.PI + 90;
    // if it's negative, add 360 to make it positive
    if (this.currentTexture < 0) {
      this.currentTexture += 360;
    }
    // make it go from 1 to 0 instead of being in degrees
    this.currentTexture /= 360;
    // We clip it to the closest button out of 16 possible buttons
    this.currentTexture = Math.round(this.currentTexture * 16) / 16;
    if (this.currentTexture === 1) {
      this.currentTexture = 0;
    }
    if (this.currentTexture > 0 && this.currentTextureType === "none") {
      this.currentTextureType = kDefaultTexture;
    }
    if (previousTexture !== this.currentTexture) {
      this.updateCurrentWorkspace();
      /* eslint-disable mozilla/valid-services */
      Services.zen.playHapticFeedback();
    }
  }

  onTextureMouseUp(event) {
    event.preventDefault();
    document.removeEventListener("mousemove", this._onTextureMouseMove);
    document.removeEventListener("mouseup", this._onTextureMouseUp);
    this._onTextureMouseMove = null;
    this._onTextureMouseUp = null;
  }

  initThemePicker() {
    const themePicker = this.panel.querySelector(".zen-theme-picker-gradient");
    this._onDotMouseMove = this.onDotMouseMove.bind(this);
    this._onDotMouseUp = this.onDotMouseUp.bind(this);
    this._onDotMouseDown = this.onDotMouseDown.bind(this);
    this._onThemePickerClick = this.onThemePickerClick.bind(this);
    document.addEventListener("mousemove", this._onDotMouseMove);
    document.addEventListener("mouseup", this._onDotMouseUp);
    themePicker.addEventListener("mousedown", this._onDotMouseDown);
    themePicker.addEventListener("click", this._onThemePickerClick);
  }

  uninitThemePicker() {
    const themePicker = this.panel.querySelector(".zen-theme-picker-gradient");
    document.removeEventListener("mousemove", this._onDotMouseMove);
    document.removeEventListener("mouseup", this._onDotMouseUp);
    themePicker.removeEventListener("mousedown", this._onDotMouseDown);
    themePicker.removeEventListener("click", this._onThemePickerClick);
    this._onDotMouseMove = null;
    this._onDotMouseUp = null;
    this._onDotMouseDown = null;
    this._onThemePickerClick = null;
  }

  /**
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
  hslToRgb(h, s, l) {
    const { round } = Math;
    let r, g, b;

    if (s === 0) {
      r = g = b = l; // achromatic
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = this.hueToRgb(p, q, h + 1 / 3);
      g = this.hueToRgb(p, q, h);
      b = this.hueToRgb(p, q, h - 1 / 3);
    }

    return [round(r * 255), round(g * 255), round(b * 255)];
  }

  rgbToHsl(r, g, b) {
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

  hueToRgb(p, q, t) {
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

  calculateInitialPosition([r, g, b]) {
    // This function is called before the picker is even rendered, so we hard code the dimensions
    // important: If any sort of sizing is changed, make sure changes are reflected here
    const padding = 0;
    const rect = {
      width: 364 + padding * 2,
      height: 364 + padding * 2,
    };
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const radius = (rect.width - padding) / 2;
    const [hue, saturation] = this.rgbToHsl(r, g, b);
    const angle = (hue / 360) * 2 * Math.PI; // Convert to radians
    const normalizedSaturation = saturation / 100; // Convert to [0, 1]
    const x =
      centerX + radius * normalizedSaturation * Math.cos(angle) - padding;
    const y =
      centerY + radius * normalizedSaturation * Math.sin(angle) - padding;
    return { x, y };
  }

  getColorFromPosition(x, y, type = undefined) {
    // Return a color as hsl based on the position in the gradient
    const gradient = this.panel.querySelector(".zen-theme-picker-gradient");
    const rect = window.windowUtils.getBoundsWithoutFlushing(gradient);
    const padding = 30; // each side
    const dotHalfSize = 29; // half the size of the dot. -11 for correct centering
    x += dotHalfSize;
    y += dotHalfSize;
    rect.width += padding * 2; // Adjust width and height for padding
    rect.height += padding * 2; // Adjust width and height for padding
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const radius = (rect.width - padding) / 2;
    const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2) - 0.2;
    let angle = Math.atan2(y - centerY, x - centerX);
    angle = (angle * 180) / Math.PI;
    if (angle < 0) {
      angle += 360;
    }
    const normalizedDistance = 1 - Math.min(distance / radius, 1);
    let hue = (angle / 360) * 360;
    let saturation = normalizedDistance * 100;
    if (type !== EXPLICIT_LIGHTNESS_TYPE) {
      saturation = 90 + (1 - normalizedDistance) * 10;
      // Set the current lightness to how far we are from the center of the circle
      // For example, moving the dot outside will have higher lightness, while moving it inside will have lower lightness
      this.#currentLightness = Math.round((1 - normalizedDistance) * 100);
    }
    let lightness = this.#currentLightness;
    if (type === EXPLICIT_BLACKWHITE_TYPE) {
      // We can only get grayscales from white to black
      saturation = 0;
      lightness = Math.round((1 - normalizedDistance) * 100);
    }
    let r, g, b;
    if (type === EXPLICIT_LIGHTNESS_TYPE) {
      [r, g, b] = this.hsbToRgb(hue, normalizedDistance, lightness / 100);
    } else {
      [r, g, b] = this.hslToRgb(hue / 360, saturation / 100, lightness / 100);
    }
    return [
      Math.min(255, Math.max(0, r)),
      Math.min(255, Math.max(0, g)),
      Math.min(255, Math.max(0, b)),
    ];
  }

  hsbToRgb(hue, saturation, brightness) {
    const c = brightness * saturation;
    const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
    const m = brightness - c;
    const sector = Math.floor((((hue % 360) + 360) % 360) / 60) % 6;
    const [r, g, b] = [
      [c, x, 0],
      [x, c, 0],
      [0, c, x],
      [0, x, c],
      [x, 0, c],
      [c, 0, x],
    ][sector];
    return [r + m, g + m, b + m].map(v => Math.round(v * 255));
  }

  getJSONPos(x, y) {
    // Return a JSON string with the position
    return JSON.stringify({ x: Math.round(x), y: Math.round(y) });
  }

  createDot(color, fromWorkspace = false) {
    const [r, g, b] = color.c;
    const dot = document.createElement("div");
    if (color.isPrimary) {
      dot.classList.add("primary");
    }
    if (color.isCustom) {
      if (!color.c) {
        return;
      }
      dot.classList.add("custom");
      dot.style.opacity = 0;
      dot.style.setProperty("--zen-theme-picker-dot-color", color.c);
    } else {
      const { x, y } =
        color.position || this.calculateInitialPosition([r, g, b]);
      const dotPad = this.panel.querySelector(".zen-theme-picker-gradient");

      dot.classList.add("zen-theme-picker-dot", "no-squircles");

      dot.style.left = `${x}px`;
      dot.style.top = `${y}px`;

      if (this.dots.length < 1) {
        dot.classList.add("primary");
      }

      dotPad.appendChild(dot);
      let id = this.dots.length;

      dot.style.setProperty(
        "--zen-theme-picker-dot-color",
        `rgb(${r}, ${g}, ${b})`
      );
      dot.setAttribute("data-position", this.getJSONPos(x, y));
      dot.setAttribute("data-type", color.type);

      this.dots.push({
        ID: id,
        element: dot,
        position: { x, y },
        type: color.type,
        lightness: color.lightness,
      });
    }
    if (!fromWorkspace) {
      this.updateCurrentWorkspace(true);
    }
  }

  addColorToCustomList(color) {
    const listItems = window.MozXULElement.parseXULToFragment(`
        <hbox class="zen-theme-picker-custom-list-item">
          <html:div class="zen-theme-picker-dot custom"></html:div>
          <label class="zen-theme-picker-custom-list-item-label"></label>
          <toolbarbutton class="zen-theme-picker-custom-list-item-remove toolbarbutton-1"></toolbarbutton>
        </hbox>
      `);
    listItems
      .querySelector(".zen-theme-picker-custom-list-item")
      .setAttribute("data-color", color);
    listItems
      .querySelector(".zen-theme-picker-dot")
      .style.setProperty("--zen-theme-picker-dot-color", color);
    listItems.querySelector(
      ".zen-theme-picker-custom-list-item-label"
    ).textContent = color;
    listItems
      .querySelector(".zen-theme-picker-custom-list-item-remove")
      .addEventListener("command", this.removeCustomColor.bind(this));

    this.customColorList.appendChild(listItems);
  }

  async addCustomColor() {
    let color = this.customColorInput.value;

    if (!color) {
      return;
    }

    let colorOpacity =
      document.getElementById("PanelUI-zen-gradient-generator-custom-opacity")
        ?.value ?? 1;
    // Convert the opacity into a hex value if it's not already
    if (colorOpacity < 1) {
      // e.g. if opacity is 1, we add to the color FF, if it's 0.5 we add 80, etc.
      const hexOpacity = Math.round(colorOpacity * 255)
        .toString(16)
        .padStart(2, "0")
        .toUpperCase();
      // If the color is in hex format
      if (color.startsWith("#")) {
        // If the color is already in hex format, we just append the opacity
        if (color.length === 7) {
          color += hexOpacity;
        }
      }
    }

    // Add '#' prefix if it's missing and the input appears to be a hex color
    if (!color.startsWith("#") && /^[0-9A-Fa-f]{3,6}$/.test(color)) {
      color = "#" + color;
    }

    // can be any color format, we just add it to the list as a dot, but hidden
    const dot = document.createElement("div");
    dot.classList.add("zen-theme-picker-dot", "hidden", "custom");
    dot.style.opacity = 0;
    dot.style.setProperty("--zen-theme-picker-dot-color", color);
    this.panel
      .querySelector("#PanelUI-zen-gradient-generator-custom-list")
      .prepend(dot);
    this.customColorInput.value = "";
    document.getElementById(
      "PanelUI-zen-gradient-generator-custom-opacity"
    ).value = 1;
    this.updateCurrentWorkspace();
  }

  handlePanelCommand(event) {
    const target = event.target.closest("toolbarbutton");
    if (!target) {
      return;
    }
    switch (target.id) {
      case "PanelUI-zen-gradient-generator-color-custom-add":
        this.addCustomColor();
        break;
    }
  }

  spawnDot(dotData, primary = false) {
    const dotPad = this.panel.querySelector(".zen-theme-picker-gradient");
    const relativePosition = {
      x: dotData.x,
      y: dotData.y,
    };

    const dot = document.createElement("div");
    dot.classList.add("zen-theme-picker-dot", "no-squircles");

    dot.style.left = `${dotData.x}px`;
    dot.style.top = `${dotData.y}px`;

    dotPad.appendChild(dot);

    let id = this.dots.length;

    if (primary) {
      id = 0;
      dot.classList.add("primary");

      const existingPrimaryDot = this.dots.find(d => d.ID === 0);
      if (existingPrimaryDot) {
        existingPrimaryDot.ID = this.dots.length;
        existingPrimaryDot.element.classList.remove("primary");
      }
    }

    const colorFromPos = this.getColorFromPosition(
      relativePosition.x,
      relativePosition.y,
      dotData.type
    );
    dot.style.setProperty(
      "--zen-theme-picker-dot-color",
      `rgb(${colorFromPos[0]}, ${colorFromPos[1]}, ${colorFromPos[2]})`
    );
    dot.setAttribute(
      "data-position",
      this.getJSONPos(relativePosition.x, relativePosition.y)
    );
    dot.setAttribute("data-type", dotData.type);

    this.dots.push({
      ID: id,
      element: dot,
      position: { x: relativePosition.x, y: relativePosition.y },
      lightness: this.#currentLightness,
      type: dotData.type,
    });
  }

  calculateCompliments(dots, action = "update", useHarmony = "") {
    const colorHarmonies = this.colorHarmonies;

    if (dots.length === 0) {
      return [];
    }

    /* eslint-disable no-shadow */
    function getColorHarmonyType(numDots, dots) {
      if (useHarmony !== "") {
        const selectedHarmony = colorHarmonies.find(
          harmony => harmony.type === useHarmony
        );

        if (selectedHarmony) {
          if (action === "remove") {
            if (dots.length !== 0) {
              return colorHarmonies.find(
                harmony =>
                  harmony.angles.length === selectedHarmony.angles.length - 1
              );
            }
            return { type: "floating", angles: [] };
          }
          if (action === "add") {
            return colorHarmonies.find(
              harmony =>
                harmony.angles.length === selectedHarmony.angles.length + 1
            );
          }
          if (action === "update") {
            return selectedHarmony;
          }
        }
      }

      if (action === "remove") {
        let harmony = colorHarmonies.find(h => h.angles.length === numDots);
        // If we are coming from 3 analogous dots, we should now go to singleAnalogous if
        // there are 2 dots left
        if (harmony.type === "analogous" && numDots === 1) {
          harmony = colorHarmonies.find(h => h.type === "singleAnalogous");
        }
        return harmony;
      }
      if (action === "add") {
        return colorHarmonies.find(h => h.angles.length + 1 === numDots);
      }
      if (action === "update") {
        return colorHarmonies.find(h => h.angles.length + 1 === numDots);
      }
      return null;
    }

    function getAngleFromPosition(position, centerPosition) {
      let deltaX = position.x - centerPosition.x;
      let deltaY = position.y - centerPosition.y;
      let angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
      return (angle + 360) % 360;
    }

    function getDistanceFromCenter(position, centerPosition) {
      const deltaX = position.x - centerPosition.x;
      const deltaY = position.y - centerPosition.y;
      return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    }

    const dotPad = this.panel.querySelector(".zen-theme-picker-gradient");
    const rect = window.windowUtils.getBoundsWithoutFlushing(dotPad);
    const padding = 0;

    let updatedDots = [...dots];
    const centerPosition = { x: rect.width / 2, y: rect.height / 2 };

    const harmonyAngles = getColorHarmonyType(
      /* eslint-disable no-nested-ternary */
      dots.length + (action === "add" ? 1 : action === "remove" ? -1 : 0),
      this.dots
    );
    this.useAlgo = harmonyAngles.type;
    if (!harmonyAngles || harmonyAngles.angles.length === 0) {
      return dots;
    }

    let primaryDot = dots.find(dot => dot.ID === 0);
    if (!primaryDot) {
      return [];
    }

    if (action === "add" && this.dots.length) {
      updatedDots.push({ ID: this.dots.length, position: centerPosition });
    }
    const baseAngle = getAngleFromPosition(primaryDot.position, centerPosition);
    let distance = getDistanceFromCenter(primaryDot.position, centerPosition);
    const radius = (rect.width - padding) / 2;
    if (distance > radius) {
      distance = radius;
    }
    if (this.dots.length) {
      updatedDots = [
        {
          ID: 0,
          position: primaryDot.position,
          type: primaryDot.type,
        },
      ];
    }

    harmonyAngles.angles.forEach((angleOffset, index) => {
      let newAngle = (baseAngle + angleOffset) % 360;
      let radian = (newAngle * Math.PI) / 180;

      let newPosition = {
        x: centerPosition.x + distance * Math.cos(radian),
        y: centerPosition.y + distance * Math.sin(radian),
      };

      updatedDots.push({
        ID: index + 1,
        position: newPosition,
        type: primaryDot.type,
      });
    });

    return updatedDots;
  }

  handleColorPositions(colorPositions, ignoreLegacy = false) {
    colorPositions.sort((a, b) => a.ID - b.ID);

    if (this.isLegacyVersion && !ignoreLegacy) {
      this.isLegacyVersion = false;
      Services.prefs.setIntPref("zen.theme.gradient-legacy-version", 1);
    }

    colorPositions.forEach(dotPosition => {
      const existingDot = this.dots.find(dot => dot.ID === dotPosition.ID);

      if (existingDot) {
        existingDot.type = dotPosition.type;
        existingDot.position = dotPosition.position;
        const colorFromPos = this.getColorFromPosition(
          dotPosition.position.x,
          dotPosition.position.y,
          dotPosition.type
        );
        existingDot.lightness = this.#currentLightness;
        existingDot.element.style.setProperty(
          "--zen-theme-picker-dot-color",
          `rgb(${colorFromPos[0]}, ${colorFromPos[1]}, ${colorFromPos[2]})`
        );
        existingDot.element.setAttribute(
          "data-position",
          this.getJSONPos(dotPosition.position.x, dotPosition.position.y)
        );
        existingDot.element.setAttribute("data-type", dotPosition.type);

        if (!this.dragging) {
          gZenUIManager.motion.animate(
            existingDot.element,
            {
              left: existingDot.element.style.left
                ? [
                    existingDot.element.style.left,
                    `${dotPosition.position.x}px`,
                  ]
                : `${dotPosition.position.x}px`,
              top: existingDot.element.style.top
                ? [existingDot.element.style.top, `${dotPosition.position.y}px`]
                : `${dotPosition.position.y}px`,
            },
            {
              duration: 0.4,
              type: "spring",
              bounce: 0.3,
            }
          );
        } else {
          existingDot.element.style.left = `${dotPosition.position.x}px`;
          existingDot.element.style.top = `${dotPosition.position.y}px`;
        }
      } else {
        this.spawnDot({
          type: dotPosition.type,
          ...dotPosition.position,
        });
      }
    });
  }

  onThemePickerClick(event) {
    if (this._rotating) {
      return;
    }
    if (event.target.closest("#PanelUI-zen-gradient-generator-scheme")) {
      return;
    }
    event.preventDefault();
    const target = event.target;
    if (target.id === "PanelUI-zen-gradient-generator-color-add") {
      if (this.dots.length >= nsZenThemePicker.MAX_DOTS) {
        return;
      }
      let colorPositions = this.calculateCompliments(
        this.dots,
        "add",
        this.useAlgo
      );

      this.handleColorPositions(colorPositions);
      this.updateCurrentWorkspace();
      return;
    } else if (target.id === "PanelUI-zen-gradient-generator-color-remove") {
      this.dots.sort((a, b) => a.ID - b.ID);
      if (this.dots.length === 0) {
        return;
      }

      const lastDot = this.dots.pop();
      lastDot.element.remove();

      this.dots.forEach((dot, index) => {
        dot.ID = index;
        if (index === 0) {
          dot.element.classList.add("primary");
        } else {
          dot.element.classList.remove("primary");
        }
      });

      let colorPositions = this.calculateCompliments(this.dots, "remove");
      this.handleColorPositions(colorPositions);
      this.updateCurrentWorkspace();
      return;
    } else if (
      target.id === "PanelUI-zen-gradient-generator-color-toggle-algo"
    ) {
      const applicableHarmonies = this.colorHarmonies.filter(
        harmony => harmony.angles.length + 1 === this.dots.length
      );

      let currentIndex = applicableHarmonies.findIndex(
        harmony => harmony.type === this.useAlgo
      );

      const nextIndex =
        currentIndex === -1
          ? 0
          : (currentIndex + 1) % applicableHarmonies.length;
      this.useAlgo = applicableHarmonies[nextIndex].type;

      let colorPositions = this.calculateCompliments(
        this.dots,
        "update",
        this.useAlgo
      );
      this.handleColorPositions(colorPositions);
      this.updateCurrentWorkspace();
      return;
    }

    if (event.button !== 0 || this.dragging || this.recentlyDragged) {
      return;
    }

    const gradient = this.panel.querySelector(".zen-theme-picker-gradient");
    const rect = window.windowUtils.getBoundsWithoutFlushing(gradient);
    const padding = 0;

    const centerX = rect.left + rect.width / 2 - padding;
    const centerY = rect.top + rect.height / 2 - padding;
    const radius = (rect.width - padding) / 2;
    let pixelX = event.clientX;
    let pixelY = event.clientY;

    const clickedElement = event.target;
    let clickedDot = null;
    const existingPrimaryDot = this.dots.find(d => d.ID === 0);

    clickedDot = this.dots.find(dot => dot.element === clickedElement);

    if (clickedDot) {
      // TODO: this doesnt work and needs to be fixed
      existingPrimaryDot.ID = clickedDot.ID;
      clickedDot.ID = 0;
      clickedDot.element.style.zIndex = 999;

      let colorPositions = this.calculateCompliments(
        this.dots,
        "update",
        this.useAlgo
      );
      this.handleColorPositions(colorPositions);
      return;
    }

    const distance = Math.sqrt(
      (pixelX - centerX) ** 2 + (pixelY - centerY) ** 2
    );
    if (distance > radius) {
      const angle = Math.atan2(pixelY - centerY, pixelX - centerX);
      pixelX = centerX + Math.cos(angle) * radius;
      pixelY = centerY + Math.sin(angle) * radius;
    }

    const relativeX = pixelX - rect.left;
    const relativeY = pixelY - rect.top;

    if (!clickedDot && this.dots.length < 1) {
      this.spawnDot({ x: relativeX, y: relativeY }, this.dots.length === 0);

      this.updateCurrentWorkspace(true);
    } else if (!clickedDot && existingPrimaryDot) {
      existingPrimaryDot.position = {
        x: relativeX,
        y: relativeY,
      };

      let colorPositions = this.calculateCompliments(
        this.dots,
        "update",
        this.useAlgo
      );
      this.handleColorPositions(colorPositions);
      this.updateCurrentWorkspace(true);

      gZenUIManager.motion.animate(
        existingPrimaryDot.element,
        {
          left: `${existingPrimaryDot.position.x}px`,
          top: `${existingPrimaryDot.position.y}px`,
        },
        {
          duration: 0.4,
          type: "spring",
          bounce: 0.3,
        }
      );
    }
  }

  onDotMouseDown(event) {
    if (event.button === 2) {
      return;
    }
    const draggedDot = this.dots.find(dot => dot.element === event.target);
    if (draggedDot) {
      event.preventDefault();
      this.dragging = true;
      this.draggedDot = event.target;
      this.draggedDot.classList.add("dragging");
    }

    // Store the starting position of the drag
    this.dragStartPosition = {
      x: event.clientX,
      y: event.clientY,
    };
  }

  onDotMouseUp(event) {
    if (this._rotating) {
      return;
    }
    if (event.button === 2) {
      if (!event.target.classList.contains("zen-theme-picker-dot")) {
        return;
      }
      this.dots = this.dots.filter(dot => dot.element !== event.target);
      event.target.remove();

      this.dots.sort((a, b) => a.ID - b.ID);

      // Reassign the IDs after sorting
      this.dots.forEach((dot, index) => {
        dot.ID = index;
        if (index === 0) {
          dot.element.classList.add("primary");
        } else {
          dot.element.classList.remove("primary");
        }
      });

      let colorPositions = this.calculateCompliments(this.dots, "remove");
      this.handleColorPositions(colorPositions);

      this.updateCurrentWorkspace();
      return;
    }

    if (this.dragging) {
      event.preventDefault();
      event.stopPropagation();
      this.dragging = false;
      this.draggedDot.classList.remove("dragging");
      this.draggedDot = null;
      this.dragStartPosition = null; // Reset the drag start position

      this.recentlyDragged = true;
      setTimeout(() => {
        this.recentlyDragged = false;
      }, 100);
    }
  }

  onDotMouseMove(event) {
    if (this.dragging) {
      event.preventDefault();
      const rect = window.windowUtils.getBoundsWithoutFlushing(
        this.panel.querySelector(".zen-theme-picker-gradient")
      );
      const padding = 0; // each side
      // do NOT let the ball be draged outside of an imaginary circle. You can drag it anywhere inside the circle
      // if the distance between the center of the circle and the dragged ball is bigger than the radius, then the ball
      // should be placed on the edge of the circle. If it's inside the circle, then the ball just follows the mouse

      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const radius = (rect.width - padding) / 2;
      let pixelX = event.clientX;
      let pixelY = event.clientY;
      const distance = Math.sqrt(
        (pixelX - centerX) ** 2 + (pixelY - centerY) ** 2
      );
      if (distance > radius) {
        const angle = Math.atan2(pixelY - centerY, pixelX - centerX);
        pixelX = centerX + Math.cos(angle) * radius;
        pixelY = centerY + Math.sin(angle) * radius;
      }

      // set the location of the dot in pixels
      const relativeX = pixelX - rect.left;
      const relativeY = pixelY - rect.top;

      const draggedDot = this.dots.find(dot => dot.element === this.draggedDot);
      draggedDot.element.style.left = `${relativeX}px`;
      draggedDot.element.style.top = `${relativeY}px`;
      draggedDot.position = {
        x: relativeX,
        y: relativeY,
      };
      let colorPositions = this.calculateCompliments(
        this.dots,
        "update",
        this.useAlgo
      );
      this.handleColorPositions(colorPositions);

      this.updateCurrentWorkspace();
    }
  }

  themedColors(colors) {
    // For non-Mica themes, we return the colors as they are
    return [...colors];
  }

  onOpacityChange(event) {
    this.currentOpacity = parseFloat(event.target.value);
    // If we reached a whole number (e.g., 0.1, 0.2, etc.), send a haptic feedback.
    if (Math.round(this.currentOpacity * 10) !== this._lastHapticFeedback) {
      Services.zen.playHapticFeedback();
      this._lastHapticFeedback = Math.round(this.currentOpacity * 10);
    }
    this.updateCurrentWorkspace();
  }

  getToolbarModifiedBaseRaw() {
    const opacity = this.#allowTransparencyOnSidebar ? 0.6 : 1;
    return this.isDarkMode ? [23, 23, 26, opacity] : [240, 240, 244, opacity];
  }

  getToolbarModifiedBase() {
    const baseColor = this.getToolbarModifiedBaseRaw();
    return `rgba(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]}, ${baseColor[3]})`;
  }

  get isMica() {
    return window.matchMedia("(-moz-windows-mica)").matches;
  }

  get canBeTransparent() {
    return (
      this.isMica ||
      window.matchMedia(
        '(-moz-platform: macos) or ((-moz-platform: linux) and -moz-pref("zen.widget.linux.transparency"))'
      ).matches
    );
  }

  // Position of the intensity slider inside its allowed range, 0 to 1.
  get layerIntensity() {
    const range = lazy.MAX_OPACITY - lazy.MIN_OPACITY;
    if (!range) {
      return 1;
    }
    return Math.min(
      1,
      Math.max(0, (this.currentOpacity - lazy.MIN_OPACITY) / range)
    );
  }

  // Alpha of the colour layer over the underlay.
  get layerAlpha() {
    return (
      kMinLayerAlpha +
      (kMaxLayerAlpha - kMinLayerAlpha) * this.layerIntensity ** 2
    );
  }

  get translucentLayerAlpha() {
    return (
      kMinTranslucentLayerAlpha +
      (kMaxLayerAlpha - kMinTranslucentLayerAlpha) * this.layerIntensity ** 2
    );
  }

  // Alpha used for the colour layer where the window itself shows through.
  get windowAlpha() {
    return (
      kMinWindowAlpha +
      (kMaxWindowAlpha - kMinWindowAlpha) * this.layerIntensity ** 2
    );
  }

  get underlay() {
    return [255, 255, 255];
  }

  // Composites an [r, g, b] colour over the underlay at the current layer
  // alpha, which is the colour that ends up painted.
  compositeOverUnderlay(rgb, alpha = this.layerAlpha) {
    const underlay = this.underlay;
    return rgb.map((channel, i) =>
      Math.round(channel * alpha + underlay[i] * (1 - alpha))
    );
  }

  #compositeExact(rgb, alpha) {
    const underlay = this.underlay;
    return rgb.map((channel, i) => channel * alpha + underlay[i] * (1 - alpha));
  }

  mixInLinear(rgb1, rgb2, t) {
    return rgb1.map((v, i) =>
      linearToSrgb(
        srgbToLinear(v) + (srgbToLinear(rgb2[i]) - srgbToLinear(v)) * t
      )
    );
  }

  mixBase(rgb1, rgb2, t, via = null) {
    const lab1 = rgbToOklab(rgb1);
    const lab2 = rgbToOklab(rgb2);
    const plain = lab1.map((v, i) => v + (lab2[i] - v) * t);
    const [c1, c2] = [
      Math.hypot(lab1[1], lab1[2]),
      Math.hypot(lab2[1], lab2[2]),
    ];
    const [h1, h2] = [
      Math.atan2(lab1[2], lab1[1]),
      Math.atan2(lab2[2], lab2[1]),
    ];
    const wrap = angle => {
      while (angle > Math.PI) {
        angle -= 2 * Math.PI;
      }
      while (angle < -Math.PI) {
        angle += 2 * Math.PI;
      }
      return angle;
    };
    let dh = wrap(h2 - h1);
    const labVia = via && rgbToOklab(via);
    if (labVia && Math.hypot(labVia[1], labVia[2]) > 1e-4) {
      const toVia = wrap(Math.atan2(labVia[2], labVia[1]) - h1);
      const onShortArc =
        dh >= 0 ? toVia >= 0 && toVia <= dh : toVia <= 0 && toVia >= dh;
      if (!onShortArc) {
        dh -= Math.sign(dh || 1) * 2 * Math.PI;
      }
    }
    // Ease the hue so the gradient lingers near both end hues and crosses the
    // ones in between more quickly, keeping them a tint rather than a band.
    const smooth = t * t * (3 - 2 * t);
    const eased = t + (smooth - t) * kGradientHueEase;
    // A colour with no chroma has no hue of its own, so follow the other one.
    const hue = c1 < 1e-4 ? h2 : c2 < 1e-4 ? h1 : h1 + dh * eased;
    const chroma = c1 + (c2 - c1) * t;
    const vivid = [plain[0], chroma * Math.cos(hue), chroma * Math.sin(hue)];
    return oklabToRgb(
      plain.map((v, i) => v + (vivid[i] - v) * kGradientChroma)
    );
  }

  mixInOklab(rgb1, rgb2, t) {
    const lab1 = rgbToOklab(rgb1);
    const lab2 = rgbToOklab(rgb2);
    return oklabToRgb(lab1.map((v, i) => v + (lab2[i] - v) * t));
  }

  #colorToRGB(color) {
    if (typeof color.c !== "string") {
      return color.c;
    }
    const rgba = InspectorUtils.colorToRGBA(color.c, document);
    return rgba ? [rgba.r, rgba.g, rgba.b] : [0, 0, 0];
  }

  #isTranslucent(forToolbar = false) {
    return forToolbar
      ? this.#allowTransparencyOnSidebar
      : this.canBeTransparent;
  }

  #paint(rgb, forToolbar = false) {
    return this.#compositeExact(rgb, this.#paintAlpha(forToolbar));
  }

  #paintAlpha(forToolbar = false) {
    return this.#isTranslucent(forToolbar)
      ? this.translucentLayerAlpha
      : this.layerAlpha;
  }

  #colorStop(rgb, forToolbar = false, alphaScale = 1) {
    const [r, g, b] = this.compositeOverUnderlay(
      rgb,
      this.#paintAlpha(forToolbar)
    );
    if (this.#isTranslucent(forToolbar)) {
      const alpha = this.windowAlpha * alphaScale;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return alphaScale === 1
      ? `rgb(${r}, ${g}, ${b})`
      : `rgba(${r}, ${g}, ${b}, ${alphaScale})`;
  }

  #baseMixAt(u, v) {
    const tan = 1 / kOverlayReferenceAspect;
    const dx = Math.min(1, 1 / tan);
    const dy = Math.min(1, tan);
    const ax = 0.5 - dx / 2;
    const ay = 0.5 - dy / 2;
    const t = Math.min(
      1,
      Math.max(0, ((u - ax) * dx + (v - ay) * dy) / (dx * dx + dy * dy))
    );
    return Math.min(
      1,
      Math.max(
        0,
        (t - kBaseGradientStart) / (kBaseGradientEnd - kBaseGradientStart)
      )
    );
  }

  #overlayLayers(rgbs, forToolbar = false) {
    const layers = [];
    const width = `round(up, var(--zen-gradient-width) / ${kOverlayStrips}, 1px)`;
    for (let i = 0; i < kOverlayStrips; i++) {
      const u = (i + 0.5) / kOverlayStrips;
      const stops = [`transparent ${kOverlayStart * 100}%`];
      for (let j = 1; j < kGradientStops; j++) {
        const t = j / (kGradientStops - 1);
        const v = kOverlayStart + t * (kOverlayEnd - kOverlayStart);
        const base = this.mixBase(
          rgbs[0],
          rgbs[1],
          this.#baseMixAt(u, v),
          rgbs[2]
        );
        const [color, alpha] = this.#solveOverlayStop(
          base,
          rgbs[2],
          t,
          forToolbar
        );
        stops.push(
          `${this.#paintedStop(color, alpha, forToolbar)} ${(v * 100).toFixed(1)}%`
        );
      }
      layers.push(
        `linear-gradient(${kOverlayAngle}deg, ${stops.join(", ")}) calc(${i} * ${width}) 0 / ${width} 100% no-repeat`
      );
    }
    return layers;
  }

  #solveOverlayStop(base, overlay, t, forToolbar = false) {
    const under = this.#paint(base, forToolbar);
    const target = this.#paint(
      this.mixInLinear(base, overlay, t * kOverlayMaxAlpha),
      forToolbar
    );
    let alpha = t * kOverlayMaxAlpha;
    for (let channel = 0; channel < 3; channel++) {
      const u = under[channel];
      const v = target[channel];
      if (v < u && u > 0) {
        alpha = Math.max(alpha, (u - v) / u);
      } else if (v > u && u < 255) {
        alpha = Math.max(alpha, (v - u) / (255 - u));
      }
    }
    alpha = Math.min(1, alpha);
    const color = target.map((v, channel) =>
      Math.min(255, Math.max(0, (v - under[channel] * (1 - alpha)) / alpha))
    );
    return [color, alpha];
  }

  #paintedStop(rgb, alpha, forToolbar) {
    const [r, g, b] = rgb.map(v => v.toFixed(2));
    const value = this.#isTranslucent(forToolbar)
      ? this.windowAlpha * alpha
      : alpha;
    return `rgba(${r}, ${g}, ${b}, ${value.toFixed(4)})`;
  }

  #getSingleRGBColor(color, forToolbar = false) {
    return this.#colorStop(this.#colorToRGB(color), forToolbar);
  }

  luminance([r, g, b]) {
    // These magic numbers are extracted from the wikipedia article on relative luminance
    // https://en.wikipedia.org/wiki/Relative_luminance
    var a = [r, g, b].map(v => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
  }

  contrastRatio(rgb1, rgb2) {
    const lum1 = this.luminance(rgb1);
    const lum2 = this.luminance(rgb2);
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    return (brightest + 0.05) / (darkest + 0.05);
  }

  blendColors(rgb1, rgb2, percentage) {
    const p = percentage / 100;
    return [
      Math.round(rgb1[0] * p + rgb2[0] * (1 - p)),
      Math.round(rgb1[1] * p + rgb2[1] * (1 - p)),
      Math.round(rgb1[2] * p + rgb2[2] * (1 - p)),
    ];
  }

  getGradient(colors, forToolbar = false) {
    const themedColors = this.themedColors(colors);
    this.useAlgo = themedColors[0]?.algorithm ?? "";
    this.#currentLightness = themedColors[0]?.lightness ?? 50;

    if (themedColors.length === 0) {
      const getBrowserBg = () => {
        if (this.canBeTransparent) {
          if (this.isDarkMode) {
            return "rgba(0, 0, 0, 0.4)";
          }
          // On macOS (vibrancy) and Windows (Mica) a transparent light background
          // sits over a compositor material that keeps UI text readable. Linux has no
          // such material when zen.widget.linux.transparency is enabled, so a fully
          // transparent light theme leaves dark UI text unreadable (gh-15334).
          return AppConstants.platform === "linux"
            ? "rgba(255, 255, 255, 0.4)"
            : "transparent";
        }
        return this.isDarkMode ? "#131313" : "#e9e9e9";
      };
      return forToolbar ? this.getToolbarModifiedBase() : getBrowserBg();
    } else if (themedColors.length === 1) {
      return this.#getSingleRGBColor(themedColors[0], forToolbar);
    }
    const ordered = [...themedColors].sort(
      (a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0)
    );
    const rgbs = ordered.map(color => this.#colorToRGB(color));
    const baseStops = [];
    for (let i = 0; i < kGradientStops; i++) {
      const position = i / (kGradientStops - 1);
      const color = this.#colorStop(
        this.mixBase(
          rgbs[0],
          rgbs[1],
          Math.min(
            1,
            Math.max(
              0,
              (position - kBaseGradientStart) /
                (kBaseGradientEnd - kBaseGradientStart)
            )
          ),
          rgbs[2]
        ),
        forToolbar
      );
      baseStops.push(
        `${color} calc(var(--zen-gradient-base-start) + ${position} * var(--zen-gradient-base-span))`
      );
    }
    const layers = [
      `linear-gradient(var(--zen-gradient-base-angle), ${baseStops.join(", ")}) 0 0 / 100% 100% no-repeat`,
    ];
    if (rgbs.length > 2) {
      layers.unshift(...this.#overlayLayers(rgbs, forToolbar));
    }
    return layers.join(", ");
  }

  shouldBeDarkMode(accentColor) {
    if (Services.prefs.getBoolPref("zen.theme.use-system-colors")) {
      return this.isDarkMode;
    }

    const bg = this.canBeTransparent
      ? accentColor
      : this.compositeOverUnderlay(accentColor);
    const titles = this.titleColors(accentColor);
    const bias = this.canBeTransparent ? parseFloat(this.darkModeBias) || 0 : 0;
    const darkText = this.blendColors(titles.dark, bg, kTextOpacity * 100);
    const lightText = this.blendColors(
      titles.light,
      bg,
      (kTextOpacity - bias) * 100
    );

    const darkContrast = this.contrastRatio(bg, darkText);
    const lightContrast = this.contrastRatio(bg, lightText);

    return darkContrast > lightContrast;
  }

  static getTheme(
    colors = [],
    opacity = 0.5,
    texture = 0,
    textureType = kDefaultTexture
  ) {
    return {
      type: "gradient",
      gradientColors: colors ? colors.filter(color => color) : [], // remove undefined
      opacity,
      texture,
      textureType,
    };
  }

  updateNoise(texture, textureType = kDefaultTexture) {
    if (
      texture === this.#lastNoiseTexture &&
      textureType === this.#lastNoiseTextureType
    ) {
      return;
    }
    this.#lastNoiseTexture = texture;
    this.#lastNoiseTextureType = textureType;
    for (const element of [
      lazy.browserBackgroundElement,
      lazy.toolbarBackgroundElement,
    ]) {
      this.setGrainLayer(element, texture, textureType);
    }
  }

  setGrainLayer(
    element,
    texture,
    textureType = kDefaultTexture,
    { old = false } = {}
  ) {
    const suffix = old ? "-old" : "";
    element.setAttribute(`zen-grain-texture${suffix}`, textureType);
    element.style.setProperty(
      `--zen-grainy-background-opacity${suffix}`,
      texture
    );
    const strength = slot =>
      parseFloat(
        element.style.getPropertyValue(`--zen-grainy-background-opacity${slot}`)
      ) || 0;
    element.setAttribute(
      "zen-show-grainy-background",
      strength("") > 0 || strength("-old") > 0 ? "true" : "false"
    );
  }

  keepGrainAsOld(element) {
    this.setGrainLayer(
      element,
      parseFloat(
        element.style.getPropertyValue("--zen-grainy-background-opacity")
      ) || 0,
      element.getAttribute("zen-grain-texture") ?? kDefaultTexture,
      { old: true }
    );
  }

  hexToRgb(hex) {
    if (hex.startsWith("#")) {
      hex = hex.substring(1);
    }
    if (hex.length === 3) {
      hex = hex
        .split("")
        .map(char => char + char)
        .join("");
    }
    return [
      parseInt(hex.substring(0, 2), 16),
      parseInt(hex.substring(2, 4), 16),
      parseInt(hex.substring(4, 6), 16),
    ];
  }

  getAccentColorForUI(accentColor, isDarkMode) {
    let [r, g, b] = accentColor;
    if (isDarkMode) {
      return `rgb(${r}, ${g}, ${b})`;
    }
    // gh-15142: Special case for grayscale colors
    if (r == g && g == b) {
      return `rgb(${r}, ${g}, ${b})`;
    }
    const [h, s, l] = this.rgbToHsl(...accentColor);
    const saturation = Math.min(1, s + 0.3);
    const targetLightness = this.isDarkMode ? 0.62 : 0.42;
    const lightness = l * 0.4 + targetLightness * 0.6;
    [r, g, b] = this.hslToRgb(h / 360, saturation, lightness);
    return `rgb(${r}, ${g}, ${b})`;
  }

  titleColors(accentColor) {
    return {
      light: this.blendColors(accentColor, [0, 0, 0], kTextTint * 100),
      dark: this.blendColors(accentColor, [255, 255, 255], kTextTint * 100),
    };
  }

  // The toolbar text colour as a style map, for the window, space elements
  // and library previews alike.
  toolbarTextStyles(accentColor, isDarkMode) {
    const titles = this.titleColors(accentColor);
    const [r, g, b] = isDarkMode ? titles.dark : titles.light;
    return { "--toolbox-textcolor": `rgba(${r}, ${g}, ${b}, ${kTextOpacity})` };
  }

  getMostDominantColor(allColors) {
    const color = this.getPrimaryColor(allColors);
    if (typeof color === "string") {
      // We found a custom color, we should rather return the native accent color
      return this.getNativeAccentColor();
    }
    return color;
  }

  get browserBackgroundElement() {
    return lazy.browserBackgroundElement;
  }

  get toolbarBackgroundElement() {
    return lazy.toolbarBackgroundElement;
  }

  onWorkspaceChange(workspace, skipUpdate = false, theme = null) {
    const uuid = workspace.uuid;
    // Use theme from workspace object or passed theme
    let workspaceTheme = theme || workspace.theme;

    /* eslint-disable complexity */
    this.forEachWindowSync(browser => {
      if (!browser.gZenThemePicker?.promiseInitialized) {
        return;
      }

      if (browser.closing) {
        return;
      }

      if (theme === null) {
        browser.gZenThemePicker.invalidateGradientCache(uuid);
      }

      // Only rebuild for the workspace the window shows, or the one its
      // picker is editing without showing it.
      const windowWorkspace = browser.gZenWorkspaces.getActiveWorkspace();
      const appliesToWindow = windowWorkspace.uuid === uuid;
      if (
        !appliesToWindow &&
        browser.gZenThemePicker.editingWorkspaceId !== uuid
      ) {
        return;
      }

      // get the theme from the window
      workspaceTheme = this.fixTheme(
        theme || (appliesToWindow ? windowWorkspace : workspace).theme
      );
      const docElement = browser.document.documentElement;

      if (!skipUpdate) {
        for (const dot of browser.gZenThemePicker.panel.querySelectorAll(
          ".zen-theme-picker-dot"
        )) {
          dot.remove();
        }
      }

      if (theme && appliesToWindow) {
        const workspaceElement = browser.gZenWorkspaces.workspaceElement(
          windowWorkspace.uuid
        );
        if (workspaceElement) {
          workspaceElement.clearThemeStyles();
        }
      }

      if (!skipUpdate && appliesToWindow) {
        let backgroundElement =
          browser.gZenThemePicker.browserBackgroundElement;
        let toolbarElement = browser.gZenThemePicker.toolbarBackgroundElement;
        backgroundElement.style.setProperty(
          "--zen-main-browser-background-old",
          backgroundElement.style.getPropertyValue(
            "--zen-main-browser-background"
          )
        );
        toolbarElement.style.setProperty(
          "--zen-main-browser-background-toolbar-old",
          toolbarElement.style.getPropertyValue(
            "--zen-main-browser-background-toolbar"
          )
        );
        [backgroundElement, toolbarElement].forEach(element => {
          browser.gZenThemePicker.keepGrainAsOld(element);
          element.style.setProperty(
            "--zen-background-opacity",
            browser.gZenThemePicker.previousBackgroundOpacity ?? 1
          );
        });
        if (browser.gZenThemePicker.previousBackgroundResolve) {
          browser.gZenThemePicker.previousBackgroundResolve();
        }
        delete browser.gZenThemePicker.previousBackgroundOpacity;
      }

      browser.gZenThemePicker.resetCustomColorList();

      browser.gZenThemePicker.currentOpacity = workspaceTheme.opacity ?? 0.5;
      browser.gZenThemePicker.currentTexture = workspaceTheme.texture ?? 0;
      browser.gZenThemePicker.currentTextureType =
        workspaceTheme.textureType ?? kDefaultTexture;

      let dominantColor = this.getMostDominantColor(
        workspaceTheme.gradientColors
      );
      const isDefaultTheme = !dominantColor;
      if (isDefaultTheme) {
        dominantColor = this.getNativeAccentColor();
      }

      const opacitySlider = browser.document.getElementById(
        "PanelUI-zen-gradient-generator-opacity"
      );

      {
        let opacity = browser.gZenThemePicker.currentOpacity;
        const svg = browser.gZenThemePicker.sliderWavePath;
        /* eslint-disable no-unused-vars */
        const [_, secondStop, thirdStop] = document.querySelectorAll(
          "#PanelUI-zen-gradient-generator-slider-wave-gradient stop"
        );
        // Opacity can only be between lazy.MIN_OPACITY to lazy.MAX_OPACITY. Make opacity relative to that range
        if (opacity < lazy.MIN_OPACITY) {
          opacity = 0;
        } else if (opacity > lazy.MAX_OPACITY) {
          opacity = 1;
        } else {
          opacity =
            (opacity - lazy.MIN_OPACITY) /
            (lazy.MAX_OPACITY - lazy.MIN_OPACITY);
        }
        if (isDefaultTheme) {
          opacity = 1; // If it's the default theme, we want the wave to be
        }
        // Since it's sine waves, we can't just set the offset to the opacity, we need to calculate it
        // The offset is the percentage of the wave that is visible, so we need to multiply
        // the opacity by 100 to get the percentage.
        // Set the offset of the stops
        secondStop.setAttribute("offset", `${opacity * 100}%`);
        thirdStop.setAttribute("offset", `${opacity * 100}%`);
        const interpolatedPath = this.#interpolateWavePath(opacity);
        svg.setAttribute("d", interpolatedPath);
        opacitySlider.style.setProperty(
          "--zen-thumb-height",
          `${40 + opacity * 15}px`
        );
        opacitySlider.style.setProperty(
          "--zen-thumb-width",
          `${10 + opacity * 15}px`
        );
        svg.style.stroke =
          interpolatedPath === this.#linePath
            ? thirdStop.getAttribute("stop-color")
            : "url(#PanelUI-zen-gradient-generator-slider-wave-gradient)";
      }

      for (const button of browser.document.querySelectorAll(
        "#PanelUI-zen-gradient-generator-color-actions button"
      )) {
        // disable if there are no buttons
        button.disabled =
          workspaceTheme.gradientColors.length === 0 ||
          (button.id === "PanelUI-zen-gradient-generator-color-add"
            ? workspaceTheme.gradientColors.length >= nsZenThemePicker.MAX_DOTS
            : false) ||
          (button.id === "PanelUI-zen-gradient-generator-color-toggle-algo"
            ? workspaceTheme.gradientColors.length < 2
            : false);
      }
      const clickToAdd = browser.document.getElementById(
        "PanelUI-zen-gradient-generator-color-click-to-add"
      );
      if (workspaceTheme.gradientColors.length) {
        clickToAdd.setAttribute("hidden", "true");
      } else {
        clickToAdd.removeAttribute("hidden");
      }

      opacitySlider.value = browser.gZenThemePicker.currentOpacity;
      const textureSelectWrapper = browser.document.getElementById(
        "PanelUI-zen-gradient-generator-texture-wrapper"
      );
      textureSelectWrapper.setAttribute(
        "zen-grain-texture",
        browser.gZenThemePicker.currentTextureType
      );
      const textureWrapperWidth =
        browser.windowUtils.getBoundsWithoutFlushing(
          textureSelectWrapper
        ).width;
      // Dont show when hidden
      if (textureWrapperWidth) {
        // rotate and trasnform relative to the wrapper width depending on the texture value
        let textureValue = this.currentTexture;
        let textureHandler = browser.gZenThemePicker._textureHandler;
        let rotation = textureValue * 360 - 90;
        textureHandler.style.transform = `rotate(${rotation + 90}deg)`;
        // add top and left to center the texture handler in relation with textureWrapperWidth
        // based on the rotation
        /* eslint-disable no-shadow */
        let top =
          Math.sin((rotation * Math.PI) / 180) * (textureWrapperWidth / 2) - 6;
        let left =
          Math.cos((rotation * Math.PI) / 180) * (textureWrapperWidth / 2) - 3;
        textureHandler.style.top = `${textureWrapperWidth / 2 + top}px`;
        textureHandler.style.left = `${textureWrapperWidth / 2 + left}px`;
        // Highlight the 16 buttons based on the texture value
        let buttons = browser.document.querySelectorAll(
          ".zen-theme-picker-texture-dot"
        );
        let i = 4;
        for (const button of buttons) {
          button.classList.toggle("active", i / 16 <= textureValue);
          i++;
          // We start at point 4 because that's the first point that is not in the middle of the texture
          if (i === 16) {
            i = 0;
          }
        }
      }

      const gradient = browser.gZenThemePicker.getGradient(
        workspaceTheme.gradientColors
      );
      const gradientToolbar = browser.gZenThemePicker.getGradient(
        workspaceTheme.gradientColors,
        true
      );
      if (appliesToWindow) {
        browser.gZenThemePicker.updateNoise(
          workspaceTheme.texture,
          workspaceTheme.textureType
        );
      }

      browser.gZenThemePicker.customColorList.innerHTML = "";
      for (const dot of workspaceTheme.gradientColors) {
        if (dot.isCustom) {
          browser.gZenThemePicker.addColorToCustomList(dot.c);
        }
      }

      if (appliesToWindow) {
        browser.gZenThemePicker.toolbarBackgroundElement.style.setProperty(
          "--zen-main-browser-background-toolbar",
          gradientToolbar
        );
        browser.gZenThemePicker.browserBackgroundElement.style.setProperty(
          "--zen-main-browser-background",
          gradient
        );
        const isDarkModeWindow = browser.gZenThemePicker.isDarkMode;
        if (isDefaultTheme) {
          docElement.setAttribute("zen-default-theme", "true");
        } else {
          docElement.removeAttribute("zen-default-theme");
        }
        if (dominantColor) {
          // Should be set to `this.isLegacyVersion` but for some reason it is set to undefined if we open a private window,
          // so instead get the pref value directly.
          browser.gZenThemePicker.isLegacyVersion =
            Services.prefs.getIntPref(
              "zen.theme.gradient-legacy-version",
              1
            ) === 0;

          let isDarkMode = isDarkModeWindow;
          if (!isDefaultTheme && !this.isLegacyVersion) {
            // Check for the primary color
            isDarkMode =
              browser.gZenThemePicker.shouldBeDarkMode(dominantColor);
            docElement.setAttribute("zen-should-be-dark-mode", isDarkMode);
            browser.gZenThemePicker.panel.removeAttribute(
              "invalidate-controls"
            );
          } else {
            docElement.removeAttribute("zen-should-be-dark-mode");
            if (!this.isLegacyVersion) {
              browser.gZenThemePicker.panel.setAttribute(
                "invalidate-controls",
                "true"
              );
            }
          }

          docElement.style.setProperty(
            "--zen-primary-color",
            this.getAccentColorForUI(dominantColor, isDarkMode)
          );
          for (const [property, value] of Object.entries(
            browser.gZenThemePicker.toolbarTextStyles(dominantColor, isDarkMode)
          )) {
            docElement.style.setProperty(property, value);
          }
          docElement.style.setProperty(
            "--toolbar-color-scheme",
            isDarkMode ? "dark" : "light"
          );
        }
      }

      if (!skipUpdate) {
        browser.gZenThemePicker.dots = [];
        browser.gZenThemePicker.recalculateDots(workspaceTheme.gradientColors);
      }
    });

    // Notify observers that gradient updated
    // note: We just notify if we are not skipping the update,
    //   because otherwise, it can get pretty laggy if we notify on every change
    //   when the user is dragging a dot.
    // TODO(cheff): We should probably find a better way to handle this
    if (!skipUpdate) {
      Services.obs.notifyObservers(null, "zen-space-gradient-update");
    }
  }

  fixTheme(theme) {
    // add a primary color if there isn't one
    if (
      !theme.gradientColors.find(color => color.isPrimary) &&
      theme.gradientColors.length
    ) {
      theme.gradientColors[0].isPrimary = true;
    }
    return theme;
  }

  #initNativeAccentColorInvalidation() {
    const invalidate = () => {
      this.#nativeAccentColorCache = null;
    };
    Services.obs.addObserver(invalidate, "look-and-feel-changed");
    Services.prefs.addObserver("zen.theme.accent-color", invalidate);
    window.addEventListener(
      "unload",
      () => {
        Services.obs.removeObserver(invalidate, "look-and-feel-changed");
        Services.prefs.removeObserver("zen.theme.accent-color", invalidate);
      },
      { once: true }
    );
  }

  /**
   * Resolves the raw `AccentColor` system color for this document.
   */
  #resolveSystemAccentColor() {
    const rgba = InspectorUtils.colorToRGBA("AccentColor", document);
    if (!rgba) {
      return [0, 0, 0];
    }
    return [rgba.r, rgba.g, rgba.b];
  }

  getNativeAccentColor() {
    let rgb = this.#nativeAccentColorCache;
    if (!rgb) {
      const accentColor = Services.prefs.getStringPref(
        "zen.theme.accent-color"
      );
      if (accentColor === "AccentColor") {
        rgb = this.blendColors(
          this.#resolveSystemAccentColor(),
          this.getToolbarModifiedBaseRaw().slice(0, 3),
          this.isDarkMode ? 80 : 50
        );
      } else {
        rgb = this.hexToRgb(accentColor);
      }
      this.#nativeAccentColorCache = rgb;
    }
    if (this.isDarkMode) {
      // If the theme is dark, we want to use a lighter color
      return this.blendColors(rgb, [0, 0, 0], 40);
    }
    return [...rgb];
  }

  resetCustomColorList() {
    this.customColorList.innerHTML = "";
  }

  removeCustomColor(event) {
    const target = event.target.closest(".zen-theme-picker-custom-list-item");
    const color = target.getAttribute("data-color");
    const dots = this.panel.querySelectorAll(".zen-theme-picker-dot");
    for (const dot of dots) {
      if (
        dot.style.getPropertyValue("--zen-theme-picker-dot-color") === color
      ) {
        dot.remove();
        break;
      }
    }
    target.remove();
    this.updateCurrentWorkspace();
  }

  getPrimaryColor(colors) {
    const primaryColor = colors.find(color => color.isPrimary);
    if (primaryColor) {
      return primaryColor.c;
    }
    if (colors.length === 0) {
      return undefined;
    }
    // Get the middle color
    return colors[Math.floor(colors.length / 2)].c;
  }

  recalculateDots(colors) {
    for (const color of colors) {
      this.createDot(color, true);
    }
  }

  #editingWorkspaceId = null;

  get editingWorkspaceId() {
    return this.#editingWorkspaceId;
  }

  get workspaceBeingEdited() {
    return (
      gZenWorkspaces.getWorkspaceFromId(this.#editingWorkspaceId) ??
      gZenWorkspaces.getActiveWorkspace()
    );
  }

  /**
   * Opens the picker for a space without switching to it.
   *
   * @param {object} workspace - The space to edit
   * @param {Element} anchor - Element to anchor the panel to
   * @param {Event} event - The triggering event
   */
  openThemePickerForWorkspace(workspace, anchor, event) {
    this.#editingWorkspaceId = workspace.uuid;
    this.onWorkspaceChange(workspace);
    this.panel.removeAttribute("hidepopovertail");
    PanelMultiView.openPopup(this.panel, anchor, {
      position: "bottomleft topleft",
      triggerEvent: event,
    });
  }

  updateCurrentWorkspace(skipSave = true) {
    this.updated = skipSave;
    const dots = this.panel.querySelectorAll(".zen-theme-picker-dot");
    const colors = Array.from(dots)
      .sort(
        (a, b) => a.getAttribute("data-index") - b.getAttribute("data-index")
      )
      .map(dot => {
        const color = dot.style.getPropertyValue(
          "--zen-theme-picker-dot-color"
        );
        const isPrimary = dot.classList.contains("primary");

        if (color === "undefined") {
          return null;
        }
        const isCustom = dot.classList.contains("custom");
        const algorithm = this.useAlgo;
        const position =
          dot.getAttribute("data-position") &&
          JSON.parse(dot.getAttribute("data-position"));
        const type = dot.getAttribute("data-type");
        return {
          c: isCustom ? color : color.match(/\d+/g).map(Number),
          isCustom,
          algorithm,
          isPrimary,
          lightness: this.#currentLightness,
          position,
          type,
        };
      })
      .filter(color => Boolean(color)); // remove nulls
    const gradient = nsZenThemePicker.getTheme(
      colors,
      this.currentOpacity,
      this.currentTexture,
      this.currentTextureType
    );
    let currentWorkspace = this.workspaceBeingEdited;

    currentWorkspace.theme = gradient;
    if (!skipSave) {
      gZenWorkspaces.saveWorkspace(currentWorkspace);
    }

    this.onWorkspaceChange(
      currentWorkspace,
      skipSave,
      skipSave ? gradient : null
    );
    if (currentWorkspace.uuid !== gZenWorkspaces.activeWorkspace) {
      this.invalidateGradientCache(currentWorkspace.uuid);
      Services.obs.notifyObservers(null, "zen-space-gradient-update");
    }
  }

  handlePanelClose() {
    if (this.updated) {
      this.updateCurrentWorkspace(false);
    }
    this.uninitThemePicker();
    if (this.#editingWorkspaceId) {
      this.#editingWorkspaceId = null;
      this.panel.setAttribute("hidepopovertail", "true");
      this.onWorkspaceChange(gZenWorkspaces.getActiveWorkspace());
    }
  }

  handlePanelOpen() {
    this.initThemePicker();
    setTimeout(() => {
      this.updateCurrentWorkspace();
    }, 200);
  }

  #interpolateWavePath(progress) {
    const linePath = this.#linePath;
    const sinePath = this.#sinePath;
    const referenceY = 27.3;
    if (this.#sinePoints.length === 0) {
      return progress < 0.5 ? linePath : sinePath;
    }
    if (progress <= 0.001) {
      return linePath;
    }
    if (progress >= 0.999) {
      return sinePath;
    }
    const t = progress;
    let newPathData = "";
    this.#sinePoints.forEach(p => {
      switch (p.type) {
        case "M": {
          const interpolatedY = referenceY + (p.y - referenceY) * t;
          newPathData += `M ${p.x} ${interpolatedY} `;
          break;
        }
        case "C": {
          const y1 = referenceY + (p.y1 - referenceY) * t;
          const y2 = referenceY + (p.y2 - referenceY) * t;
          const y = referenceY + (p.y - referenceY) * t;
          newPathData += `C ${p.x1} ${y1} ${p.x2} ${y2} ${p.x} ${y} `;
          break;
        }
        case "L":
          newPathData += `L ${p.x} ${p.y} `;
          break;
      }
    });
    return newPathData.trim();
  }

  invalidateGradientCache(uuid) {
    delete this.#gradientsCache[uuid];
    gZenWorkspaces.workspaceElement(uuid)?.onGradientCacheChanged();
  }

  getGradientForWorkspace(workspace, { getGradient = true } = {}) {
    const uuid = workspace.uuid;
    let cachedData = this.#gradientsCache[uuid];
    if (cachedData && !(getGradient && !cachedData.gradient)) {
      return cachedData;
    }
    const previousOpacity = this.currentOpacity;
    const previousLightness = this.#currentLightness;
    const previousAlgo = this.useAlgo;
    const theme = workspace.theme ?? {};
    const colors = theme.gradientColors ?? [];
    this.currentOpacity = theme.opacity ?? 0.5;
    this.#currentLightness = theme.lightness ?? 50;
    let gradient;
    let toolbarGradient;
    if (getGradient) {
      gradient = this.getGradient(colors);
      toolbarGradient = this.getGradient(colors, true);
    }
    let dominantColor = this.getMostDominantColor(colors);
    const isDefaultTheme = !dominantColor;
    if (isDefaultTheme) {
      dominantColor = this.getNativeAccentColor();
    }
    let isDarkMode = this.isDarkMode;
    let isExplicitMode = false;
    if (!isDefaultTheme && !this.isLegacyVersion) {
      // Check for the primary color
      isDarkMode = this.shouldBeDarkMode(dominantColor);
      isExplicitMode = true;
    }
    const primaryColor = this.getAccentColorForUI(dominantColor, isDarkMode);
    const paletteStyles = {
      ...this.toolbarTextStyles(dominantColor, isDarkMode),
      "--zen-primary-color": primaryColor,
    };
    this.#gradientsCache[uuid] = {
      gradient,
      toolbarGradient,
      grain: theme.texture ?? 0,
      grainTexture: theme.textureType ?? kDefaultTexture,
      isDarkMode,
      isExplicitMode,
      primaryColor,
      paletteStyles,
    };
    this.currentOpacity = previousOpacity;
    this.#currentLightness = previousLightness;
    this.useAlgo = previousAlgo;
    return this.#gradientsCache[uuid];
  }
}
