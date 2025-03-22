{
  class ZenThemePicker extends ZenMultiWindowFeature {
    static GRADIENT_IMAGE_URL = 'chrome://browser/content/zen-images/gradient.png';
    static MAX_DOTS = 3;

    currentOpacity = 0.5;
    currentRotation = -45;
    dots = [];
    useAlgo = '';
    constructor() {
      super();
      if (!Services.prefs.getBoolPref('zen.theme.gradient', true) || !ZenWorkspaces.shouldHaveWorkspaces) {
        return;
      }
      this.dragStartPosition = null;

      ChromeUtils.defineLazyGetter(this, 'panel', () => document.getElementById('PanelUI-zen-gradient-generator'));
      ChromeUtils.defineLazyGetter(this, 'toolbox', () => document.getElementById('TabsToolbar'));
      ChromeUtils.defineLazyGetter(this, 'customColorInput', () =>
        document.getElementById('PanelUI-zen-gradient-generator-custom-input')
      );
      ChromeUtils.defineLazyGetter(this, 'customColorList', () =>
        document.getElementById('PanelUI-zen-gradient-generator-custom-list')
      );

      XPCOMUtils.defineLazyPreferenceGetter(
        this,
        'allowWorkspaceColors',
        'zen.theme.color-prefs.use-workspace-colors',
        true,
        this.onDarkModeChange.bind(this)
      );

      this.initCanvas();
      this.initCustomColorInput();
      this.initTextureInput();
      this.initRotationInput();

      window.matchMedia('(prefers-color-scheme: dark)').addListener(this.onDarkModeChange.bind(this));
    }

    get isDarkMode() {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    async onDarkModeChange(event, skipUpdate = false) {
      const currentWorkspace = await ZenWorkspaces.getActiveWorkspace();
      this.onWorkspaceChange(currentWorkspace, skipUpdate);
    }

    initContextMenu() {
      const menu = window.MozXULElement.parseXULToFragment(`
        <menuitem id="zenToolbarThemePicker"
                  data-lazy-l10n-id="zen-workspaces-change-gradient"
                  oncommand="gZenThemePicker.openThemePicker(event);"/>
      `);
      document.getElementById('toolbar-context-customize').before(menu);
    }

    openThemePicker(event) {
      PanelMultiView.openPopup(this.panel, this.toolbox, {
        position: 'topright topleft',
        triggerEvent: event,
      });
    }

    initCanvas() {
      this.image = new Image();
      this.image.src = ZenThemePicker.GRADIENT_IMAGE_URL;

      this.canvas = document.createElement('canvas');
      this.panel.appendChild(this.canvas);
      this.canvasCtx = this.canvas.getContext('2d');

      // wait for the image to load
      this.image.onload = this.onImageLoad.bind(this);
    }

    onImageLoad() {
      // resize the image to fit the panel
      const imageSize = 350 - 20; // 20 is the padding (10px)
      const scale = imageSize / Math.max(this.image.width, this.image.height);
      this.image.width *= scale;
      this.image.height *= scale;

      this.canvas.width = this.image.width;
      this.canvas.height = this.image.height;
      this.canvasCtx.drawImage(this.image, 0, 0);

      this.canvas.setAttribute('hidden', 'true');

      // Call the rest of the initialization
      this.initContextMenu();
      this.initPredefinedColors();

      this._hasInitialized = true;
      this.onDarkModeChange(null);
    }

    initPredefinedColors() {
      document.getElementById('PanelUI-zen-gradient-generator-predefined').addEventListener('click', async (event) => {
        const target = event.target;
        const rawPosition = target.getAttribute('data-position');
        if (!rawPosition) {
          return;
        }
        const algo = target.getAttribute('data-algo');
        const numDots = parseInt(target.getAttribute('data-num-dots'));
        if (algo == 'float') {
          for (const dot of this.dots) {
            dot.element.remove();
          }
          this.dots = [];
        } else if (numDots < this.dots.length) {
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
          },
        ];
        for (let i = 1; i < numDots; i++) {
          dots.push({
            ID: i,
            position: { x: 0, y: 0 },
          });
        }
        this.useAlgo = algo;
        dots = this.calculateCompliments(dots, 'update', this.useAlgo);
        if (algo == 'float') {
          for (const dot of dots) {
            this.spawnDot(dot.position);
          }
          this.dots[0].element.classList.add('primary');
        }
        this.handleColorPositions(dots);
        this.updateCurrentWorkspace();
      });
    }

    initCustomColorInput() {
      this.customColorInput.addEventListener('keydown', this.onCustomColorKeydown.bind(this));
    }

    initRotationInput() {
      const rotationInput = document.getElementById('PanelUI-zen-gradient-generator-rotation-dot');
      this._onRotationMouseDown = this.onRotationMouseDown.bind(this);
      this._onRotationMouseMove = this.onRotationMouseMove.bind(this);
      this._onRotationMouseUp = this.onRotationMouseUp.bind(this);
      rotationInput.addEventListener('mousedown', this._onRotationMouseDown);
    }

    onRotationMouseDown(event) {
      event.preventDefault();
      event.stopPropagation();
      this._rotating = true;
      document.addEventListener('mousemove', this._onRotationMouseMove);
      document.addEventListener('mouseup', this._onRotationMouseUp);
    }

    onRotationMouseMove(event) {
      event.preventDefault();
      event.stopPropagation();
      const rotationInput = document.getElementById('PanelUI-zen-gradient-generator-rotation-dot');
      const containerRect = rotationInput.parentElement.getBoundingClientRect();
      // We calculate the angle based on the mouse position and the center of the container
      const rotation = Math.atan2(
        event.clientY - containerRect.top - containerRect.height / 2,
        event.clientX - containerRect.left - containerRect.width / 2
      );
      const endRotation = (rotation * 180) / Math.PI;
      // Between 150 and 50, we don't update the rotation
      if (!(endRotation < 45 || endRotation > 130)) {
        return;
      }
      this.currentRotation = endRotation;
      this.updateCurrentWorkspace();
    }

    onRotationMouseUp(event) {
      event.preventDefault();
      event.stopPropagation();
      document.removeEventListener('mousemove', this._onRotationMouseMove);
      document.removeEventListener('mouseup', this._onRotationMouseUp);
      setTimeout(() => {
        this._rotating = false;
      }, 100);
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
      }
    }

    onTextureMouseUp(event) {
      event.preventDefault();
      document.removeEventListener('mousemove', this._onTextureMouseMove);
      document.removeEventListener('mouseup', this._onTextureMouseUp);
      this._onTextureMouseMove = null;
      this._onTextureMouseUp = null;
    }

    onCustomColorKeydown(event) {
      // Check for Enter key to add custom colors
      if (event.key === 'Enter') {
        event.preventDefault();
        this.addCustomColor();
      }
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

    calculateInitialPosition(color) {
      const [r, g, b] = color.c;
      const imageData = this.canvasCtx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      // Find all pixels that are at least 90% similar to the color
      const similarPixels = [];
      for (let i = 0; i < imageData.data.length; i += 4) {
        const pixelR = imageData.data[i];
        const pixelG = imageData.data[i + 1];
        const pixelB = imageData.data[i + 2];
        if (Math.abs(r - pixelR) < 25 && Math.abs(g - pixelG) < 25 && Math.abs(b - pixelB) < 25) {
          similarPixels.push(i);
        }
      }
      // Check if there's an exact match
      for (const pixel of similarPixels) {
        const x = (pixel / 4) % this.canvas.width;
        const y = Math.floor(pixel / 4 / this.canvas.width);
        const pixelColor = this.getColorFromPosition(x, y);
        if (pixelColor[0] === r && pixelColor[1] === g && pixelColor[2] === b) {
          return { x: x / this.canvas.width, y: y / this.canvas.height };
        }
      }
      // If there's no exact match, return the first similar pixel
      const pixel = similarPixels[0];
      const x = (pixel / 4) % this.canvas.width;
      const y = Math.floor(pixel / 4 / this.canvas.width);
      return { x: x / this.canvas.width, y: y / this.canvas.height };
    }

    getColorFromPosition(x, y) {
      // get the color from the x and y from the image
      const imageData = this.canvasCtx.getImageData(x, y, 1, 1);
      return imageData.data;
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
        const { x, y } = this.calculateInitialPosition(color);
        const dotPad = this.panel.querySelector('.zen-theme-picker-gradient');

        dot.classList.add('zen-theme-picker-dot');

        dot.style.left = `${x * 100}%`;
        dot.style.top = `${y * 100}%`;

        if (this.dots.length < 1) {
          dot.classList.add('primary');
        }

        dotPad.appendChild(dot);
        let id = this.dots.length;

        dot.style.setProperty('--zen-theme-picker-dot-color', `rgb(${r}, ${g}, ${b})`);

        this.dots.push({
          ID: id,
          element: dot,
          position: { x: null, y: null }, // at some point possition should instead be stored as percentege just so that the size of the color picker does not matter.
        });
      }
      if (!fromWorkspace) {
        this.updateCurrentWorkspace(true);
      }
    }

    addColorToCustomList(color) {
      const listItems = window.MozXULElement.parseXULToFragment(`
        <hbox class="zen-theme-picker-custom-list-item">
          <html:div class="zen-theme-picker-dot-custom"></html:div>
          <label class="zen-theme-picker-custom-list-item-label"></label>
          <toolbarbutton class="zen-theme-picker-custom-list-item-remove toolbarbutton-1" oncommand="gZenThemePicker.removeCustomColor(event);"></toolbarbutton>
        </hbox>
      `);
      listItems.querySelector('.zen-theme-picker-custom-list-item').setAttribute('data-color', color);
      listItems.querySelector('.zen-theme-picker-dot-custom').style.setProperty('--zen-theme-picker-dot-color', color);
      listItems.querySelector('.zen-theme-picker-custom-list-item-label').textContent = color;

      this.customColorList.appendChild(listItems);
    }

    async addCustomColor() {
      let color = this.customColorInput.value;

      if (!color) {
        return;
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
      this.panel.querySelector('.zen-theme-picker-gradient').appendChild(dot);
      this.customColorInput.value = '';
      await this.updateCurrentWorkspace();
    }

    spawnDot(relativePosition, primary = false) {
      const dotPad = this.panel.querySelector('.zen-theme-picker-gradient');

      const dot = document.createElement('div');
      dot.classList.add('zen-theme-picker-dot');

      dot.style.left = `${relativePosition.x}px`;
      dot.style.top = `${relativePosition.y}px`;

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

      const colorFromPos = this.getColorFromPosition(relativePosition.x, relativePosition.y);
      dot.style.setProperty('--zen-theme-picker-dot-color', `rgb(${colorFromPos[0]}, ${colorFromPos[1]}, ${colorFromPos[2]})`);

      this.dots.push({
        ID: id,
        element: dot,
        position: { x: relativePosition.x, y: relativePosition.y },
      });
    }

    calculateCompliments(dots, action = 'update', useHarmony = '') {
      const colorHarmonies = [
        { type: 'complementary', angles: [180] },
        { type: 'splitComplementary', angles: [150, 210] },
        { type: 'analogous', angles: [30, 330] },
        { type: 'triadic', angles: [120, 240] },
        { type: 'floating', angles: [] },
      ];

      if (dots.length === 0) {
        return [];
      }

      function getColorHarmonyType(numDots, dots) {
        if (useHarmony !== '') {
          const selectedHarmony = colorHarmonies.find((harmony) => harmony.type === useHarmony);

          if (selectedHarmony) {
            if (action === 'remove') {
              if (dots.length !== 0) {
                return colorHarmonies.find((harmony) => harmony.angles.length === selectedHarmony.angles.length - 1);
              } else {
                return { type: 'floating', angles: [] };
              }
            }
            if (action === 'add') {
              return colorHarmonies.find((harmony) => harmony.angles.length === selectedHarmony.angles.length + 1);
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
      const padding = 20;

      let updatedDots = [...dots];
      const centerPosition = { x: rect.width / 2, y: rect.height / 2 };

      const harmonyAngles = getColorHarmonyType(dots.length + (action === 'add' ? 1 : action === 'remove' ? -1 : 0), this.dots);
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
        updatedDots = [{ ID: 0, position: primaryDot.position }];
      }

      harmonyAngles.angles.forEach((angleOffset, index) => {
        let newAngle = (baseAngle + angleOffset) % 360;
        let radian = (newAngle * Math.PI) / 180;

        let newPosition = {
          x: centerPosition.x + distance * Math.cos(radian),
          y: centerPosition.y + distance * Math.sin(radian),
        };

        updatedDots.push({ ID: index + 1, position: newPosition });
      });

      return updatedDots;
    }

    handleColorPositions(colorPositions) {
      colorPositions.sort((a, b) => a.ID - b.ID);
      if (this.useAlgo === 'floating') {
        const dotPad = this.panel.querySelector('.zen-theme-picker-gradient');
        const rect = dotPad.getBoundingClientRect();
        this.dots.forEach((dot) => {
          dot.element.style.zIndex = 999;

          let pixelX, pixelY;
          if (dot.position.x === null) {
            const leftPercentage = parseFloat(dot.element.style.left) / 100;
            const topPercentage = parseFloat(dot.element.style.top) / 100;

            pixelX = leftPercentage * rect.width;
            pixelY = topPercentage * rect.height;
          } else {
            pixelX = dot.position.x;
            pixelY = dot.position.y;
          }

          const colorFromPos = this.getColorFromPosition(pixelX, pixelY);

          dot.element.style.setProperty(
            '--zen-theme-picker-dot-color',
            `rgb(${colorFromPos[0]}, ${colorFromPos[1]}, ${colorFromPos[2]})`
          );
        });

        return;
      }
      const existingPrimaryDot = this.dots.find((d) => d.ID === 0);

      if (existingPrimaryDot) {
        existingPrimaryDot.element.style.zIndex = 999;
        const colorFromPos = this.getColorFromPosition(existingPrimaryDot.position.x, existingPrimaryDot.position.y);
        existingPrimaryDot.element.style.setProperty(
          '--zen-theme-picker-dot-color',
          `rgb(${colorFromPos[0]}, ${colorFromPos[1]}, ${colorFromPos[2]})`
        );
      }

      colorPositions.forEach((dotPosition) => {
        const existingDot = this.dots.find((dot) => dot.ID === dotPosition.ID);

        if (existingDot) {
          existingDot.position = dotPosition.position;
          const colorFromPos = this.getColorFromPosition(dotPosition.position.x, dotPosition.position.y);
          existingDot.element.style.setProperty(
            '--zen-theme-picker-dot-color',
            `rgb(${colorFromPos[0]}, ${colorFromPos[1]}, ${colorFromPos[2]})`
          );

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
          this.spawnDot(dotPosition.position);
        }
      });
    }

    onThemePickerClick(event) {
      if (this._rotating) {
        return;
      }
      event.preventDefault();
      const target = event.target;
      if (target.id === 'PanelUI-zen-gradient-generator-color-add') {
        if (this.dots.length >= ZenThemePicker.MAX_DOTS) return;
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
      } else if (target.id === 'PanelUI-zen-gradient-generator-color-toggle-algo') {
        const colorHarmonies = [
          { type: 'complementary', angles: [180] },
          { type: 'splitComplementary', angles: [150, 210] },
          { type: 'analogous', angles: [30, 330] },
          { type: 'triadic', angles: [120, 240] },
          { type: 'floating', angles: [] },
        ];

        const applicableHarmonies = colorHarmonies.filter(
          (harmony) => harmony.angles.length + 1 === this.dots.length || harmony.type === 'floating'
        );

        let currentIndex = applicableHarmonies.findIndex((harmony) => harmony.type === this.useAlgo);

        let nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % applicableHarmonies.length;
        this.useAlgo = applicableHarmonies[nextIndex].type;

        let colorPositions = this.calculateCompliments(this.dots, 'update', this.useAlgo);
        this.handleColorPositions(colorPositions);
        this.updateCurrentWorkspace();
        return;
      }

      if (event.button !== 0 || this.dragging || this.recentlyDragged) return;

      const gradient = this.panel.querySelector('.zen-theme-picker-gradient');
      const rect = gradient.getBoundingClientRect();
      const padding = 20;

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
        if (this.dots.length === 0) {
          this.spawnDot({ x: relativeX, y: relativeY }, true);
        } else {
          this.spawnDot({ x: relativeX, y: relativeY });
        }

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
        const padding = 20; // each side
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
      const isDarkMode = this.isDarkMode;
      const factor = isDarkMode ? 0.5 : 1.1;

      return colors.map((color) => ({
        c: color.isCustom
          ? color.c
          : [Math.min(255, color.c[0] * factor), Math.min(255, color.c[1] * factor), Math.min(255, color.c[2] * factor)],
        isCustom: color.isCustom,
        algorithm: color.algorithm,
      }));
    }

    onOpacityChange(event) {
      this.currentOpacity = event.target.value;
      this.updateCurrentWorkspace();
    }

    getToolbarModifiedBase() {
      return this.isDarkMode
        ? 'color-mix(in srgb, var(--zen-themed-toolbar-bg) 80%, #fff 20%)'
        : 'color-mix(in srgb, var(--zen-themed-toolbar-bg) 95%, #000 6%)';
    }

    getSingleRGBColor(color, forToolbar = false) {
      if (color.isCustom) {
        return color.c;
      }
      if (forToolbar) {
        const toolbarBg = this.getToolbarModifiedBase();
        return `color-mix(in srgb, rgb(${color.c[0]}, ${color.c[1]}, ${color.c[2]}) ${this.currentOpacity * 100}%, ${toolbarBg} ${(1 - this.currentOpacity) * 100}%)`;
      }
      return `rgba(${color.c[0]}, ${color.c[1]}, ${color.c[2]}, ${this.currentOpacity})`;
    }

    getGradient(colors, forToolbar = false) {
      const themedColors = this.themedColors(colors);
      this.useAlgo = themedColors[0]?.algorithm ?? '';

      if (themedColors.length === 0) {
        return forToolbar ? 'var(--zen-themed-toolbar-bg)' : 'var(--zen-themed-toolbar-bg-transparent)';
      } else if (themedColors.length === 1) {
        return this.getSingleRGBColor(themedColors[0], forToolbar);
      } else if (themedColors.length !== 3) {
        return `linear-gradient(${this.currentRotation}deg, ${themedColors.map((color) => this.getSingleRGBColor(color, forToolbar)).join(', ')})`;
      } else {
        let color1 = this.getSingleRGBColor(themedColors[2], forToolbar);
        let color2 = this.getSingleRGBColor(themedColors[0], forToolbar);
        let color3 = this.getSingleRGBColor(themedColors[1], forToolbar);
        return `linear-gradient(${this.currentRotation}deg, ${color1}, ${color2}, ${color3})`;
      }
    }

    static getTheme(colors = [], opacity = 0.5, rotation = -45, texture = 0) {
      return {
        type: 'gradient',
        gradientColors: colors ? colors.filter((color) => color) : [], // remove undefined
        opacity,
        rotation,
        texture,
      };
    }
    //TODO: add a better noise system that adds noise not just changes transparency
    updateNoise(texture) {
      document.documentElement.style.setProperty('--zen-grainy-background-opacity', texture);
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
      return [parseInt(hex.substring(0, 2), 16), parseInt(hex.substring(2, 4), 16), parseInt(hex.substring(4, 6), 16)];
    }

    pSBC = (p, c0, c1, l) => {
      let r,
        g,
        b,
        P,
        f,
        t,
        h,
        i = parseInt,
        m = Math.round,
        a = typeof c1 == 'string';
      if (typeof p != 'number' || p < -1 || p > 1 || typeof c0 != 'string' || (c0[0] != 'r' && c0[0] != '#') || (c1 && !a))
        return null;
      if (!this.pSBCr)
        this.pSBCr = (d) => {
          let n = d.length,
            x = {};
          if (n > 9) {
            ([r, g, b, a] = d = d.split(',')), (n = d.length);
            if (n < 3 || n > 4) return null;
            (x.r = i(r[3] == 'a' ? r.slice(5) : r.slice(4))), (x.g = i(g)), (x.b = i(b)), (x.a = a ? parseFloat(a) : -1);
          } else {
            if (n == 8 || n == 6 || n < 4) return null;
            if (n < 6) d = '#' + d[1] + d[1] + d[2] + d[2] + d[3] + d[3] + (n > 4 ? d[4] + d[4] : '');
            d = i(d.slice(1), 16);
            if (n == 9 || n == 5)
              (x.r = (d >> 24) & 255), (x.g = (d >> 16) & 255), (x.b = (d >> 8) & 255), (x.a = m((d & 255) / 0.255) / 1000);
            else (x.r = d >> 16), (x.g = (d >> 8) & 255), (x.b = d & 255), (x.a = -1);
          }
          return x;
        };
      (h = c0.length > 9),
        (h = a ? (c1.length > 9 ? true : c1 == 'c' ? !h : false) : h),
        (f = this.pSBCr(c0)),
        (P = p < 0),
        (t = c1 && c1 != 'c' ? this.pSBCr(c1) : P ? { r: 0, g: 0, b: 0, a: -1 } : { r: 255, g: 255, b: 255, a: -1 }),
        (p = P ? p * -1 : p),
        (P = 1 - p);
      if (!f || !t) return null;
      if (l) (r = m(P * f.r + p * t.r)), (g = m(P * f.g + p * t.g)), (b = m(P * f.b + p * t.b));
      else
        (r = m((P * f.r ** 2 + p * t.r ** 2) ** 0.5)),
          (g = m((P * f.g ** 2 + p * t.g ** 2) ** 0.5)),
          (b = m((P * f.b ** 2 + p * t.b ** 2) ** 0.5));
      (a = f.a), (t = t.a), (f = a >= 0 || t >= 0), (a = f ? (a < 0 ? t : t < 0 ? a : a * P + t * p) : 0);
      if (h) return 'rgb' + (f ? 'a(' : '(') + r + ',' + g + ',' + b + (f ? ',' + m(a * 1000) / 1000 : '') + ')';
      else
        return (
          '#' +
          (4294967296 + r * 16777216 + g * 65536 + b * 256 + (f ? m(a * 255) : 0)).toString(16).slice(1, f ? undefined : -2)
        );
    };

    getMostDominantColor(allColors) {
      const dominantColor = this.getPrimaryColor(allColors);
      const result = this.pSBC(
        this.isDarkMode ? 0.2 : -0.5,
        `rgb(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]})`
      );
      const color = result?.match(/\d+/g).map(Number);
      if (!color || color.length !== 3) {
        return this.getNativeAccentColor();
      }
      return color;
    }

    async onWorkspaceChange(workspace, skipUpdate = false, theme = null) {
      const uuid = workspace.uuid;
      // Use theme from workspace object or passed theme
      let workspaceTheme = theme || workspace.theme;

      await this.foreachWindowAsActive(async (browser) => {
        if (!browser.gZenThemePicker?._hasInitialized) {
          return;
        }
        // Do not rebuild if the workspace is not the same as the current one
        const windowWorkspace = await browser.ZenWorkspaces.getActiveWorkspace();
        if (windowWorkspace.uuid !== uuid && theme !== null) {
          return;
        }

        // get the theme from the window
        workspaceTheme = this.fixTheme(theme || windowWorkspace.theme);

        if (!skipUpdate) {
          for (const dot of browser.gZenThemePicker.panel.querySelectorAll('.zen-theme-picker-dot')) {
            dot.remove();
          }
        }

        const appWrapper = browser.document.getElementById('browser');
        if (!skipUpdate && !this._animatingBackground) {
          this._animatingBackground = true;
          appWrapper.removeAttribute('animating');
          browser.document.documentElement.style.setProperty(
            '--zen-main-browser-background-old',
            browser.document.documentElement.style.getPropertyValue('--zen-main-browser-background')
          );
          browser.window.requestAnimationFrame(() => {
            appWrapper.setAttribute('animating', 'true');
            setTimeout(() => {
              this._animatingBackground = false;
              appWrapper.removeAttribute('animating');
              appWrapper.setAttribute('post-animating', 'true');
              browser.document.documentElement.style.removeProperty('--zen-main-browser-background-old');
              setTimeout(() => {
                // Reactivate the transition after the animation
                appWrapper.removeAttribute('post-animating');
              }, 100);
            }, 300);
          });
        }

        const button = browser.document.getElementById('PanelUI-zen-gradient-generator-color-toggle-algo');
        document.l10n.setAttributes(button, `zen-panel-ui-gradient-generator-algo-${browser.gZenThemePicker.useAlgo}`);

        browser.gZenThemePicker.resetCustomColorList();
        if (!workspaceTheme || workspaceTheme.type !== 'gradient') {
          const gradient = browser.gZenThemePicker.getGradient([]);
          const gradientToolbar = browser.gZenThemePicker.getGradient([], true);
          browser.document.documentElement.style.setProperty('--zen-main-browser-background', gradient);
          browser.document.documentElement.style.setProperty('--zen-main-browser-background-toolbar', gradientToolbar);
          browser.gZenThemePicker.updateNoise(0);
          browser.document.documentElement.style.setProperty('--zen-primary-color', this.getNativeAccentColor());
          return;
        }

        browser.gZenThemePicker.currentOpacity = workspaceTheme.opacity ?? 0.5;
        browser.gZenThemePicker.currentRotation = workspaceTheme.rotation ?? -45;
        browser.gZenThemePicker.currentTexture = workspaceTheme.texture ?? 0;

        for (const button of browser.document.querySelectorAll('#PanelUI-zen-gradient-generator-color-actions button')) {
          // disable if there are no buttons
          button.disabled =
            workspaceTheme.gradientColors.length === 0 ||
            (button.id === 'PanelUI-zen-gradient-generator-color-add'
              ? workspaceTheme.gradientColors.length >= ZenThemePicker.MAX_DOTS
              : false);
        }
        document
          .getElementById('PanelUI-zen-gradient-generator-color-click-to-add')
          .toggleAttribute('hidden', workspaceTheme.gradientColors.length > 0);

        browser.document.getElementById('PanelUI-zen-gradient-generator-opacity').value =
          browser.gZenThemePicker.currentOpacity;
        const textureSelectWrapper = browser.document.getElementById('PanelUI-zen-gradient-generator-texture-wrapper');
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

          const numberOfColors = workspaceTheme.gradientColors?.length;
          const rotationDot = browser.document.getElementById('PanelUI-zen-gradient-generator-rotation-dot');
          const rotationLine = browser.document.getElementById('PanelUI-zen-gradient-generator-rotation-line');
          if (numberOfColors > 1) {
            rotationDot.style.opacity = 1;
            rotationLine.style.opacity = 1;
            rotationDot.style.removeProperty('pointer-events');
            const rotationPadding = 20;
            const rotationParentWidth = rotationDot.parentElement.getBoundingClientRect().width;
            const rotationDotPosition = this.currentRotation;
            const rotationDotWidth = 30;
            const rotationDotX =
              Math.cos((rotationDotPosition * Math.PI) / 180) * (rotationParentWidth / 2 - rotationDotWidth / 2);
            const rotationDotY =
              Math.sin((rotationDotPosition * Math.PI) / 180) * (rotationParentWidth / 2 - rotationDotWidth / 2);
            rotationDot.style.left = `${rotationParentWidth / 2 + rotationDotX - rotationPadding + rotationDotWidth / 4}px`;
            rotationDot.style.top = `${rotationParentWidth / 2 + rotationDotY - rotationPadding + rotationDotWidth / 4}px`;
          } else {
            rotationDot.style.opacity = 0;
            rotationLine.style.opacity = 0;
            rotationDot.style.pointerEvents = 'none';
          }
        }

        const gradient = browser.gZenThemePicker.getGradient(workspaceTheme.gradientColors);
        const gradientToolbar = browser.gZenThemePicker.getGradient(workspaceTheme.gradientColors, true);
        browser.gZenThemePicker.updateNoise(workspaceTheme.texture);

        for (const dot of workspaceTheme.gradientColors) {
          if (dot.isCustom) {
            browser.gZenThemePicker.addColorToCustomList(dot.c);
          }
        }

        browser.document.documentElement.style.setProperty('--zen-main-browser-background-toolbar', gradientToolbar);
        browser.document.documentElement.style.setProperty('--zen-main-browser-background', gradient);

        const dominantColor = this.getMostDominantColor(workspaceTheme.gradientColors);
        if (dominantColor) {
          browser.document.documentElement.style.setProperty(
            '--zen-primary-color',
            typeof dominantColor === 'string'
              ? dominantColor
              : `rgb(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]})`
          );
        }

        if (!skipUpdate) {
          this.dots = [];
          browser.gZenThemePicker.recalculateDots(workspaceTheme.gradientColors);
        }
      });
    }

    fixTheme(theme) {
      // add a primary color if there isn't one
      if (!theme.gradientColors.find((color) => color.isPrimary) && theme.gradientColors.length > 0) {
        theme.gradientColors[(theme.gradientColors.length / 2) | 0].isPrimary = true;
      }
      return theme;
    }

    get riceManager() {
      if (!this._riceManager) {
        this._riceManager = new window.ZenRiceManager();
      }
      return this._riceManager;
    }

    shareTheme() {
      const manager = this.riceManager;
      manager.openShareDialog();
    }

    getNativeAccentColor() {
      return Services.prefs.getStringPref('zen.theme.accent-color');
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
        return this.hexToRgb(this.getNativeAccentColor());
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
          return { c: isCustom ? color : color.match(/\d+/g).map(Number), isCustom, algorithm, isPrimary };
        });
      const gradient = ZenThemePicker.getTheme(colors, this.currentOpacity, this.currentRotation, this.currentTexture);
      let currentWorkspace = await ZenWorkspaces.getActiveWorkspace();

      if (!skipSave) {
        await ZenWorkspacesStorage.saveWorkspaceTheme(currentWorkspace.uuid, gradient);
        await ZenWorkspaces._propagateWorkspaceData();
        gZenUIManager.showToast('zen-panel-ui-gradient-generator-saved-message');
        currentWorkspace = await ZenWorkspaces.getActiveWorkspace();
      }

      await this.onWorkspaceChange(currentWorkspace, true, skipSave ? gradient : null);
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
  }

  window.ZenThemePicker = ZenThemePicker;
}
