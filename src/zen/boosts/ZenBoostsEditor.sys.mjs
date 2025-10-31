// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { gZenBoostsManager } from './ZenBoostsManager.sys.mjs';

export class nsZenBoostEditor {
  doc = null;
  window = null;

  constructor(doc, domain, window) {
    this.doc = doc;
    this.window = window;

    this.isMouseDown = false;
    this.wasDragging = false;
    this.lastDotSetPos = { x: 0, y: 0 };
    this.currentBoostData = null;

    this.killOtherEditorInstances();
    Services.obs.addObserver(this, 'zen-boosts-kill-editor');

    this.init();
    this.initColorPicker();
    this.loadBoost(domain);
  }

  init() {
    this.window.addEventListener('unload', () => this.handleClose());

    this.doc
      .getElementById('zen-boost-font-arial')
      .addEventListener('click', (event) => this.onFontChange(event, 'Arial, sans-serif'));
    this.doc
      .getElementById('zen-boost-font-serif')
      .addEventListener('click', (event) => this.onFontChange(event, "'Times New Roman', serif"));
    this.doc
      .getElementById('zen-boost-font-mono')
      .addEventListener('click', (event) => this.onFontChange(event, "'Courier New', monospace"));
    this.doc
      .getElementById('zen-boost-font-georgia')
      .addEventListener('click', (event) => this.onFontChange(event, "'Georgia', serif"));
    this.doc
      .getElementById('zen-boost-font-tahoma')
      .addEventListener('click', (event) => this.onFontChange(event, 'Tahoma'));
    this.doc
      .getElementById('zen-boost-font-verdana')
      .addEventListener('click', (event) => this.onFontChange(event, 'Verdana'));
    this.doc
      .getElementById('zen-boost-font-comic')
      .addEventListener('click', (event) => this.onFontChange(event, "'Comic Sans MS'"));
    this.doc
      .getElementById('zen-boost-font-corsiva')
      .addEventListener('click', (event) =>
        this.onFontChange(event, "'Monotype Corsiva, cursive'")
      );

    this.doc
      .getElementById('zen-boost-zap')
      .addEventListener('click', () => console.error('Not implemented'));
    this.doc
      .getElementById('zen-boost-disable')
      .addEventListener('click', this.onToggleDisable.bind(this));
    this.doc
      .getElementById('zen-boost-invert')
      .addEventListener('click', this.onToggleInvert.bind(this));
    this.doc
      .getElementById('zen-boost-delete')
      .addEventListener('click', this.onDeleteBoost.bind(this));

    this.doc
      .getElementById('zen-boost-name')
      .addEventListener('input', (e) => (this.currentBoostData.boostName = e.target.value));

    this.initialized = true;
  }

  uninit() {
    this.uninitColorPicker();
    Services.obs.removeObserver(this, 'zen-boosts-kill-editor');
  }

  killOtherEditorInstances() {
    Services.obs.notifyObservers(null, 'zen-boosts-kill-editor');
  }

  observe(subject, topic) {
    if (topic === 'zen-boosts-kill-editor') {
      this.window.close();
    }
  }

  registerTabChangedEvent() {
    this.window.gBrowser.tabContainer.addEventListener('TabSelect', (event) => {
      const tab = event.target;
      const domain = new URL(tab.linkedBrowser.currentURI.spec).hostname;

      if (domain != this.currentBoostData.domain) this.window.close();
    });
  }

  initColorPicker() {
    const themePicker = this.doc.querySelector('.zen-boost-color-picker-gradient');
    this._onMouseMove = this.onMouseMove.bind(this);
    this._onMouseUp = this.onMouseUp.bind(this);
    this._onMouseDown = this.onMouseDown.bind(this);
    this._onThemePickerClick = this.onThemePickerClick.bind(this);
    this.doc.addEventListener('mousemove', this._onMouseMove);
    this.doc.addEventListener('mouseup', this._onMouseUp);
    themePicker.addEventListener('mousedown', this._onMouseDown);
    themePicker.addEventListener('click', this._onThemePickerClick);
  }

