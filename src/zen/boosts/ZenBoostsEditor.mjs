// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

{
  class nsZenBoostEditor extends nsZenMultiWindowFeature {
    initialized = false;

    constructor() {
      super();

      if (!gZenWorkspaces.shouldHaveWorkspaces || gZenWorkspaces.privateWindowOrDisabled) {
        return;
      }

      this.isMouseDown = false;
      this.wasDragging = false;
      this.lastDotSetPos = { x: 0, y: 0 };
      this.currentBoostData = null;

      this.promiseInitialized = new Promise((resolve) => {
        this._resolveInitialized = resolve;
      });

      ChromeUtils.defineLazyGetter(this, 'panel', () =>
        document.getElementById('PanelUI-zen-boost-editor')
      );

      ChromeUtils.defineLazyGetter(this, 'toolbox', () => document.getElementById('TabsToolbar'));

      this._resolveInitialized();
      delete this._resolveInitialized;
    }

    tryInitialize() {
      if (this.initialized) return;
      if (document.getElementById('PanelUI-zen-boost-editor')) {
        this.panel.addEventListener('popupshowing', this.handlePanelOpen.bind(this));
        this.panel.addEventListener('popuphidden', this.handlePanelClose.bind(this));
        this.panel.addEventListener('command', this.handlePanelCommand.bind(this));

        document
          .getElementById('PanelUI-zen-boost-font-arial')
          .addEventListener('click', (event) => this.onFontChange(event, 'Arial, sans-serif'));
        document
          .getElementById('PanelUI-zen-boost-font-serif')
          .addEventListener('click', (event) =>
            this.onFontChange(event, "'Times New Roman', serif")
          );
        document
          .getElementById('PanelUI-zen-boost-font-mono')
          .addEventListener('click', (event) =>
            this.onFontChange(event, "'Courier New', monospace")
          );
        document
          .getElementById('PanelUI-zen-boost-font-georgia')
          .addEventListener('click', (event) => this.onFontChange(event, "'Georgia', serif"));
        document
          .getElementById('PanelUI-zen-boost-font-tahoma')
          .addEventListener('click', (event) => this.onFontChange(event, 'Tahoma'));
        document
          .getElementById('PanelUI-zen-boost-font-verdana')
          .addEventListener('click', (event) => this.onFontChange(event, 'Verdana'));
        document
          .getElementById('PanelUI-zen-boost-font-comic')
          .addEventListener('click', (event) => this.onFontChange(event, "'Comic Sans MS'"));
        document
          .getElementById('PanelUI-zen-boost-font-corsiva')
          .addEventListener('click', (event) =>
            this.onFontChange(event, "'Monotype Corsiva, cursive'")
          );

        document
          .getElementById('PanelUI-zen-boost-zap')
          .addEventListener('click', (event) => console.error('Not implemented'));
        document
          .getElementById('PanelUI-zen-boost-disable')
          .addEventListener('click', this.onToggleDisable.bind(this));
        document
          .getElementById('PanelUI-zen-boost-invert')
          .addEventListener('click', this.onToggleInvert.bind(this));
        document
          .getElementById('PanelUI-zen-boost-delete')
          .addEventListener('click', this.onDeleteBoost.bind(this));

        document
          .getElementById('PanelUI-zen-boost-name')
          .addEventListener('input', (e) => (this.currentBoostData.boostName = e.target.value));

        this.initialized = true;
      } else {
        console.error('Panel element PanelUI-zen-boost-editor not found');
        return;
      }
    }

    initColorPicker() {
      const themePicker = this.panel.querySelector('.zen-boost-color-picker-gradient');
      this._onMouseMove = this.onMouseMove.bind(this);
      this._onMouseUp = this.onMouseUp.bind(this);
      this._onMouseDown = this.onMouseDown.bind(this);
      this._onThemePickerClick = this.onThemePickerClick.bind(this);
      document.addEventListener('mousemove', this._onMouseMove);
      document.addEventListener('mouseup', this._onMouseUp);
      themePicker.addEventListener('mousedown', this._onMouseDown);
      themePicker.addEventListener('click', this._onThemePickerClick);
    }

    uninitColorPicker() {
      const themePicker = this.panel.querySelector('.zen-boost-color-picker-gradient');
      document.removeEventListener('mousemove', this._onMouseMove);
      document.removeEventListener('mouseup', this._onMouseUp);
      themePicker.removeEventListener('mousedown', this._onMouseDown);
      themePicker.removeEventListener('click', this._onThemePickerClick);
      this._onThemePickerClick = null;
      this._onMouseMove = null;
      this._onMouseUp = null;
      this._onMouseDown = null;
    }

    onMouseMove(event) {
      if (this.isMouseDown) {
        this.wasDragging = true;
        event.preventDefault();
        this.setDotPos(event.clientX, event.clientY, false);
      }
    }

    onMouseDown(event) {
      if (event.button === 2) {
        return;
      }

      this.isMouseDown = true;
    }

    onMouseUp(event) {
      if (event.button === 2) {
        return;
      }

      this.isMouseDown = false;
      this.wasDragging = false;
    }

    resetDotPosition() {
      this.setDotPos(null, null);
    }

    onThemePickerClick(event) {
      event.preventDefault();

      this.setDotPos(event.clientX, event.clientY, !this.wasDragging);
      this.wasDragging = false;
    }

    // Sets the position of the dot
    setDotPos(pixelX, pixelY, animate = true) {
      const gradient = this.panel.querySelector('.zen-boost-color-picker-gradient');
      const dot = this.panel.querySelector('.zen-boost-color-picker-dot');
      
      const rect = gradient.getBoundingClientRect();
      const padding = 40;

      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const radius = (rect.width - padding) / 2;

      if (!animate) {
        let nDistance = Math.sqrt(
          (pixelX - this.lastDotSetPos.x) ** 2 + (pixelY - this.lastDotSetPos.y) ** 2
        );

        if (nDistance > 15) {
          // Optional haptic feedback
          // Services.zen.playHapticFeedback();

          this.lastDotSetPos = {
            x: pixelX,
            y: pixelY,
          };
        }
      }

      if (pixelX == null || pixelY == null) {
        pixelX = centerX;
        pixelY = centerY;

        this.currentBoostData.dotAngleDeg = 0;
        this.currentBoostData.dotDistance = 0;
        this.currentBoostData.dotAngleRad = 0;
      } else {
        let distance = Math.sqrt((pixelX - centerX) ** 2 + (pixelY - centerY) ** 2);
        distance = Math.min(distance, radius); // Clamp distance

        const angle = Math.atan2(pixelY - centerY, pixelX - centerX);

        pixelX = centerX + Math.cos(angle) * distance;
        pixelY = centerY + Math.sin(angle) * distance;

        // Rad to degree
        this.currentBoostData.dotAngleDeg =
          ((Math.atan2(pixelY - centerY, pixelX - centerX) * 180) / Math.PI + 100) % 360;
        if (this.currentBoostData.dotAngleDeg < 0) this.currentBoostData.dotAngleDeg += 360;

        // Map to 0-1 range
        this.currentBoostData.dotDistance = distance / radius;
      }

      const relativeX = pixelX - rect.left;
      const relativeY = pixelY - rect.top;

      // Capture position of dot for restoring it correctly later
      this.currentBoostData.dotPos.x = relativeX;
      this.currentBoostData.dotPos.y = relativeY;

      if (animate) {
        gZenUIManager.motion.animate(
          dot,
          {
            left: `${relativeX}px`,
            top: `${relativeY}px`,
          },
          {
            duration: 0.4,
            type: 'spring',
            bounce: 0.3,
          }
        );
      } else {
        dot.style.left = `${relativeX}px`;
        dot.style.top = `${relativeY}px`;
      }

      // Enable color boosting again
      if(!this.currentBoostData.enableColorBoost)
        this.onToggleDisable(null);

      this.updateDot();
      this.updateCurrentBoost();
    }

    updateDot() {
      const dot = this.panel.querySelector('.zen-boost-color-picker-dot');
      dot.style.setProperty(
        '--zen-theme-picker-dot-color',
        `hsl(${this.currentBoostData.dotAngleDeg}deg, ${this.currentBoostData.dotDistance * 100}%, 55%)`
      );
    }

    // This toggles the color changes
    onToggleDisable(event) {
      this.currentBoostData.enableColorBoost = !this.currentBoostData.enableColorBoost;

      this.updateButtonToggleVisuals();
      this.updateCurrentBoost();
    }

    onToggleInvert(event) {
      this.currentBoostData.smartInvert = !this.currentBoostData.smartInvert;

      this.updateButtonToggleVisuals();
      this.updateCurrentBoost();
    }

    updateButtonToggleVisuals() {
      const invertButton = document.getElementById('PanelUI-zen-boost-invert');
      const disableButton = document.getElementById('PanelUI-zen-boost-disable');
      const gradient = this.panel.querySelector('.zen-boost-color-picker-gradient');

      if (this.currentBoostData.smartInvert) invertButton.classList.add('zen-boost-button-active');
      else invertButton.classList.remove('zen-boost-button-active');

      if (!this.currentBoostData.enableColorBoost)
        disableButton.classList.add('zen-boost-button-active');
      else disableButton.classList.remove('zen-boost-button-active');

      if (!this.currentBoostData.enableColorBoost)
        gradient.classList.add('zen-boost-panel-disabled');
      else gradient.classList.remove('zen-boost-panel-disabled');
    }

    onFontChange(event, fontFamily) {
      if (this.currentBoostData.fontFamily == fontFamily) this.currentBoostData.fontFamily = '';
      else this.currentBoostData.fontFamily = fontFamily;

      this.updateCurrentBoost();
    }

    updateCurrentBoost() {
      window.gZenBoostsManager.updateBoost(this.currentBoostData);
    }

    onDeleteBoost() {
      window.gZenBoostsManager.deleteBoost(this.currentBoostData.domain);
      this.currentBoostData = null;
      
      PanelMultiView.hidePopup(this.panel);

      // Still write modifications to disk
      window.gZenBoostsManager.saveBoostToStore(null);
      gZenUIManager.showToast('zen-panel-ui-boosts-deleted-message');
    }

    openEditor(event, domain) {
      this.tryInitialize();
      this.loadBoost(domain);

      PanelMultiView.openPopup(this.panel, this.toolbox, {
        position: 'topright topleft',
        triggerEvent: event,
        y: 0,
      });
    }

    handlePanelClose() {
      this.uninitColorPicker();
      if(this.currentBoostData != null)
        this.saveBoost();
    }

    handlePanelOpen() {
      this.initColorPicker();
    }

    loadBoost(domain) {
      const dot = this.panel.querySelector('.zen-boost-color-picker-dot');
      this.currentBoostData = window.gZenBoostsManager.loadBoostFromStore(domain);
      
      document.getElementById('PanelUI-zen-boost-name').value = this.currentBoostData.boostName;

      // TODO: This doesn't work, it should center the dot
      if(this.currentBoostData.dotPos.x == null || this.currentBoostData.dotPos.y == null) this.resetDotPosition();
      else {
        dot.style.left = `${this.currentBoostData.dotPos.x}px`;
        dot.style.top = `${this.currentBoostData.dotPos.y}px`;
      }

      this.updateDot();
      this.updateButtonToggleVisuals();
    }

    saveBoost() {
      window.gZenBoostsManager.saveBoostToStore(this.currentBoostData);
      gZenUIManager.showToast('zen-panel-ui-boosts-saved-message');
    }

    handlePanelCommand(event) {}
  }

  window.gZenBoostsEditor = new nsZenBoostEditor();
}
