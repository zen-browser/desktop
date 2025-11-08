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
    this.initFonts();
    this.loadBoost(domain);
  }

  init() {
    this.window.addEventListener('unload', () => this.handleClose(), { once: true });

    this.doc
      .getElementById('zen-boost-color-contrast')
      .addEventListener('input', this.onColorOptionChange.bind(this));
    this.doc
      .getElementById('zen-boost-color-brightness')
      .addEventListener('input', this.onColorOptionChange.bind(this));
    this.doc
      .getElementById('zen-boost-color-saturation')
      .addEventListener('input', this.onColorOptionChange.bind(this));

    this.doc
      .getElementById('zen-boost-text-case-toggle')
      .addEventListener('click', this.onBoostCasePressed.bind(this));
    this.doc
      .getElementById('zen-boost-size')
      .addEventListener('click', this.onBoostSizePressed.bind(this));
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
      .getElementById('zen-boost-controls')
      .addEventListener('click', (event) => this.openAdvancedColorOptions(event));

    this.doc
      .getElementById('zen-boost-name')
      .addEventListener('input', (e) => (this.currentBoostData.boostName = e.target.value));

    this.doc
      .getElementById('zen-boost-close')
      .addEventListener('click', this.onClosePressed.bind(this));

    this.doc.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' || (event.key === 'w' && (event.ctrlKey || event.metaKey))) {
        this.onClosePressed();
      }
    });

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

  initFonts() {
    const fonts = [
      'Arial, sans-serif',
      "'Times New Roman', serif",
      "'Courier New', monospace",
      "'Georgia', serif",
      "'Comic Sans MS'",
    ];

    const fontButtonGroup = this.doc.getElementById('zen-boost-font-grid');
    const fontSelect = this.doc.getElementById('zen-boost-font-select');
    const buttonCount = 10;

    for (let i = 0; i < Math.min(buttonCount, fonts.length); i++) {
      const fontButton = this.doc.createElement('button');
      fontButton.setAttribute('font-data', `${fonts[i]}`);
      fontButton.classList.add('subviewbutton');
      fontButton.style.fontFamily = fonts[i];
      fontButton.innerHTML = 'Aa';
      fontButton.addEventListener('click', this.onFontButtonClick.bind(this));

      fontButtonGroup.appendChild(fontButton);
    }

    for (let j = 0; j < fonts.length; j++) {
      const font = fonts[j];
      const select = this.doc.createElement('option');
      select.value = font;
      select.innerHTML = font;
      fontSelect.appendChild(select);
    }

    fontSelect.addEventListener('change', this.onFontDropdownSelect.bind(this));
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

      if (event.target.id != 'zen-boost-magic-theme')
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

  onBoostSizePressed() {
    const sizeValue = this.doc.getElementById('zen-boost-size-value');

    if (this.currentBoostData.siteSizeOverride >= 1.5) this.currentBoostData.siteSizeOverride = 0.9;
    else if (this.currentBoostData.siteSizeOverride >= 1.25)
      this.currentBoostData.siteSizeOverride = 1.5;
    else if (this.currentBoostData.siteSizeOverride >= 1.1)
      this.currentBoostData.siteSizeOverride = 1.25;
    else if (this.currentBoostData.siteSizeOverride >= 1)
      this.currentBoostData.siteSizeOverride = 1.1;
    else if (this.currentBoostData.siteSizeOverride >= 0.9)
      this.currentBoostData.siteSizeOverride = 1;
    else this.currentBoostData.siteSizeOverride = 1.1;

    sizeValue.innerHTML = `${Math.round(this.currentBoostData.siteSizeOverride * 100)}%`;

    this.updateSizeButtonVisuals();
    this.updateCurrentBoost();
  }

  onBoostCasePressed() {
    if (this.currentBoostData.textCaseOverride == 'lower')
      this.currentBoostData.textCaseOverride = 'upper';
    else if (this.currentBoostData.textCaseOverride == 'upper')
      this.currentBoostData.textCaseOverride = 'none';
    else this.currentBoostData.textCaseOverride = 'lower';

    this.updateCaseButtonVisuals();
    this.updateCurrentBoost();
  }

  onColorOptionChange() {
    this.currentBoostData.contrast = this.doc.getElementById('zen-boost-color-contrast').value;
    this.currentBoostData.brightness = this.doc.getElementById('zen-boost-color-brightness').value;
    this.currentBoostData.saturation = this.doc.getElementById('zen-boost-color-saturation').value;

    this.updateCurrentBoost();
  }

  openAdvancedColorOptions(event) {
    const panel = this.doc.getElementById('zen-boost-advanced-color-options-panel');
    panel.openPopup(event.target, 'bottomcenter topcenter', 0, 2);
  }

  resetDotPosition() {
    this.setDotPos(null, null);
  }

  onThemePickerClick(event) {
    event.preventDefault();

    this.currentBoostData.changeWasMade = true;

    if (event.target.id == 'zen-boost-magic-theme') {
      this.currentBoostData.autoTheme = !this.currentBoostData.autoTheme;
      this.updateButtonToggleVisuals();
      this.updateCurrentBoost();
    } else this.setDotPos(event.clientX, event.clientY, !this.wasDragging);
    this.wasDragging = false;
  }

  // Sets the position of the dot
  setDotPos(pixelX, pixelY, animate = true) {
    const gradient = this.doc.querySelector('.zen-boost-color-picker-gradient');
    const dot = this.doc.querySelector('.zen-boost-color-picker-dot');

    const rect = gradient.getBoundingClientRect();
    const padding = 50;

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
    if (!this.currentBoostData.enableColorBoost) this.onToggleDisable(false);
    this.currentBoostData.autoTheme = false;

    this.updateButtonToggleVisuals();
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
    const padding = 50;
    const radius = (rect.width - padding) / 2;

    const circle = this.doc.querySelector('.zen-boost-color-picker-circle');
    circle.style.width = `${this.currentBoostData.dotDistance * radius * 2}px`;
    circle.style.height = `${this.currentBoostData.dotDistance * radius * 2}px`;
  }

  // This toggles the color changes
  onToggleDisable(userAction = true) {
    this.currentBoostData.enableColorBoost = !this.currentBoostData.enableColorBoost;

    if (userAction) this.currentBoostData.changeWasMade = true;

    this.updateButtonToggleVisuals();
    this.updateCurrentBoost();
  }

  onToggleInvert(userAction = true) {
    this.currentBoostData.enableColorBoost = true;
    this.currentBoostData.smartInvert = !this.currentBoostData.smartInvert;

    if (userAction) this.currentBoostData.changeWasMade = true;

    this.updateButtonToggleVisuals();
    this.updateCurrentBoost();
  }

  updateSizeButtonVisuals() {
    const sizeValue = this.doc.getElementById('zen-boost-size');

    if (this.currentBoostData.siteSizeOverride >= 1.5) sizeValue.setAttribute('mode', 'red');
    else if (this.currentBoostData.siteSizeOverride >= 1.25)
      sizeValue.setAttribute('mode', 'orange-red');
    else if (this.currentBoostData.siteSizeOverride >= 1.1)
      sizeValue.setAttribute('mode', 'orange');
    else if (this.currentBoostData.siteSizeOverride >= 1) sizeValue.setAttribute('mode', 'none');
    else if (this.currentBoostData.siteSizeOverride >= 0.9) sizeValue.setAttribute('mode', 'blue');
    else sizeValue.setAttribute('mode', 'none');
  }

  updateCaseButtonVisuals() {
    const sizeValue = this.doc.getElementById('zen-boost-text-case-toggle');

    if (this.currentBoostData.textCaseOverride == 'none') sizeValue.setAttribute('mode', 'none');
    else if (this.currentBoostData.textCaseOverride == 'upper')
      sizeValue.setAttribute('mode', 'upper');
    else if (this.currentBoostData.textCaseOverride == 'lower')
      sizeValue.setAttribute('mode', 'lower');
  }

  updateButtonToggleVisuals() {
    const invertButton = this.doc.getElementById('zen-boost-invert');
    const disableButton = this.doc.getElementById('zen-boost-disable');
    const autoThemeButton = this.doc.getElementById('zen-boost-magic-theme');
    const gradient = this.doc.querySelector('.zen-boost-color-picker-gradient');

    if (this.currentBoostData.autoTheme) autoThemeButton.classList.add('zen-boost-button-active');
    else autoThemeButton.classList.remove('zen-boost-button-active');

    if (this.currentBoostData.smartInvert) invertButton.classList.add('zen-boost-button-active');
    else invertButton.classList.remove('zen-boost-button-active');

    if (this.currentBoostData.smartInvert) invertButton.classList.add('zen-boost-button-active');
    else invertButton.classList.remove('zen-boost-button-active');

    if (!this.currentBoostData.enableColorBoost)
      disableButton.classList.add('zen-boost-button-active');
    else disableButton.classList.remove('zen-boost-button-active');

    // Give the gradient a grayscale effect
    // when the color boosting is disabled
    // or the theme is set automatically
    if (!this.currentBoostData.enableColorBoost || this.currentBoostData.autoTheme)
      gradient.classList.add('zen-boost-panel-disabled');
    else gradient.classList.remove('zen-boost-panel-disabled');
  }

  onFontButtonClick(event) {
    const font = event?.target?.getAttribute('font-data') ?? '';
    this.onFontChange(font);
  }

  onFontDropdownSelect(event) {
    const select = event.target;
    this.onFontChange(select.value);
  }

  onFontChange(font) {
    if (this.currentBoostData.fontFamily == font) this.currentBoostData.fontFamily = '';
    else this.currentBoostData.fontFamily = font;
    this.updateFontButtonVisuals();

    this.currentBoostData.changeWasMade = true;
    this.updateCurrentBoost();
  }

  updateFontButtonVisuals() {
    const fontButtonGroup = this.doc.getElementById('zen-boost-font-grid');
    for (let i = 0; i < fontButtonGroup.children.length; i++) {
      const fontButton = fontButtonGroup.children[i];
      if (fontButton.getAttribute('font-data') == this.currentBoostData.fontFamily)
        fontButton.classList.add('zen-boost-font-button-active');
      else fontButton.classList.remove('zen-boost-font-button-active');
    }

    const fontSelect = this.doc.getElementById('zen-boost-font-select');
    for (let i = 0; i < fontSelect.options.length; i++) {
      const option = fontSelect.options[i];
      if (option.value == this.currentBoostData.fontFamily) {
        fontSelect.value = option.value;
        break;
      }
    }
  }

  updateCurrentBoost() {
    gZenBoostsManager.updateBoost(this.currentBoostData);
  }

  onDeleteBoost() {
    gZenBoostsManager.deleteBoost(this.currentBoostData.domain);
    this.currentBoostData = null;
    this.window.gZenUIManager.showToast('zen-panel-ui-boosts-deleted-message');

    this.window.close();
  }

  onClosePressed() {
    this.window.close();
  }

  handleClose() {
    this.uninit();
    if (this.currentBoostData != null && this.currentBoostData.changeWasMade) this.saveBoost();
    else if (this.currentBoostData != null && !this.currentBoostData.changeWasMade)
      gZenBoostsManager.deleteBoost(this.currentBoostData.domain);
  }

  loadBoost(domain) {
    this.currentBoostData = gZenBoostsManager.loadBoostFromStore(domain);

    // Initial save to register the boost
    gZenBoostsManager.saveBoostToStore(this.currentBoostData);

    this.doc.getElementById('zen-boost-name-text').innerHTML = domain;

    const dot = this.doc.querySelector('.zen-boost-color-picker-dot');
    const contrastSlider = this.doc.getElementById('zen-boost-color-contrast');
    const brightnessSlider = this.doc.getElementById('zen-boost-color-brightness');
    const saturationSlider = this.doc.getElementById('zen-boost-color-saturation');

    if (this.currentBoostData.dotPos.x == null || this.currentBoostData.dotPos.y == null)
      this.resetDotPosition();
    else {
      dot.style.left = `${this.currentBoostData.dotPos.x}px`;
      dot.style.top = `${this.currentBoostData.dotPos.y}px`;
      this.updateFontButtonVisuals();
      this.updateSizeButtonVisuals();
      this.updateCaseButtonVisuals();

      contrastSlider.value = this.currentBoostData.contrast;
      brightnessSlider.value = this.currentBoostData.brightness;
      saturationSlider.value = this.currentBoostData.saturation;
    }

    this.updateDot();
    this.updateButtonToggleVisuals();
  }

  saveBoost(showToast = true) {
    if (this.currentBoostData == null || !this.currentBoostData.changeWasMade) return;

    gZenBoostsManager.saveBoostToStore(this.currentBoostData);
    if (showToast) this.window.gZenUIManager.showToast('zen-panel-ui-boosts-saved-message');
  }
}