  uninitColorPicker() {
    const themePicker = this.doc.querySelector('.zen-boost-color-picker-gradient');
    this.doc.removeEventListener('mousemove', this._onMouseMove);
    this.doc.removeEventListener('mouseup', this._onMouseUp);
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
    const gradient = this.doc.querySelector('.zen-boost-color-picker-gradient');
    const dot = this.doc.querySelector('.zen-boost-color-picker-dot');

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

    // TODO: Fix animation
    // if (animate) {
    //   this.window.motion.animate(
    //     dot,
    //     {
    //       left: `${relativeX}px`,
    //       top: `${relativeY}px`,
    //     },
    //     {
    //       duration: 0.4,
    //       type: 'spring',
    //       bounce: 0.3,
    //     }
    //   );
    // } else {
    dot.style.left = `${relativeX}px`;
    dot.style.top = `${relativeY}px`;
    // }

    // Enable color boosting again
    if (!this.currentBoostData.enableColorBoost) this.onToggleDisable(null);

    this.updateDot();
    this.updateCurrentBoost();
  }

  updateDot() {
    const dot = this.doc.querySelector('.zen-boost-color-picker-dot');
    dot.style.setProperty(
      '--zen-theme-picker-dot-color',
      `hsl(${this.currentBoostData.dotAngleDeg}deg, ${this.currentBoostData.dotDistance * 100}%, 55%)`
    );

    const gradient = this.doc.querySelector('.zen-boost-color-picker-gradient');
    const rect = gradient.getBoundingClientRect();
    const padding = 40;
    const radius = (rect.width - padding) / 2;

    const circle = this.doc.querySelector('.zen-boost-color-picker-circle');
    circle.style.width = `${this.currentBoostData.dotDistance * radius * 2}px`;
    circle.style.height = `${this.currentBoostData.dotDistance * radius * 2}px`;
  }

  // This toggles the color changes
  onToggleDisable() {
    this.currentBoostData.enableColorBoost = !this.currentBoostData.enableColorBoost;

    this.updateButtonToggleVisuals();
    this.updateCurrentBoost();
  }

  onToggleInvert() {
    this.currentBoostData.smartInvert = !this.currentBoostData.smartInvert;

    this.updateButtonToggleVisuals();
    this.updateCurrentBoost();
  }

  updateButtonToggleVisuals() {
    const invertButton = this.doc.getElementById('zen-boost-invert');
    const disableButton = this.doc.getElementById('zen-boost-disable');
    const gradient = this.doc.querySelector('.zen-boost-color-picker-gradient');

    if (this.currentBoostData.smartInvert) invertButton.classList.add('zen-boost-button-active');
    else invertButton.classList.remove('zen-boost-button-active');

    if (!this.currentBoostData.enableColorBoost)
      disableButton.classList.add('zen-boost-button-active');
    else disableButton.classList.remove('zen-boost-button-active');

    if (!this.currentBoostData.enableColorBoost) gradient.classList.add('zen-boost-panel-disabled');
    else gradient.classList.remove('zen-boost-panel-disabled');
  }

  onFontChange(event, fontFamily) {
    if (this.currentBoostData.fontFamily == fontFamily) this.currentBoostData.fontFamily = '';
    else this.currentBoostData.fontFamily = fontFamily;

    this.updateCurrentBoost();
  }

  updateCurrentBoost() {
    gZenBoostsManager.updateBoost(this.currentBoostData);
  }

  onDeleteBoost() {
    this.window.prompt;

    gZenBoostsManager.deleteBoost(this.currentBoostData.domain);
    this.currentBoostData = null;

    // Still write modifications to disk
    gZenBoostsManager.saveBoostToStore(null);
    this.window.gZenUIManager.showToast('zen-panel-ui-boosts-deleted-message');

    this.window.close();
  }

  handleClose() {
    this.uninit();
    if (this.currentBoostData != null) this.saveBoost();
  }

  loadBoost(domain) {
    this.currentBoostData = gZenBoostsManager.loadBoostFromStore(domain);
    
    // Initial save to register the boost
    gZenBoostsManager.saveBoostToStore(null);

    this.doc.getElementById('zen-boost-name').value = this.currentBoostData.boostName;

    const dot = this.doc.querySelector('.zen-boost-color-picker-dot');
    if (this.currentBoostData.dotPos.x == null || this.currentBoostData.dotPos.y == null)
      this.resetDotPosition();
    else {
      dot.style.left = `${this.currentBoostData.dotPos.x}px`;
      dot.style.top = `${this.currentBoostData.dotPos.y}px`;
    }

    this.updateDot();
    this.updateButtonToggleVisuals();
  }

  saveBoost() {
    gZenBoostsManager.saveBoostToStore(this.currentBoostData);
    this.window.gZenUIManager.showToast('zen-panel-ui-boosts-saved-message');
  }
}
