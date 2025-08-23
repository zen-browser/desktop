// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

{
  function parseSinePath(pathStr) {
    const points = [];
    const commands = pathStr.match(/[MCL]\s*[\d\s.\-,]+/g);
    if (!commands) return points;

    commands.forEach((command) => {
      const type = command.charAt(0);
      const coordsStr = command.slice(1).trim();
      const coords = coordsStr.split(/[\s,]+/).map(Number);

      switch (type) {
        case 'M':
          points.push({ x: coords[0], y: coords[1], type: 'M' });
          break;
        case 'C':
          if (coords.length >= 6 && coords.length % 6 === 0) {
            for (let i = 0; i < coords.length; i += 6) {
              points.push({
                x1: coords[i],
                y1: coords[i + 1],
                x2: coords[i + 2],
                y2: coords[i + 3],
                x: coords[i + 4],
                y: coords[i + 5],
                type: 'C',
              });
            }
          }
          break;
        case 'L':
          points.push({ x: coords[0], y: coords[1], type: 'L' });
          break;
      }
    });
    return points;
  }

  const MAX_OPACITY = 0.9;
  const MIN_OPACITY = AppConstants.platform === 'macosx' ? 0.25 : 0.35;

  const EXPLICIT_LIGHTNESS_TYPE = 'explicit-lightness';

  class nsZenThemePicker extends nsZenMultiWindowFeature {
    static MAX_DOTS = 3;

    currentOpacity = 0.5;
    dots = [];
    useAlgo = '';
    #currentLightness = 50;

    #allowTransparencyOnSidebar = Services.prefs.getBoolPref('zen.theme.acrylic-elements', false);

    #linePath = `M 51.373 27.395 L 367.037 27.395`;
    #sinePath = `M 51.373 27.395 C 60.14 -8.503 68.906 -8.503 77.671 27.395 C 86.438 63.293 95.205 63.293 103.971 27.395 C 112.738 -8.503 121.504 -8.503 130.271 27.395 C 139.037 63.293 147.803 63.293 156.57 27.395 C 165.335 -8.503 174.101 -8.503 182.868 27.395 C 191.634 63.293 200.4 63.293 209.167 27.395 C 217.933 -8.503 226.7 -8.503 235.467 27.395 C 244.233 63.293 252.999 63.293 261.765 27.395 C 270.531 -8.503 279.297 -8.503 288.064 27.395 C 296.83 63.293 305.596 63.293 314.363 27.395 C 323.13 -8.503 331.896 -8.503 340.662 27.395 M 314.438 27.395 C 323.204 -8.503 331.97 -8.503 340.737 27.395 C 349.503 63.293 358.27 63.293 367.037 27.395`;

    #sinePoints = parseSinePath(this.#sinePath);

    #colorPage = 0;
    #gradientsCache = new Map();

    constructor() {
      super();
      if (
        !Services.prefs.getBoolPref('zen.theme.gradient', true) ||
        !gZenWorkspaces.shouldHaveWorkspaces ||
        gZenWorkspaces.privateWindowOrDisabled
      ) {
        return;
      }
      this.promiseInitialized = new Promise((resolve) => {
        this._resolveInitialized = resolve;
      });
      this.dragStartPosition = null;

      this.isLegacyVersion =
        Services.prefs.getIntPref('zen.theme.gradient-legacy-version', 1) === 0;

      ChromeUtils.defineLazyGetter(this, 'panel', () =>
        document.getElementById('PanelUI-zen-gradient-generator')
      );
      ChromeUtils.defineLazyGetter(this, 'toolbox', () => document.getElementById('TabsToolbar'));
      ChromeUtils.defineLazyGetter(this, 'customColorInput', () =>
        document.getElementById('PanelUI-zen-gradient-generator-custom-input')
      );
      ChromeUtils.defineLazyGetter(this, 'customColorList', () =>
        document.getElementById('PanelUI-zen-gradient-generator-custom-list')
      );

      ChromeUtils.defineLazyGetter(this, 'sliderWavePath', () =>
        document.getElementById('PanelUI-zen-gradient-slider-wave').querySelector('path')
      );

      this.panel.addEventListener('popupshowing', this.handlePanelOpen.bind(this));
      this.panel.addEventListener('popuphidden', this.handlePanelClose.bind(this));
      this.panel.addEventListener('command', this.handlePanelCommand.bind(this));

      document
        .getElementById('PanelUI-zen-gradient-generator-opacity')
        .addEventListener('input', this.onOpacityChange.bind(this));

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
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', darkModeChange);

      XPCOMUtils.defineLazyPreferenceGetter(
        this,
        'windowSchemeType',
        'zen.view.window.scheme',
        2,
        darkModeChange
      );

      XPCOMUtils.defineLazyPreferenceGetter(this, 'darkModeBias', 'zen.theme.dark-mode-bias', 0.25);
    }

    handleDarkModeChange() {
      this.updateCurrentWorkspace();
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
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    get colorHarmonies() {
      return [
        { type: 'complementary', angles: [180] },
        { type: 'splitComplementary', angles: [150, 210] },
        { type: 'analogous', angles: [50, 310] },
        { type: 'triadic', angles: [120, 240] },
        { type: 'floating', angles: [] },
      ];
    }

    initContextMenu() {
      const menu = window.MozXULElement.parseXULToFragment(`
        <menuitem id="zenToolbarThemePicker"
                  data-lazy-l10n-id="zen-workspaces-change-theme"
                  command="cmd_zenOpenZenThemePicker"/>
      `);
      document.getElementById('toolbar-context-customize').before(menu);
    }

    openThemePicker(event) {
      const fromForm = event.explicitOriginalTarget?.classList?.contains(
        'zen-workspace-creation-edit-theme-button'
      );
      PanelMultiView.openPopup(this.panel, this.toolbox, {
        position: 'topright topleft',
        triggerEvent: event,
        y: fromForm ? -160 : 0,
      });
    }

    initCustomColorInput() {
      this.customColorInput.addEventListener('change', (event) => {
        // Prevent the popup from closing when the input is focused
        this.openThemePicker(event);
      });
    }

    initPredefinedColors() {
      document
        .getElementById('PanelUI-zen-gradient-generator-color-pages')
        .addEventListener('click', async (event) => {
          const target = event.target;
          const rawPosition = target.getAttribute('data-position');
          if (!rawPosition) {
            return;
          }
          const algo = target.getAttribute('data-algo');
          const lightness = target.getAttribute('data-lightness');
          const numDots = parseInt(target.getAttribute('data-num-dots'));
          if (numDots < this.dots.length) {
            for (let i = numDots; i < this.dots.length; i++) {
              this.dots[i].element.remove();
            }
            this.dots = this.dots.slice(0, numDots);
          }
          // Generate new gradient from the single color given
          const [x, y] = rawPosition.split(',').map((pos) => parseInt(pos));
          let dots = [
            {
              ID: 0,
              position: { x, y },
              isPrimary: true,
              type: EXPLICIT_LIGHTNESS_TYPE,
            },
          ];
          for (let i = 1; i < numDots; i++) {
            dots.push({
              ID: i,
              position: { x: 0, y: 0 },
              type: EXPLICIT_LIGHTNESS_TYPE,
            });
          }
          this.useAlgo = algo;
          this.#currentLightness = lightness;
          dots = this.calculateCompliments(dots, 'update', this.useAlgo);
          this.handleColorPositions(dots, true);
          this.updateCurrentWorkspace();
        });
    }

    initColorPages() {
      const leftButton = document.getElementById('PanelUI-zen-gradient-generator-color-page-left');
      const rightButton = document.getElementById(
        'PanelUI-zen-gradient-generator-color-page-right'
      );
      const pagesWrapper = document.getElementById('PanelUI-zen-gradient-generator-color-pages');
      const pages = pagesWrapper.children;
      pagesWrapper.addEventListener('wheel', (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      leftButton.addEventListener('command', () => {
        this.#colorPage = (this.#colorPage - 1 + pages.length) % pages.length;
        // Scroll to the next page, by using scrollLeft
        pagesWrapper.scrollLeft = (this.#colorPage * pagesWrapper.scrollWidth) / pages.length;
        rightButton.disabled = false;
        leftButton.disabled = this.#colorPage === 0;
      });
      rightButton.addEventListener('command', () => {
        this.#colorPage = (this.#colorPage + 1) % pages.length;
        // Scroll to the next page, by using scrollLeft
        pagesWrapper.scrollLeft = (this.#colorPage * pagesWrapper.scrollWidth) / pages.length;
        leftButton.disabled = false;
        rightButton.disabled = this.#colorPage === pages.length - 1;
      });
    }

    initSchemeButtons() {
      const buttons = document.getElementById('PanelUI-zen-gradient-generator-scheme');
      buttons.addEventListener('click', (event) => {
        const target = event.target.closest('.subviewbutton');
        if (!target) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        const scheme = target.id.replace('PanelUI-zen-gradient-generator-scheme-', '');
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
        Services.prefs.setIntPref('zen.view.window.scheme', themeInt);
      });
    }

    initTextureInput() {
      const wrapper = document.getElementById('PanelUI-zen-gradient-generator-texture-wrapper');
      const wrapperWidth = wrapper.getBoundingClientRect().width;
      // Add elements in a circular pattern, where the center is the center of the wrapper
      for (let i = 0; i < 16; i++) {
        const dot = document.createElement('div');
        dot.classList.add('zen-theme-picker-texture-dot');
        const position = (i / 16) * Math.PI * 2 + wrapperWidth;
        dot.style.left = `${Math.cos(position) * 50 + 50}%`;
        dot.style.top = `${Math.sin(position) * 50 + 50}%`;
        wrapper.appendChild(dot);
      }
      this._textureHandler = document.createElement('div');
      this._textureHandler.id = 'PanelUI-zen-gradient-generator-texture-handler';
      this._textureHandler.addEventListener('mousedown', this.onTextureHandlerMouseDown.bind(this));
      wrapper.appendChild(this._textureHandler);
    }

    onTextureHandlerMouseDown(event) {
      event.preventDefault();
      this._onTextureMouseMove = this.onTextureMouseMove.bind(this);
      this._onTextureMouseUp = this.onTextureMouseUp.bind(this);
      document.addEventListener('mousemove', this._onTextureMouseMove);
      document.addEventListener('mouseup', this._onTextureMouseUp);
    }

    onTextureMouseMove(event) {
      event.preventDefault();
      const wrapper = document.getElementById('PanelUI-zen-gradient-generator-texture-wrapper');
      const wrapperRect = wrapper.getBoundingClientRect();
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
      if (previousTexture !== this.currentTexture) {
        this.updateCurrentWorkspace();
        Services.zen.playHapticFeedback();
      }
    }

    onTextureMouseUp(event) {
      event.preventDefault();
      document.removeEventListener('mousemove', this._onTextureMouseMove);
      document.removeEventListener('mouseup', this._onTextureMouseUp);
      this._onTextureMouseMove = null;
      this._onTextureMouseUp = null;
    }

    initThemePicker() {
      const themePicker = this.panel.querySelector('.zen-theme-picker-gradient');
      this._onDotMouseMove = this.onDotMouseMove.bind(this);
      this._onDotMouseUp = this.onDotMouseUp.bind(this);
      this._onDotMouseDown = this.onDotMouseDown.bind(this);
      this._onThemePickerClick = this.onThemePickerClick.bind(this);
      document.addEventListener('mousemove', this._onDotMouseMove);
      document.addEventListener('mouseup', this._onDotMouseUp);
      themePicker.addEventListener('mousedown', this._onDotMouseDown);
      themePicker.addEventListener('click', this._onThemePickerClick);
    }

    uninitThemePicker() {
      const themePicker = this.panel.querySelector('.zen-theme-picker-gradient');
      document.removeEventListener('mousemove', this._onDotMouseMove);
      document.removeEventListener('mouseup', this._onDotMouseUp);
      themePicker.removeEventListener('mousedown', this._onDotMouseDown);
      themePicker.removeEventListener('click', this._onThemePickerClick);
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
     * @return  {Array}           The RGB representation
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
      if (d === 0) h = 0;
      else if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else if (max === b) h = (r - g) / d + 4;
      let l = (min + max) / 2;
      let s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
      return [h * 60, s, l];
    }

    hueToRgb(p, q, t) {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    }

    calculateInitialPosition([r, g, b]) {
      // This function is called before the picker is even rendered, so we hard code the dimensions
      // important: If any sort of sizing is changed, make sure changes are reflected here
      const padding = 30;
      const rect = {
        width: 338,
        height: 338,
      };
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const radius = (rect.width - padding) / 2;
      const [hue, saturation] = this.rgbToHsl(r, g, b);
      const angle = (hue / 360) * 2 * Math.PI; // Convert to radians
      const normalizedSaturation = saturation / 100; // Convert to [0, 1]
      const x = centerX + radius * normalizedSaturation * Math.cos(angle) - padding;
      const y = centerY + radius * normalizedSaturation * Math.sin(angle) - padding;
      return { x, y };
    }

    getColorFromPosition(x, y, type = undefined) {
      // Return a color as hsl based on the position in the gradient
      const gradient = this.panel.querySelector('.zen-theme-picker-gradient');
      const rect = gradient.getBoundingClientRect();
      const padding = 30; // each side
      const dotHalfSize = 36 / 2; // half the size of the dot
      x += dotHalfSize;
      y += dotHalfSize;
      rect.width += padding * 2; // Adjust width and height for padding
      rect.height += padding * 2; // Adjust width and height for padding
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const radius = (rect.width - padding) / 2;
      const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      let angle = Math.atan2(y - centerY, x - centerX);
      angle = (angle * 180) / Math.PI; // Convert to degrees
      if (angle < 0) {
        angle += 360; // Normalize to [0, 360)
      }
      const normalizedDistance = 1 - Math.min(distance / radius, 1); // Normalize distance to [0, 1]
      const hue = (angle / 360) * 360; // Normalize angle to [0, 360)
      let saturation = normalizedDistance * 100; // stays high even in center
      if (type !== EXPLICIT_LIGHTNESS_TYPE) {
        saturation = 80 + (1 - normalizedDistance) * 20;
        // Set the current lightness to how far we are from the center of the circle
        // For example, moving the dot outside will have higher lightness, while moving it inside will have lower lightness
        this.#currentLightness = Math.round((1 - normalizedDistance) * 100);
      }
      const lightness = this.#currentLightness; // Fixed lightness for simplicity
      const [r, g, b] = this.hslToRgb(hue / 360, saturation / 100, lightness / 100);
      return [
        Math.min(255, Math.max(0, r)),
        Math.min(255, Math.max(0, g)),
        Math.min(255, Math.max(0, b)),
      ];
    }

    getJSONPos(x, y) {
      // Return a JSON string with the position
      return JSON.stringify({ x: Math.round(x), y: Math.round(y) });
    }

    createDot(color, fromWorkspace = false) {
      const [r, g, b] = color.c;
      const dot = document.createElement('div');
      if (color.isPrimary) {
        dot.classList.add('primary');
      }
      if (color.isCustom) {
        if (!color.c) {
          return;
        }
        dot.classList.add('custom');
        dot.style.opacity = 0;
        dot.style.setProperty('--zen-theme-picker-dot-color', color.c);
      } else {
        const { x, y } = color.position || this.calculateInitialPosition([r, g, b]);
        const dotPad = this.panel.querySelector('.zen-theme-picker-gradient');

        dot.classList.add('zen-theme-picker-dot');

        dot.style.left = `${x}px`;
        dot.style.top = `${y}px`;

        if (this.dots.length < 1) {
          dot.classList.add('primary');
        }

        dotPad.appendChild(dot);
        let id = this.dots.length;

        dot.style.setProperty('--zen-theme-picker-dot-color', `rgb(${r}, ${g}, ${b})`);
        dot.setAttribute('data-position', this.getJSONPos(x, y));
        dot.setAttribute('data-type', color.type);

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
        .querySelector('.zen-theme-picker-custom-list-item')
        .setAttribute('data-color', color);
      listItems
        .querySelector('.zen-theme-picker-dot')
        .style.setProperty('--zen-theme-picker-dot-color', color);
      listItems.querySelector('.zen-theme-picker-custom-list-item-label').textContent = color;
      listItems
        .querySelector('.zen-theme-picker-custom-list-item-remove')
        .addEventListener('command', this.removeCustomColor.bind(this));

      this.customColorList.appendChild(listItems);
    }

    async addCustomColor() {
      let color = this.customColorInput.value;

      if (!color) {
        return;
      }

      let colorOpacity =
        document.getElementById('PanelUI-zen-gradient-generator-custom-opacity')?.value ?? 1;
      // Convert the opacity into a hex value if it's not already
      if (colorOpacity < 1) {
        // e.g. if opacity is 1, we add to the color FF, if it's 0.5 we add 80, etc.
        const hexOpacity = Math.round(colorOpacity * 255)
          .toString(16)
          .padStart(2, '0')
          .toUpperCase();
        // If the color is in hex format
        if (color.startsWith('#')) {
          // If the color is already in hex format, we just append the opacity
          if (color.length === 7) {
            color += hexOpacity;
          }
        }
      }

      // Add '#' prefix if it's missing and the input appears to be a hex color
      if (!color.startsWith('#') && /^[0-9A-Fa-f]{3,6}$/.test(color)) {
        color = '#' + color;
      }

      // can be any color format, we just add it to the list as a dot, but hidden
      const dot = document.createElement('div');
      dot.classList.add('zen-theme-picker-dot', 'hidden', 'custom');
      dot.style.opacity = 0;
      dot.style.setProperty('--zen-theme-picker-dot-color', color);
      this.panel.querySelector('#PanelUI-zen-gradient-generator-custom-list').prepend(dot);
      this.customColorInput.value = '';
      document.getElementById('PanelUI-zen-gradient-generator-custom-opacity').value = 1;
      await this.updateCurrentWorkspace();
    }

    handlePanelCommand(event) {
      const target = event.target.closest('toolbarbutton');
      if (!target) {
        return;
      }
      switch (target.id) {
        case 'PanelUI-zen-gradient-generator-color-custom-add':
          this.addCustomColor();
          break;
      }
    }

    spawnDot(dotData, primary = false) {
      const dotPad = this.panel.querySelector('.zen-theme-picker-gradient');
      const relativePosition = {
        x: dotData.x,
        y: dotData.y,
      };

      const dot = document.createElement('div');
      dot.classList.add('zen-theme-picker-dot');

      dot.style.left = `${dotData.x}px`;
      dot.style.top = `${dotData.y}px`;

      dotPad.appendChild(dot);

      let id = this.dots.length;

      if (primary) {
        id = 0;
        dot.classList.add('primary');

        const existingPrimaryDot = this.dots.find((d) => d.ID === 0);
        if (existingPrimaryDot) {
          existingPrimaryDot.ID = this.dots.length;
          existingPrimaryDot.element.classList.remove('primary');
        }
      }

      const colorFromPos = this.getColorFromPosition(
        relativePosition.x,
        relativePosition.y,
        dotData.type
      );
      dot.style.setProperty(
        '--zen-theme-picker-dot-color',
        `rgb(${colorFromPos[0]}, ${colorFromPos[1]}, ${colorFromPos[2]})`
      );
      dot.setAttribute('data-position', this.getJSONPos(relativePosition.x, relativePosition.y));
      dot.setAttribute('data-type', dotData.type);

      this.dots.push({
        ID: id,
        element: dot,
        position: { x: relativePosition.x, y: relativePosition.y },
        lightness: this.#currentLightness,
        type: dotData.type,
      });
    }

    calculateCompliments(dots, action = 'update', useHarmony = '') {
      const colorHarmonies = this.colorHarmonies;

      if (dots.length === 0) {
        return [];
      }

      function getColorHarmonyType(numDots, dots) {
        if (useHarmony !== '') {
          const selectedHarmony = colorHarmonies.find((harmony) => harmony.type === useHarmony);

          if (selectedHarmony) {
            if (action === 'remove') {
              if (dots.length !== 0) {
                return colorHarmonies.find(
                  (harmony) => harmony.angles.length === selectedHarmony.angles.length - 1
                );
              } else {
                return { type: 'floating', angles: [] };
              }
            }
            if (action === 'add') {
              return colorHarmonies.find(
                (harmony) => harmony.angles.length === selectedHarmony.angles.length + 1
              );
            }
            if (action === 'update') {
              return selectedHarmony;
            }
          }
        }

        if (action === 'remove') {
          return colorHarmonies.find((harmony) => harmony.angles.length === numDots);
        }
        if (action === 'add') {
          return colorHarmonies.find((harmony) => harmony.angles.length + 1 === numDots);
        }
        if (action === 'update') {
          return colorHarmonies.find((harmony) => harmony.angles.length + 1 === numDots);
        }
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

      const dotPad = this.panel.querySelector('.zen-theme-picker-gradient');
      const rect = dotPad.getBoundingClientRect();
      const padding = 30;

      let updatedDots = [...dots];
      const centerPosition = { x: rect.width / 2, y: rect.height / 2 };

      const harmonyAngles = getColorHarmonyType(
        dots.length + (action === 'add' ? 1 : action === 'remove' ? -1 : 0),
        this.dots
      );
      this.useAlgo = harmonyAngles.type;
      if (!harmonyAngles || harmonyAngles.angles.length === 0) return dots;

      let primaryDot = dots.find((dot) => dot.ID === 0);
      if (!primaryDot) return [];

      if (action === 'add' && this.dots.length) {
        updatedDots.push({ ID: this.dots.length, position: centerPosition });
      }
      const baseAngle = getAngleFromPosition(primaryDot.position, centerPosition);
      let distance = getDistanceFromCenter(primaryDot.position, centerPosition);
      const radius = (rect.width - padding) / 2;
      if (distance > radius) distance = radius;
      if (this.dots.length > 0) {
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
        Services.prefs.setIntPref('zen.theme.gradient-legacy-version', 1);
      }

      colorPositions.forEach((dotPosition) => {
        const existingDot = this.dots.find((dot) => dot.ID === dotPosition.ID);

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
            '--zen-theme-picker-dot-color',
            `rgb(${colorFromPos[0]}, ${colorFromPos[1]}, ${colorFromPos[2]})`
          );
          existingDot.element.setAttribute(
            'data-position',
            this.getJSONPos(dotPosition.position.x, dotPosition.position.y)
          );
          existingDot.element.setAttribute('data-type', dotPosition.type);

          if (!this.dragging) {
            gZenUIManager.motion.animate(
              existingDot.element,
              {
                left: `${dotPosition.position.x}px`,
                top: `${dotPosition.position.y}px`,
              },
              {
                duration: 0.4,
                type: 'spring',
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
      if (event.target.closest('#PanelUI-zen-gradient-generator-scheme')) {
        return;
      }
      event.preventDefault();
      const target = event.target;
      if (target.id === 'PanelUI-zen-gradient-generator-color-add') {
        if (this.dots.length >= nsZenThemePicker.MAX_DOTS) return;
        let colorPositions = this.calculateCompliments(this.dots, 'add', this.useAlgo);

        this.handleColorPositions(colorPositions);
        this.updateCurrentWorkspace();
        return;
      } else if (target.id === 'PanelUI-zen-gradient-generator-color-remove') {
        this.dots.sort((a, b) => a.ID - b.ID);
        if (this.dots.length === 0) return;

        const lastDot = this.dots.pop();
        lastDot.element.remove();

        this.dots.forEach((dot, index) => {
          dot.ID = index;
          if (index === 0) {
            dot.element.classList.add('primary');
          } else {
            dot.element.classList.remove('primary');
          }
        });

        let colorPositions = this.calculateCompliments(this.dots, 'remove');
        this.handleColorPositions(colorPositions);
        this.updateCurrentWorkspace();
        return;
      }

      if (event.button !== 0 || this.dragging || this.recentlyDragged) return;

      const gradient = this.panel.querySelector('.zen-theme-picker-gradient');
      const rect = gradient.getBoundingClientRect();
      const padding = 30;

      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const radius = (rect.width - padding) / 2;
      let pixelX = event.clientX;
      let pixelY = event.clientY;

      const clickedElement = event.target;
      let clickedDot = null;
      const existingPrimaryDot = this.dots.find((d) => d.ID === 0);

      clickedDot = this.dots.find((dot) => dot.element === clickedElement);

      if (clickedDot) {
        // TODO: this doesnt work and needs to be fixed
        existingPrimaryDot.ID = clickedDot.ID;
        clickedDot.ID = 0;
        clickedDot.element.style.zIndex = 999;

        let colorPositions = this.calculateCompliments(this.dots, 'update', this.useAlgo);
        this.handleColorPositions(colorPositions);
        return;
      }

      const distance = Math.sqrt((pixelX - centerX) ** 2 + (pixelY - centerY) ** 2);
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

        let colorPositions = this.calculateCompliments(this.dots, 'update', this.useAlgo);
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
            type: 'spring',
            bounce: 0.3,
          }
        );
      }
    }

    onDotMouseDown(event) {
      if (event.button === 2) {
        return;
      }
      const draggedDot = this.dots.find((dot) => dot.element === event.target);
      if (draggedDot) {
        event.preventDefault();
        this.dragging = true;
        this.draggedDot = event.target;
        this.draggedDot.classList.add('dragging');
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
        if (!event.target.classList.contains('zen-theme-picker-dot')) {
          return;
        }
        this.dots = this.dots.filter((dot) => dot.element !== event.target);
        event.target.remove();

        this.dots.sort((a, b) => a.ID - b.ID);

        // Reassign the IDs after sorting
        this.dots.forEach((dot, index) => {
          dot.ID = index;
          if (index === 0) {
            dot.element.classList.add('primary');
          } else {
            dot.element.classList.remove('primary');
          }
        });

        let colorPositions = this.calculateCompliments(this.dots, 'remove');
        this.handleColorPositions(colorPositions);

        this.updateCurrentWorkspace();
        return;
      }

      if (this.dragging) {
        event.preventDefault();
        event.stopPropagation();
        this.dragging = false;
        this.draggedDot.classList.remove('dragging');
        this.draggedDot = null;
        this.dragStartPosition = null; // Reset the drag start position

        this.recentlyDragged = true;
        setTimeout(() => {
          this.recentlyDragged = false;
        }, 100);
        return;
      }
    }

    onDotMouseMove(event) {
      if (this.dragging) {
        event.preventDefault();
        const rect = this.panel.querySelector('.zen-theme-picker-gradient').getBoundingClientRect();
        const padding = 30; // each side
        // do NOT let the ball be draged outside of an imaginary circle. You can drag it anywhere inside the circle
        // if the distance between the center of the circle and the dragged ball is bigger than the radius, then the ball
        // should be placed on the edge of the circle. If it's inside the circle, then the ball just follows the mouse

        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const radius = (rect.width - padding) / 2;
        let pixelX = event.clientX;
        let pixelY = event.clientY;
        const distance = Math.sqrt((pixelX - centerX) ** 2 + (pixelY - centerY) ** 2);
        if (distance > radius) {
          const angle = Math.atan2(pixelY - centerY, pixelX - centerX);
          pixelX = centerX + Math.cos(angle) * radius;
          pixelY = centerY + Math.sin(angle) * radius;
        }

        // set the location of the dot in pixels
        const relativeX = pixelX - rect.left;
        const relativeY = pixelY - rect.top;

        const draggedDot = this.dots.find((dot) => dot.element === this.draggedDot);
        draggedDot.element.style.left = `${relativeX}px`;
        draggedDot.element.style.top = `${relativeY}px`;
        draggedDot.position = {
          x: relativeX,
          y: relativeY,
        };
        let colorPositions = this.calculateCompliments(this.dots, 'update', this.useAlgo);
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
      return window.matchMedia('(-moz-windows-mica)').matches;
    }

    get canBeTransparent() {
      return (
        this.isMica ||
        window.matchMedia(
          '(-moz-platform: macos) or ((-moz-platform: linux) and -moz-pref("zen.widget.linux.transparency"))'
        ).matches
      );
    }

    blendWithWhiteOverlay(baseColor, opacity) {
      let colorToBlend;
      let colorToBlendOpacity;
      if (this.isMica) {
        colorToBlend = !this.isDarkMode ? [0, 0, 0] : [255, 255, 255];
        colorToBlendOpacity = 0.35;
      } else if (AppConstants.platform === 'macosx') {
        colorToBlend = [255, 255, 255];
        colorToBlendOpacity = 0.3;
      }
      if (colorToBlend) {
        const blendedAlpha = Math.min(
          1,
          opacity + MIN_OPACITY + colorToBlendOpacity * (1 - (opacity + MIN_OPACITY))
        );
        baseColor = this.blendColors(baseColor, colorToBlend, blendedAlpha * 100);
        opacity += colorToBlendOpacity * (1 - opacity);
      }
      return `rgba(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]}, ${opacity})`;
    }

    getSingleRGBColor(color, forToolbar = false) {
      if (color.isCustom) {
        return color.c;
      }
      let opacity = this.currentOpacity;
      if (forToolbar && !this.#allowTransparencyOnSidebar) {
        color = this.blendColors(color.c, this.getToolbarModifiedBaseRaw().slice(0, 3), 90);
        opacity = 1; // Toolbar colors should always be fully opaque
      } else {
        color = color.c;
      }
      if (this.isLegacyVersion && this.isDarkMode) {
        // In legacy version, we blend with white overlay or black overlay based on if we are in dark mode
        color = this.blendColors(color, [0, 0, 0], 30);
      }
      return this.blendWithWhiteOverlay(color, opacity);
    }

    luminance([r, g, b]) {
      // These magic numbers are extracted from the wikipedia article on relative luminance
      // https://en.wikipedia.org/wiki/Relative_luminance
      var a = [r, g, b].map((v) => {
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
      this.useAlgo = themedColors[0]?.algorithm ?? '';
      this.#currentLightness = themedColors[0]?.lightness ?? 50;

      const rotation = -45; // TODO: Detect rotation based on the accent color
      if (themedColors.length === 0) {
        return forToolbar
          ? this.getToolbarModifiedBase()
          : this.isDarkMode
            ? 'rgba(0, 0, 0, 0.4)'
            : 'transparent';
      } else if (themedColors.length === 1) {
        return this.getSingleRGBColor(themedColors[0], forToolbar);
      } else {
        // If there are custom colors, we just return a linear gradient with all colors
        if (themedColors.find((color) => color.isCustom)) {
          // Just return a linear gradient with all colors
          const gradientColors = themedColors.map((color) =>
            this.getSingleRGBColor(color, forToolbar)
          );
          // Divide all colors evenly in the gradient
          const colorStops = gradientColors
            .map((color, index) => {
              const position = (index / (gradientColors.length - 1)) * 100;
              return `${color} ${position}%`;
            })
            .join(', ');
          return `linear-gradient(${rotation}deg, ${colorStops})`;
        }
        if (themedColors.length === 2) {
          if (!forToolbar) {
            return [
              `linear-gradient(${rotation}deg, ${this.getSingleRGBColor(themedColors[1], forToolbar)} 0%, transparent 100%)`,
              `linear-gradient(${rotation + 180}deg, ${this.getSingleRGBColor(themedColors[0], forToolbar)} 0%, transparent 80%)`,
            ]
              .reverse()
              .join(', ');
          }
          return `linear-gradient(${rotation}deg, ${this.getSingleRGBColor(themedColors[1], forToolbar)} 0%, ${this.getSingleRGBColor(themedColors[0], forToolbar)} 100%)`;
        } else if (themedColors.length === 3) {
          let color1 = this.getSingleRGBColor(themedColors[2], forToolbar);
          let color2 = this.getSingleRGBColor(themedColors[0], forToolbar);
          let color3 = this.getSingleRGBColor(themedColors[1], forToolbar);
          if (!forToolbar) {
            return [
              `radial-gradient(circle at 0% 0%, ${color2}, transparent 100%)`,
              `radial-gradient(circle at 100% 0%, ${color3}, transparent 100%)`,
              `linear-gradient(to top, ${color1} 0%, transparent 60%)`,
            ].join(', ');
          }
          return [`linear-gradient(-45deg, ${color1} 15%, ${color2})`].join(', ');
        }
      }
    }

    shouldBeDarkMode(accentColor) {
      if (Services.prefs.getBoolPref('zen.theme.use-sysyem-colors')) {
        return this.isDarkMode;
      }

      if (!this.canBeTransparent) {
        const toolbarBg = this.getToolbarModifiedBaseRaw();
        accentColor = this.blendColors(
          toolbarBg.slice(0, 3),
          accentColor,
          (1 - this.currentOpacity) * 100
        );
      }

      const bg = accentColor;

      // Get text colors (with alpha)
      let darkText = this.getToolbarColor(true); // e.g. [r, g, b, a]
      let lightText = this.getToolbarColor(false); // e.g. [r, g, b, a]

      if (this.canBeTransparent) {
        lightText[3] -= this.darkModeBias; // Reduce alpha for light text
      }

      // Composite text color over background
      darkText = this.blendColors(bg, darkText.slice(0, 3), (1 - darkText[3]) * 100);
      lightText = this.blendColors(bg, lightText.slice(0, 3), (1 - lightText[3]) * 100);

      const darkContrast = this.contrastRatio(bg, darkText);
      const lightContrast = this.contrastRatio(bg, lightText);

      return darkContrast > lightContrast;
    }

    static getTheme(colors = [], opacity = 0.5, texture = 0) {
      return {
        type: 'gradient',
        gradientColors: colors ? colors.filter((color) => color) : [], // remove undefined
        opacity,
        texture,
      };
    }

    updateNoise(texture) {
      document.documentElement.style.setProperty('--zen-grainy-background-opacity', texture);
      document.documentElement.setAttribute(
        'zen-show-grainy-background',
        texture > 0 ? 'true' : 'false'
      );
    }

    hexToRgb(hex) {
      if (hex.startsWith('#')) {
        hex = hex.substring(1);
      }
      if (hex.length === 3) {
        hex = hex
          .split('')
          .map((char) => char + char)
          .join('');
      }
      return [
        parseInt(hex.substring(0, 2), 16),
        parseInt(hex.substring(2, 4), 16),
        parseInt(hex.substring(4, 6), 16),
      ];
    }

    /**
     * Get the primary color from a list of colors.
     * @returns {string} The primary color in hex format.
     */
    getAccentColorForUI(accentColor) {
      return `rgb(${accentColor[0]}, ${accentColor[1]}, ${accentColor[2]})`;
    }

    getMostDominantColor(allColors) {
      const color = this.getPrimaryColor(allColors);
      if (typeof color === 'string') {
        // We found a custom color, we should rather return the native accent color
        return this.getNativeAccentColor();
      }
      return color;
    }

    getToolbarColor(isDarkMode = false) {
      return isDarkMode ? [255, 255, 255, 0.8] : [0, 0, 0, 0.8]; // Default toolbar
    }

    async onWorkspaceChange(workspace, skipUpdate = false, theme = null) {
      const uuid = workspace.uuid;
      // Use theme from workspace object or passed theme
      let workspaceTheme = theme || workspace.theme;

      await this.foreachWindowAsActive(async (browser) => {
        if (!browser.gZenThemePicker?.promiseInitialized) {
          return;
        }

        if (browser.closing || (await browser.gZenThemePicker?.promiseInitialized)) {
          return;
        }

        if (theme === null) {
          browser.gZenThemePicker.invalidateGradientCache();
        }

        // Do not rebuild if the workspace is not the same as the current one
        const windowWorkspace = await browser.gZenWorkspaces.getActiveWorkspace();
        if (windowWorkspace.uuid !== uuid && theme !== null) {
          return;
        }

        // get the theme from the window
        workspaceTheme = this.fixTheme(theme || windowWorkspace.theme);

        if (!skipUpdate) {
          for (const dot of browser.gZenThemePicker.panel.querySelectorAll(
            '.zen-theme-picker-dot'
          )) {
            dot.remove();
          }
        }

        if (theme) {
          const workspaceElement = browser.gZenWorkspaces.workspaceElement(windowWorkspace.uuid);
          if (workspaceElement) {
            workspaceElement.clearThemeStyles();
          }
        }

        if (!skipUpdate) {
          browser.document.documentElement.style.setProperty(
            '--zen-main-browser-background-old',
            browser.document.documentElement.style.getPropertyValue('--zen-main-browser-background')
          );
          browser.document.documentElement.style.setProperty(
            '--zen-background-opacity',
            browser.gZenThemePicker.previousBackgroundOpacity ?? 1
          );
          if (browser.gZenThemePicker.previousBackgroundResolve) {
            browser.gZenThemePicker.previousBackgroundResolve();
          }
          delete browser.gZenThemePicker.previousBackgroundOpacity;
        }

        browser.gZenThemePicker.resetCustomColorList();

        browser.gZenThemePicker.currentOpacity = workspaceTheme.opacity ?? 0.5;
        browser.gZenThemePicker.currentTexture = workspaceTheme.texture ?? 0;

        let dominantColor = this.getMostDominantColor(workspaceTheme.gradientColors);
        const isDefaultTheme = !dominantColor;
        if (isDefaultTheme) {
          dominantColor = this.getNativeAccentColor();
        }

        const opacitySlider = browser.document.getElementById(
          'PanelUI-zen-gradient-generator-opacity'
        );

        {
          let opacity = browser.gZenThemePicker.currentOpacity;
          const svg = browser.gZenThemePicker.sliderWavePath;
          /* eslint-disable no-unused-vars */
          const [_, secondStop, thirdStop] = document.querySelectorAll(
            '#PanelUI-zen-gradient-generator-slider-wave-gradient stop'
          );
          // Opacity can only be between MIN_OPACITY to MAX_OPACITY. Make opacity relative to that range
          if (opacity < MIN_OPACITY) {
            opacity = 0;
          } else if (opacity > MAX_OPACITY) {
            opacity = 1;
          } else {
            opacity = (opacity - MIN_OPACITY) / (MAX_OPACITY - MIN_OPACITY);
          }
          if (isDefaultTheme) {
            opacity = 1; // If it's the default theme, we want the wave to be
          }
          // Since it's sine waves, we can't just set the offset to the opacity, we need to calculate it
          // The offset is the percentage of the wave that is visible, so we need to multiply
          // the opacity by 100 to get the percentage.
          // Set the offset of the stops
          secondStop.setAttribute('offset', `${opacity * 100}%`);
          thirdStop.setAttribute('offset', `${opacity * 100}%`);
          const interpolatedPath = this.#interpolateWavePath(opacity);
          svg.setAttribute('d', interpolatedPath);
          opacitySlider.style.setProperty('--zen-thumb-height', `${40 + opacity * 15}px`);
          opacitySlider.style.setProperty('--zen-thumb-width', `${10 + opacity * 15}px`);
          svg.style.stroke =
            interpolatedPath === this.#linePath
              ? thirdStop.getAttribute('stop-color')
              : 'url(#PanelUI-zen-gradient-generator-slider-wave-gradient)';
        }

        for (const button of browser.document.querySelectorAll(
          '#PanelUI-zen-gradient-generator-color-actions button'
        )) {
          // disable if there are no buttons
          button.disabled =
            workspaceTheme.gradientColors.length === 0 ||
            (button.id === 'PanelUI-zen-gradient-generator-color-add'
              ? workspaceTheme.gradientColors.length >= nsZenThemePicker.MAX_DOTS
              : false);
        }
        document
          .getElementById('PanelUI-zen-gradient-generator-color-click-to-add')
          .toggleAttribute('hidden', workspaceTheme.gradientColors.length > 0);

        opacitySlider.value = browser.gZenThemePicker.currentOpacity;
        const textureSelectWrapper = browser.document.getElementById(
          'PanelUI-zen-gradient-generator-texture-wrapper'
        );
        const textureWrapperWidth = textureSelectWrapper.getBoundingClientRect().width;
        // Dont show when hidden
        if (textureWrapperWidth) {
          // rotate and trasnform relative to the wrapper width depending on the texture value
          const textureValue = this.currentTexture;
          const textureHandler = browser.gZenThemePicker._textureHandler;
          const rotation = textureValue * 360 - 90;
          textureHandler.style.transform = `rotate(${rotation + 90}deg)`;
          // add top and left to center the texture handler in relation with textureWrapperWidth
          // based on the rotation
          const top = Math.sin((rotation * Math.PI) / 180) * (textureWrapperWidth / 2) - 6;
          const left = Math.cos((rotation * Math.PI) / 180) * (textureWrapperWidth / 2) - 3;
          textureHandler.style.top = `${textureWrapperWidth / 2 + top}px`;
          textureHandler.style.left = `${textureWrapperWidth / 2 + left}px`;
          // Highlight the 16 buttons based on the texture value
          const buttons = browser.document.querySelectorAll('.zen-theme-picker-texture-dot');
          let i = 4;
          for (const button of buttons) {
            button.classList.toggle('active', i / 16 <= textureValue);
            i++;
            // We start at point 4 because that's the first point that is not in the middle of the texture
            if (i === 16) {
              i = 0;
            }
          }
        }

        const gradient = browser.gZenThemePicker.getGradient(workspaceTheme.gradientColors);
        const gradientToolbar = browser.gZenThemePicker.getGradient(
          workspaceTheme.gradientColors,
          true
        );
        browser.gZenThemePicker.updateNoise(workspaceTheme.texture);

        browser.gZenThemePicker.customColorList.innerHTML = '';
        for (const dot of workspaceTheme.gradientColors) {
          if (dot.isCustom) {
            browser.gZenThemePicker.addColorToCustomList(dot.c);
          }
        }

        browser.document.documentElement.style.setProperty(
          '--zen-main-browser-background-toolbar',
          gradientToolbar
        );
        browser.document.documentElement.style.setProperty(
          '--zen-main-browser-background',
          gradient
        );
        const isDarkModeWindow = browser.gZenThemePicker.isDarkMode;
        if (dominantColor) {
          const primaryColor = this.getAccentColorForUI(dominantColor);
          browser.document.documentElement.style.setProperty('--zen-primary-color', primaryColor);

          // Should be set to `this.isLegacyVersion` but for some reason it is set to undefined if we open a private window,
          // so instead get the pref value directly.
          browser.gZenThemePicker.isLegacyVersion =
            Services.prefs.getIntPref('zen.theme.gradient-legacy-version', 1) === 0;

          let isDarkMode = isDarkModeWindow;
          if (!isDefaultTheme && !this.isLegacyVersion) {
            // Check for the primary color
            isDarkMode = browser.gZenThemePicker.shouldBeDarkMode(dominantColor);
            browser.document.documentElement.setAttribute('zen-should-be-dark-mode', isDarkMode);
            browser.gZenThemePicker.panel.removeAttribute('invalidate-controls');
          } else {
            browser.document.documentElement.removeAttribute('zen-should-be-dark-mode');
            if (!this.isLegacyVersion) {
              browser.gZenThemePicker.panel.setAttribute('invalidate-controls', 'true');
            }
          }
          // Set `--toolbox-textcolor` to have a contrast with the primary color
          const textColor = this.getToolbarColor(isDarkMode);
          document.documentElement.style.setProperty(
            '--toolbox-textcolor',
            `rgba(${textColor[0]}, ${textColor[1]}, ${textColor[2]}, ${textColor[3]})`
          );
        }

        if (!skipUpdate) {
          browser.gZenThemePicker.dots = [];
          browser.gZenThemePicker.recalculateDots(workspaceTheme.gradientColors);
        }
      });
    }

    fixTheme(theme) {
      // add a primary color if there isn't one
      if (
        !theme.gradientColors.find((color) => color.isPrimary) &&
        theme.gradientColors.length > 0
      ) {
        theme.gradientColors[0].isPrimary = true;
      }
      return theme;
    }

    getNativeAccentColor() {
      const accentColor = Services.prefs.getStringPref('zen.theme.accent-color');
      const rgb = this.hexToRgb(accentColor);
      if (this.isDarkMode) {
        // If the theme is dark, we want to use a lighter color
        return this.blendColors(rgb, [0, 0, 0], 40);
      }
      return rgb;
    }

    resetCustomColorList() {
      this.customColorList.innerHTML = '';
    }

    removeCustomColor(event) {
      const target = event.target.closest('.zen-theme-picker-custom-list-item');
      const color = target.getAttribute('data-color');
      const dots = this.panel.querySelectorAll('.zen-theme-picker-dot');
      for (const dot of dots) {
        if (dot.style.getPropertyValue('--zen-theme-picker-dot-color') === color) {
          dot.remove();
          break;
        }
      }
      target.remove();
      this.updateCurrentWorkspace();
    }

    getPrimaryColor(colors) {
      const primaryColor = colors.find((color) => color.isPrimary);
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

    async updateCurrentWorkspace(skipSave = true) {
      this.updated = skipSave;
      const dots = this.panel.querySelectorAll('.zen-theme-picker-dot');
      const colors = Array.from(dots)
        .sort((a, b) => a.getAttribute('data-index') - b.getAttribute('data-index'))
        .map((dot) => {
          const color = dot.style.getPropertyValue('--zen-theme-picker-dot-color');
          const isPrimary = dot.classList.contains('primary');

          if (color === 'undefined') {
            return;
          }
          const isCustom = dot.classList.contains('custom');
          const algorithm = this.useAlgo;
          const position =
            dot.getAttribute('data-position') && JSON.parse(dot.getAttribute('data-position'));
          const type = dot.getAttribute('data-type');
          return {
            c: isCustom ? color : color.match(/\d+/g).map(Number),
            isCustom,
            algorithm,
            isPrimary,
            lightness: this.#currentLightness,
            position,
            type,
          };
        });
      const gradient = nsZenThemePicker.getTheme(colors, this.currentOpacity, this.currentTexture);
      let currentWorkspace = await gZenWorkspaces.getActiveWorkspace();

      if (!skipSave) {
        await ZenWorkspacesStorage.saveWorkspaceTheme(currentWorkspace.uuid, gradient);
        await gZenWorkspaces._propagateWorkspaceData();
        gZenUIManager.showToast('zen-panel-ui-gradient-generator-saved-message');
        currentWorkspace = await gZenWorkspaces.getActiveWorkspace();
      }

      await this.onWorkspaceChange(currentWorkspace, skipSave, skipSave ? gradient : null);
    }

    async handlePanelClose() {
      if (this.updated) {
        await this.updateCurrentWorkspace(false);
      }
      this.uninitThemePicker();
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
      if (progress <= 0.001) return linePath;
      if (progress >= 0.999) return sinePath;
      const t = progress;
      let newPathData = '';
      this.#sinePoints.forEach((p) => {
        switch (p.type) {
          case 'M': {
            const interpolatedY = referenceY + (p.y - referenceY) * t;
            newPathData += `M ${p.x} ${interpolatedY} `;
            break;
          }
          case 'C': {
            const y1 = referenceY + (p.y1 - referenceY) * t;
            const y2 = referenceY + (p.y2 - referenceY) * t;
            const y = referenceY + (p.y - referenceY) * t;
            newPathData += `C ${p.x1} ${y1} ${p.x2} ${y2} ${p.x} ${y} `;
            break;
          }
          case 'L':
            newPathData += `L ${p.x} ${p.y} `;
            break;
        }
      });
      return newPathData.trim();
    }

    invalidateGradientCache() {
      this.#gradientsCache = {};
      window.dispatchEvent(new Event('ZenGradientCacheChanged'));
    }

    getGradientForWorkspace(workspace) {
      const uuid = workspace.uuid;
      if (this.#gradientsCache[uuid]) {
        return this.#gradientsCache[uuid];
      }
      const previousOpacity = this.currentOpacity;
      const previousLightness = this.#currentLightness;
      const theme = workspace.theme;
      this.currentOpacity = theme.opacity ?? 0.5;
      this.#currentLightness = theme.lightness ?? 50;
      const gradient = this.getGradient(theme.gradientColors);
      let dominantColor = this.getMostDominantColor(theme.gradientColors);
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
      this.#gradientsCache[uuid] = {
        gradient,
        grain: theme.texture ?? 0,
        isDarkMode,
        isExplicitMode,
        toolbarColor: this.getToolbarColor(isDarkMode),
        primaryColor: this.getAccentColorForUI(dominantColor),
      };
      this.currentOpacity = previousOpacity;
      this.#currentLightness = previousLightness;
      return this.#gradientsCache[uuid];
    }
  }

  window.nsZenThemePicker = nsZenThemePicker;
}
