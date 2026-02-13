/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { gZenBoostsManager } from "./ZenBoostsManager.sys.mjs";

export class nsZenBoostEditor {
  doc = null;
  window = null;
  openerWindow = null;
  codeEditorReady = false;

  /**
   * Creates a new boost editor instance for the specified domain.
   * @param {Document} doc - The document object for the editor window.
   * @param {string} domain - The domain for which to edit the boost.
   * @param {Window} window - The window object for the editor.
   * @param {Window} openerWindow - The window object which instanced this editor.
   */
  constructor(doc, domain, window, openerWindow) {
    this.doc = doc;
    this.window = window;
    this.openerWindow = openerWindow;

    this._codeEditorWidth = 450;
    this._boostEditorWidth = 185;
    this._pickerCallback = null;

    this.isMouseDown = false;
    this.wasDragging = false;
    this.mouseDownPosition = { x: 0, y: 0 };
    this.lastDotSetPos = { x: 0, y: 0 };
    this.currentBoostData = null;

    this.killOtherEditorInstances();
    Services.obs.addObserver(this, "zen-boosts-kill-editor");
    Services.obs.addObserver(this, "zap-list-update");
    Services.obs.addObserver(this, "zap-state-update");
    Services.obs.addObserver(this, "selector-picker-state-update");

    this.init();
    this.initColorPicker();
    this.initFonts();
    this.loadBoost(domain);
  }

  /**
   * Initializes the boost editor by setting up event listeners for all UI controls.
   */
  init() {
    this.window.addEventListener("unload", () => this.handleClose(), { once: true });

    this.doc.getElementById("zen-boost-editor-root").style.display = "initial";
    this.doc.getElementById("zen-boost-code-editor-root").style.display = "none";

    this.doc
      .getElementById("zen-boost-color-contrast")
      .addEventListener("input", this.onColorOptionChange.bind(this));
    this.doc
      .getElementById("zen-boost-color-brightness")
      .addEventListener("input", this.onColorOptionChange.bind(this));
    this.doc
      .getElementById("zen-boost-color-saturation")
      .addEventListener("input", this.onColorOptionChange.bind(this));

    this.doc
      .getElementById("zen-boost-text-case-toggle")
      .addEventListener("click", this.onBoostCasePressed.bind(this));
    this.doc
      .getElementById("zen-boost-size")
      .addEventListener("click", this.onBoostSizePressed.bind(this));
    this.doc
      .getElementById("zen-boost-zap")
      .addEventListener("click", this.onZapButtonPressed.bind(this));
    this.doc
      .getElementById("zen-boost-code")
      .addEventListener("click", this.onCodeButtonPressed.bind(this));
    this.doc
      .getElementById("zen-boost-back")
      .addEventListener("click", this.onCodeBackButtonPressed.bind(this));
    this.doc
      .getElementById("zen-boost-disable")
      .addEventListener("click", this.onToggleDisable.bind(this));
    this.doc
      .getElementById("zen-boost-invert")
      .addEventListener("click", this.onToggleInvert.bind(this));
    this.doc
      .getElementById("zen-boost-controls")
      .addEventListener("click", (event) => this.openAdvancedColorOptions(event));
    this.doc
      .getElementById("zen-boost-name")
      .addEventListener("input", (e) => (this.currentBoostData.boostName = e.target.value));
    this.doc
      .getElementById("zen-boost-close")
      .addEventListener("click", this.onClosePressed.bind(this));
    this.doc
      .getElementById("zen-boost-shuffle")
      .addEventListener("click", this.onShufflePressed.bind(this));
    this.doc
      .getElementById("zen-boost-css-picker")
      .addEventListener("click", this.onPickerButtonPressed.bind(this));
    this.doc
      .getElementById("zen-boost-css-inspector")
      .addEventListener("click", this.onInspectorButtonPressed.bind(this));

    this.doc.addEventListener("keydown", (event) => {
      if (event.key === "Escape" || (event.key === "w" && (event.ctrlKey || event.metaKey))) {
        this.onClosePressed();
      }
    });

    this.initialized = true;
  }

  /**
   * Uninitializes the boost editor by cleaning up event listeners and observers.
   */
  uninit() {
    this.uninitColorPicker();
    Services.obs.removeObserver(this, "zen-boosts-kill-editor");
    Services.obs.removeObserver(this, "zap-list-update");
    Services.obs.removeObserver(this, "zap-state-update");
    Services.obs.removeObserver(this, "selector-picker-state-update");
  }

  /**
   * Kills other editor instances by sending a notification to close them.
   * This ensures only one editor instance is open at a time.
   */
  killOtherEditorInstances() {
    Services.obs.notifyObservers(null, "zen-boosts-kill-editor");
  }

  /**
   * Observer callback that handles notifications from the observer service.
   * Closes the editor window when a 'zen-boosts-kill-editor' notification is received.
   * @param {Object} subject - The subject of the notification.
   * @param {string} topic - The topic of the notification.
   * @param {*} data - The message data.
   */
  observe(subject, topic, data) {
    switch (topic) {
      case "zap-state-update":
        this.onUpdateZapButtonVisual();
        break;
      case "selector-picker-state-update":
        this.onUpdatePickerButtonVisual();
        this.onUpdatePickerObserver(data);
        break;
      case "selector-picker-picked":
        this.onPickerPickedCallback(data);
        break;
      case "zap-list-update":
        this.onUpdateZapValue();
        this.currentBoostData.changeWasMade = true;
        break;
      case "zen-boosts-kill-editor":
        this.window.close();
        break;
    }
  }

  /**
   * Registers an event listener to close the editor when the active tab changes
   * to a different domain than the one being edited.
   */
  registerTabChangedEvent() {
    this.window.gBrowser.tabContainer.addEventListener("TabSelect", (event) => {
      const tab = event.target;
      const domain = new URL(tab.linkedBrowser.currentURI.spec).hostname;

      if (domain != this.currentBoostData.domain) this.window.close();
    });
  }

  /**
   * Initializes the code editor for the css editor
   */
  async initCodeEditor() {
    if (this.codeEditorReady) return;

    const { DevToolsLoader } = ChromeUtils.importESModule(
      "resource://devtools/shared/loader/Loader.sys.mjs"
    );
    const loader = new DevToolsLoader({
      invisibleToDebugger: true,
    });
    const { require } = loader;
    const Editor = require("resource://devtools/client/shared/sourceeditor/editor");
    const container = this.doc.getElementById("zen-boost-code-editor");

    const editor = new Editor({
      mode: Editor.modes.css,
      lineNumbers: true,
      theme: "default", // default is light theme
      readOnly: false,
      gutters: ["CodeMirror-linenumbers"],
    });

    await editor.appendTo(container);
    editor.refresh();
    editor.on("change", this.onCodeEditorChange.bind(this));

    this.window._editor = editor;
    this.codeEditorReady = true;
  }

  /**
   * Inserts a code snippet at the current cursor position
   * @param {String} code The code to insert
   */
  insertCode(code) {
    if (!code) code = "";

    const cm = this.window._editor.codeMirror;
    const cursor = cm.getCursor(); // { line, ch }
    cm.replaceRange(code, cursor);
    cm.focus();
  }

  /**
   * Inserts a code snippet at the end of the code
   * @param {String} code The code to insert
   */
  appendCode(code) {
    if (!code) code = "";

    const cm = this.window._editor.codeMirror;
    const line = cm.lineCount();
    const content = this.window._editor.getText();
    const ch = 0;

    if(content == '')
      cm.replaceRange(code, { line, ch });
    else  
      cm.replaceRange(`\n${code}`, { line, ch });
    
    cm.focus();
  }

  onCodeEditorChange() {
    this.currentBoostData.customCSS = this.window._editor.getText();
    this.currentBoostData.changeWasMade = true;
    this.updateCurrentBoost();
  }

  get commonFonts() {
    const cFonts = [
      "Arial",
      "Times New Roman",
      "Courier New",
      "Georgia",
      "Comic Sans MS",
      "Verdana",
      "Trebuchet MS",
      "Impact",
      "Palatino Linotype",
      "Tahoma",
    ];
    return cFonts;
  }

  /**
   * Initializes the font selection UI by creating font buttons and dropdown options
   * for the available font families.
   */
  initFonts() {
    const commonFonts = this.commonFonts;
    const fonts = this.fetchFontList();

    const fontButtonGroup = this.doc.getElementById("zen-boost-font-grid");
    const fontList = this.doc.getElementById("zen-boost-font-select");
    const buttonCount = 10;

    for (let i = 0; i < Math.min(commonFonts.length, buttonCount); i++) {
      let font = fonts[i]; // Fallback
      if (fonts.includes(commonFonts[i])) {
        font = commonFonts[i];
      }

      const fontButton = this.doc.createElement("button");
      fontButton.setAttribute("font-data", `${font}`);
      fontButton.classList.add("subviewbutton");
      fontButton.style.fontFamily = `'${font}'`;
      fontButton.innerHTML = "Aa";
      fontButton.addEventListener("click", this.onFontButtonClick.bind(this));

      fontButtonGroup.appendChild(fontButton);
    }

    // Add default value
    const defaultOption = this.doc.createElement("option");
    defaultOption.value = ""; // Use default font of site
    defaultOption.label = "Default";
    fontList.appendChild(defaultOption);

    for (let j = 0; j < fonts.length; j++) {
      const font = fonts[j];
      const option = this.doc.createElement("option");
      option.style.fontFamily = `'${font}'`;
      option.value = font;
      option.label = font;
      fontList.appendChild(option);
    }

    fontList.addEventListener("change", this.onFontDropdownSelect.bind(this));
  }

  /**
   * Fetches a list of all available system fonts.
   * @returns {Array<AString>} An array with names of available fonts.
   */
  fetchFontList() {
    const enumerator = Cc["@mozilla.org/gfx/fontenumerator;1"].createInstance(Ci.nsIFontEnumerator);

    return enumerator.EnumerateFonts(null, null);
  }

  /**
   * Handles the code editor button press, resizing and offsetting the window and enabling the code view
   */
  onCodeButtonPressed() {
    const offset = 265;
    const openRightAligned = this.window.screen.availWidth / 2 < this.window.screenX;
    const windowElem = this.doc.getElementById('zenBoostWindow');

    if(windowElem.getAttribute('editor') == 'code') return;
    windowElem.setAttribute('editor', 'code');

    // Store the old boost editor width. 
    // The window needs the outer width which includes
    // window chrome. This results in the window
    // being smaller than it should be
    this._boostEditorWidth = this.window.outerWidth;

    this.window.resizeTo(this._codeEditorWidth, this.window.outerHeight);
    if (openRightAligned) this.window.moveTo(this.window.screenX - offset, this.window.screenY);

    this.doc.getElementById("zen-boost-editor-root").style.display = "none";
    this.doc.getElementById("zen-boost-code-editor-root").style.display = "initial";
  }

  /**
   * Handles the back button in the code view, resizing and offsetting the window and changing back to boost view
   */
  onCodeBackButtonPressed() {
    const offset = 265;
    const openRightAligned = this.window.screen.availWidth / 2 < this.window.screenX;
    const windowElem = this.doc.getElementById('zenBoostWindow');

    if(windowElem.getAttribute('editor') == 'boost') return;
    windowElem.setAttribute('editor', 'boost');

    this.window.resizeTo(this._boostEditorWidth, this.window.outerHeight);
    if (openRightAligned) this.window.moveTo(this.window.screenX + offset, this.window.screenY);

    this.doc.getElementById("zen-boost-editor-root").style.display = "initial";
    this.doc.getElementById("zen-boost-code-editor-root").style.display = "none";

    // Disable picker mode
    const linkedBrowser = this.openerWindow.gBrowser.selectedTab.linkedBrowser;
    const actor = linkedBrowser.browsingContext.currentWindowGlobal.getActor("ZenBoosts");
    actor.sendQuery("ZenBoost:DisablePickerMode");
  }

  async onZapButtonPressed() {
    const linkedBrowser = this.openerWindow.gBrowser.selectedTab.linkedBrowser;
    const actor = linkedBrowser.browsingContext.currentWindowGlobal.getActor("ZenBoosts");
    actor.sendQuery("ZenBoost:ToggleZapMode");

    // Focus the parent browser window
    this.openerWindow.focus();
  }

  async onPickerButtonPressed() {
    const linkedBrowser = this.openerWindow.gBrowser.selectedTab.linkedBrowser;
    const actor = linkedBrowser.browsingContext.currentWindowGlobal.getActor("ZenBoosts");
    actor.sendQuery("ZenBoost:TogglePickerMode");
  }

  onPickerPickedCallback(cssSelector) {
    const linkedBrowser = this.openerWindow.gBrowser.selectedTab.linkedBrowser;
    const actor = linkedBrowser.browsingContext.currentWindowGlobal.getActor("ZenBoosts");
    actor.sendQuery("ZenBoost:DisablePickerMode");
    
    // Insert the css selector at the cursor position in the css editor
    this.appendCode(`
${cssSelector} {

}`);

    Services.obs.removeObserver(this, "selector-picker-picked");
  }

  onInspectorButtonPressed() {
    const linkedBrowser = this.openerWindow.gBrowser.selectedTab.linkedBrowser;
    const actor = linkedBrowser.browsingContext.currentWindowGlobal.getActor("ZenBoosts");
    actor.sendQuery("ZenBoost:OpenInspector");
  }

  async onUpdateZapButtonVisual() {
    const linkedBrowser = this.openerWindow.gBrowser.selectedTab.linkedBrowser;
    const actor = linkedBrowser.browsingContext.currentWindowGlobal.getActor("ZenBoosts");
    const zapButton = this.doc.getElementById("zen-boost-zap");
    const zapEnabled = await actor.sendQuery("ZenBoost:ZapModeEnabled");

    zapButton.setAttribute("enabled", zapEnabled ? "true" : "false");
  }

  async onUpdatePickerButtonVisual() {
    const linkedBrowser = this.openerWindow.gBrowser.selectedTab.linkedBrowser;
    const actor = linkedBrowser.browsingContext.currentWindowGlobal.getActor("ZenBoosts");
    
    const pickerButton = this.doc.getElementById("zen-boost-css-picker");
    const selectEnabled = await actor.sendQuery("ZenBoost:SelectorPickerModeEnabled");

    pickerButton.setAttribute("enabled", selectEnabled ? "true" : "false");
  }

  onUpdatePickerObserver(data) {
    console.log(data);
    if(!data) return;

    if(data == "onenable")
      Services.obs.addObserver(this, "selector-picker-picked");
    else if (data == "ondisable")
      Services.obs.removeObserver(this, "selector-picker-picked");
  }

  onUpdateZapValue() {
    const zapButton = this.doc.getElementById("zen-boost-zap");
    const zapValueBox = this.doc.getElementById("zen-boost-zap-value");
    const zapCount = this.currentBoostData.zapSelectors.length;

    if (zapCount == 0) {
      zapValueBox.innerHTML = "";
      zapButton.setAttribute("hideicon", "false");
    } else {
      zapValueBox.innerHTML = zapCount;
      zapButton.setAttribute("hideicon", "true");
    }
  }

  /**
   * Initializes the color picker by setting up mouse event listeners for
   * interactive color selection on the gradient picker.
   */
  initColorPicker() {
    const themePicker = this.doc.querySelector(".zen-boost-color-picker-gradient");
    this._onMouseMove = this.onMouseMove.bind(this);
    this._onMouseUp = this.onMouseUp.bind(this);
    this._onMouseDown = this.onMouseDown.bind(this);
    this._onThemePickerClick = this.onThemePickerClick.bind(this);
    this.doc.addEventListener("mousemove", this._onMouseMove);
    this.doc.addEventListener("mouseup", this._onMouseUp);
    themePicker.addEventListener("mousedown", this._onMouseDown);
    themePicker.addEventListener("click", this._onThemePickerClick);
  }

  /**
   * Uninitializes the color picker by removing all mouse event listeners.
   */
  uninitColorPicker() {
    const themePicker = this.doc.querySelector(".zen-boost-color-picker-gradient");
    this.doc.removeEventListener("mousemove", this._onMouseMove);
    this.doc.removeEventListener("mouseup", this._onMouseUp);
    themePicker.removeEventListener("mousedown", this._onMouseDown);
    themePicker.removeEventListener("click", this._onThemePickerClick);
    this._onThemePickerClick = null;
    this._onMouseMove = null;
    this._onMouseUp = null;
    this._onMouseDown = null;
  }

  /**
   * Handles mouse move events to update the color picker dot position while dragging.
   * @param {MouseEvent} event - The mouse move event.
   */
  onMouseMove(event) {
    const minDragDistance = 4;
    let nDistance = Math.sqrt(
      (event.clientX - this.mouseDownPosition.x) ** 2 +
        (event.clientY - this.mouseDownPosition.y) ** 2
    );

    if (this.isMouseDown && nDistance > minDragDistance) {
      this.wasDragging = true;
      event.preventDefault();

      if (event.target.id != "zen-boost-magic-theme")
        this.setDotPos(event.clientX, event.clientY, false);
    }
  }

  /**
   * Handles mouse down events to initiate color picker dragging.
   * @param {MouseEvent} event - The mouse down event.
   */
  onMouseDown(event) {
    if (event.button === 2) {
      return;
    }

    this.mouseDownPosition = { x: event.clientX, y: event.clientY };
    this.isMouseDown = true;
  }

  /**
   * Handles mouse up events to end color picker dragging.
   * @param {MouseEvent} event - The mouse up event.
   */
  onMouseUp(event) {
    if (event.button === 2) {
      return;
    }

    this.isMouseDown = false;
    this.wasDragging = false;
  }

  /**
   * Handles the boost size button press, cycling through size override values
   * (0.9, 1.0, 1.1, 1.25, 1.5) and updating the UI accordingly.
   */
  onBoostSizePressed() {
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

    this.updateSizeButtonVisuals();
    this.updateCurrentBoost();
  }

  /**
   * Handles the text case toggle button press, cycling through case override options
   * (none, lower, upper) and updating the UI accordingly.
   */
  onBoostCasePressed() {
    if (this.currentBoostData.textCaseOverride == "lowercase")
      this.currentBoostData.textCaseOverride = "uppercase";
    else if (this.currentBoostData.textCaseOverride == "uppercase")
      this.currentBoostData.textCaseOverride = "capitalize";
    else if (this.currentBoostData.textCaseOverride == "capitalize")
      this.currentBoostData.textCaseOverride = "none";
    else this.currentBoostData.textCaseOverride = "lowercase";

    this.updateCaseButtonVisuals();
    this.updateCurrentBoost();
  }

  /**
   * Handles changes to color option sliders (contrast, brightness, saturation)
   * and updates the current boost data accordingly.
   */
  onColorOptionChange() {
    this.currentBoostData.contrast = this.doc.getElementById("zen-boost-color-contrast").value;
    this.currentBoostData.brightness = this.doc.getElementById("zen-boost-color-brightness").value;
    this.currentBoostData.saturation = this.doc.getElementById("zen-boost-color-saturation").value;

    this.updateCurrentBoost();
  }

  /**
   * Opens the advanced color options popup panel.
   * @param {Event} event - The click event that triggered this action.
   */
  openAdvancedColorOptions(event) {
    const panel = this.doc.getElementById("zen-boost-advanced-color-options-panel");
    panel.openPopup(event.target, "bottomcenter topcenter", 0, 2);
  }

  /**
   * Resets the color picker dot to the center position (default state).
   */
  resetDotPosition() {
    this.setDotPos(null, null);
  }

  /**
   * Handles clicks on the theme picker gradient or magic theme button.
   * Updates the dot position or toggles auto-theme mode based on the click target.
   * @param {MouseEvent} event - The click event.
   */
  onThemePickerClick(event) {
    event.preventDefault();

    this.currentBoostData.changeWasMade = true;

    if (event.target.id == "zen-boost-magic-theme") {
      this.currentBoostData.autoTheme = !this.currentBoostData.autoTheme;
      this.updateButtonToggleVisuals();
      this.updateCurrentBoost();
    } else this.setDotPos(event.clientX, event.clientY, !this.wasDragging);
    this.wasDragging = false;
  }

  /**
   * Sets the position of the color picker dot on the gradient and updates
   * the boost data with the corresponding angle and distance values.
   * @param {number|null} pixelX - The X coordinate in pixels, or null to center the dot.
   * @param {number|null} pixelY - The Y coordinate in pixels, or null to center the dot.
   * @param {boolean} animate - Whether to animate the dot movement (currently not implemented).
   */
  setDotPos(pixelX, pixelY, animate = true) {
    const gradient = this.doc.querySelector(".zen-boost-color-picker-gradient");
    const dot = this.doc.querySelector(".zen-boost-color-picker-dot");

    const rect = gradient.getBoundingClientRect();
    const padding = 50;
    const border = 8;

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
      pixelX = centerX + border;
      pixelY = centerY + border;

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

    dot.setAttribute("animated", animate ? "true" : "false");
    dot.style.left = `${relativeX}px`;
    dot.style.top = `${relativeY}px`;

    // Enable color boosting again
    if (!this.currentBoostData.enableColorBoost) this.onToggleDisable(false);
    this.currentBoostData.autoTheme = false;

    // Updating the circle size to match the distance of the point
    const circle = this.doc.querySelector(".zen-boost-color-picker-circle");
    circle.setAttribute("animated", animate ? "true" : "false");
    circle.style.width = `${this.currentBoostData.dotDistance * radius * 2}px`;
    circle.style.height = `${this.currentBoostData.dotDistance * radius * 2}px`;

    this.updateButtonToggleVisuals();
    this.updateDot();
    this.updateCurrentBoost();
  }

  /**
   * Updates the visual appearance of the color picker dot and circle
   * based on the current boost data's angle and distance values.
   */
  updateDot() {
    const dot = this.doc.querySelector(".zen-boost-color-picker-dot");
    dot.style.setProperty(
      "--zen-theme-picker-dot-color",
      `hsl(${this.currentBoostData.dotAngleDeg}deg, ${this.currentBoostData.dotDistance * 100}%, 55%)`
    );
  }

  /**
   * Toggles the color boost enable/disable state.
   * @param {boolean} userAction - Whether this was triggered by a user action (default: true).
   */
  onToggleDisable(userAction = true) {
    this.currentBoostData.enableColorBoost = !this.currentBoostData.enableColorBoost;

    if (userAction) this.currentBoostData.changeWasMade = true;

    this.updateButtonToggleVisuals();
    this.updateCurrentBoost();
  }

  /**
   * Toggles the smart invert feature, which automatically inverts colors
   * based on the window's color scheme.
   * @param {boolean} userAction - Whether this was triggered by a user action (default: true).
   */
  onToggleInvert(userAction = true) {
    this.currentBoostData.enableColorBoost = true;
    this.currentBoostData.smartInvert = !this.currentBoostData.smartInvert;

    if (userAction) this.currentBoostData.changeWasMade = true;

    this.updateButtonToggleVisuals();
    this.updateCurrentBoost();
  }

  /**
   * Updates the visual state of the size button based on the current
   * site size override value, setting appropriate color modes.
   */
  updateSizeButtonVisuals() {
    const sizeBox = this.doc.getElementById("zen-boost-size");
    const sizeValue = this.doc.getElementById("zen-boost-size-value");
    sizeValue.innerHTML = `${Math.round(this.currentBoostData.siteSizeOverride * 100)}%`;

    if (this.currentBoostData.siteSizeOverride >= 1.5) sizeBox.setAttribute("mode", "red");
    else if (this.currentBoostData.siteSizeOverride >= 1.25)
      sizeBox.setAttribute("mode", "orange-red");
    else if (this.currentBoostData.siteSizeOverride >= 1.1) sizeBox.setAttribute("mode", "orange");
    else if (this.currentBoostData.siteSizeOverride >= 1) sizeBox.setAttribute("mode", "none");
    else if (this.currentBoostData.siteSizeOverride >= 0.9) sizeBox.setAttribute("mode", "blue");
    else sizeBox.setAttribute("mode", "none");
  }

  /**
   * Updates the visual state of the text case toggle button based on the current
   * text case override value (none, upper, or lower).
   */
  updateCaseButtonVisuals() {
    const sizeValue = this.doc.getElementById("zen-boost-text-case-toggle");
    sizeValue.setAttribute("mode", this.currentBoostData.textCaseOverride);
  }

  /**
   * Updates the visual state of all toggle buttons (invert, disable, auto-theme)
   * and applies grayscale effect to the gradient when color boosting is disabled.
   */
  updateButtonToggleVisuals() {
    const invertButton = this.doc.getElementById("zen-boost-invert");
    const disableButton = this.doc.getElementById("zen-boost-disable");
    const autoThemeButton = this.doc.getElementById("zen-boost-magic-theme");
    const gradient = this.doc.querySelector(".zen-boost-color-picker-gradient");

    if (this.currentBoostData.autoTheme) autoThemeButton.classList.add("zen-boost-button-active");
    else autoThemeButton.classList.remove("zen-boost-button-active");

    if (this.currentBoostData.smartInvert) invertButton.classList.add("zen-boost-button-active");
    else invertButton.classList.remove("zen-boost-button-active");

    if (this.currentBoostData.smartInvert) invertButton.classList.add("zen-boost-button-active");
    else invertButton.classList.remove("zen-boost-button-active");

    if (!this.currentBoostData.enableColorBoost)
      disableButton.classList.add("zen-boost-button-active");
    else disableButton.classList.remove("zen-boost-button-active");

    // Give the gradient a grayscale effect
    // when the color boosting is disabled
    // or the theme is set automatically
    if (!this.currentBoostData.enableColorBoost || this.currentBoostData.autoTheme)
      gradient.classList.add("zen-boost-panel-disabled");
    else gradient.classList.remove("zen-boost-panel-disabled");
  }

  /**
   * Updates the value of the sliders with the current boost data
   */
  updateColorControlSliderVisuals() {
    const contrastSlider = this.doc.getElementById("zen-boost-color-contrast");
    const brightnessSlider = this.doc.getElementById("zen-boost-color-brightness");
    const saturationSlider = this.doc.getElementById("zen-boost-color-saturation");

    contrastSlider.value = this.currentBoostData.contrast;
    brightnessSlider.value = this.currentBoostData.brightness;
    saturationSlider.value = this.currentBoostData.saturation;
  }

  /**
   * Handles font button clicks to change the selected font family.
   * @param {Event} event - The click event from a font button.
   */
  onFontButtonClick(event) {
    const font = event?.target?.getAttribute("font-data") ?? "";
    this.onFontChange(font);
  }

  /**
   * Handles font dropdown selection changes to change the selected font family.
   * @param {Event} event - The change event from the font dropdown.
   */
  onFontDropdownSelect(event) {
    const select = event.target;
    this.onFontChange(select.value);
  }

  /**
   * Changes the font family for the boost. If the same font is selected again,
   * it clears the font override (sets to empty string).
   * @param {string} font - The font family string to apply.
   */
  onFontChange(font) {
    if (this.currentBoostData.fontFamily == font) this.currentBoostData.fontFamily = "";
    else this.currentBoostData.fontFamily = font;
    this.updateFontButtonVisuals();

    this.currentBoostData.changeWasMade = true;
    this.updateCurrentBoost();
  }

  /**
   * Updates the visual state of font selection buttons and dropdown
   * to reflect the currently selected font family.
   */
  updateFontButtonVisuals() {
    const fontButtonGroup = this.doc.getElementById("zen-boost-font-grid");
    for (let i = 0; i < fontButtonGroup.children.length; i++) {
      const fontButton = fontButtonGroup.children[i];
      if (fontButton.getAttribute("font-data") == this.currentBoostData.fontFamily)
        fontButton.classList.add("zen-boost-font-button-active");
      else fontButton.classList.remove("zen-boost-font-button-active");
    }

    const fontSelect = this.doc.getElementById("zen-boost-font-select");
    for (let i = 0; i < fontSelect.options.length; i++) {
      const option = fontSelect.options[i];
      if (option.value == this.currentBoostData.fontFamily) {
        fontSelect.value = option.value;
        break;
      }
    }
  }

  /**
   * Updates the boost data in the boosts manager with the current boost data.
   * This triggers notifications to observers but does not persist to disk.
   */
  updateCurrentBoost() {
    gZenBoostsManager.updateBoost(this.currentBoostData);
  }

  /**
   * Deletes the current boost for the domain and closes the editor window.
   */
  onDeleteBoost() {
    gZenBoostsManager.deleteBoost(this.currentBoostData.domain);
    this.currentBoostData = null;
    this.window.close();
  }

  /**
   * Handles the close button press by closing the editor window.
   */
  onClosePressed() {
    this.window.close();
  }

  /**
   * Shuffles the boost data and updates the presentation
   */
  onShufflePressed() {
    const availFonts = this.fetchFontList();
    const commonFonts = this.commonFonts;
    let font = commonFonts[Math.round(Math.random() * commonFonts.length)];
    if (availFonts.includes(font)) this.currentBoostData.fontFamily = font;

    this.currentBoostData.smartInvert = Math.random() > 0.5 ? true : false;
    this.currentBoostData.autoTheme = false;

    this.currentBoostData.brightness = Math.random();
    this.currentBoostData.contrast = Math.random();
    this.currentBoostData.saturation = Math.random();

    const gradient = this.doc.querySelector(".zen-boost-color-picker-gradient");
    const rect = gradient.getBoundingClientRect();
    this.setDotPos(
      Math.round(rect.left + Math.random() * rect.width),
      Math.round(rect.top + Math.random() * rect.height),
      true
    );

    this.updateColorControlSliderVisuals();
    this.updateButtonToggleVisuals();
    this.updateDot();
    this.updateCurrentBoost();
  }

  /**
   * Handles the editor window close event. Saves the boost if changes were made,
   * or deletes it if no changes were made (temporary boost).
   */
  handleClose() {
    this.uninit();
    if (this.currentBoostData != null && this.currentBoostData.changeWasMade) this.saveBoost();
    else if (this.currentBoostData != null && !this.currentBoostData.changeWasMade)
      gZenBoostsManager.deleteBoost(this.currentBoostData.domain);

    Services.obs.notifyObservers(null, "zen-boosts-disable-zap", null);
    Services.obs.notifyObservers(null, "zen-boosts-disable-picker", null);
  }

  /**
   * Loads boost data for the specified domain and initializes the editor UI
   * with the boost settings (dot position, sliders, buttons, etc.).
   * @param {string} domain - The domain for which to load the boost.
   */
  async loadBoost(domain) {
    this.currentBoostData = gZenBoostsManager.loadBoostFromStore(domain);

    // Initial save to register the boost
    gZenBoostsManager.saveBoostToStore(this.currentBoostData);
    this.doc.getElementById("zen-boost-name-text").innerHTML = domain;
    const dot = this.doc.querySelector(".zen-boost-color-picker-dot");

    if (this.currentBoostData.dotPos.x == null || this.currentBoostData.dotPos.y == null)
      this.resetDotPosition();
    else {
      dot.style.left = `${this.currentBoostData.dotPos.x}px`;
      dot.style.top = `${this.currentBoostData.dotPos.y}px`;
      this.updateFontButtonVisuals();
      this.updateSizeButtonVisuals();
      this.updateCaseButtonVisuals();

      this.updateColorControlSliderVisuals();
    }

    // The code editor needs time to initialize
    await this.initCodeEditor();

    this.window._editor.setText(this.currentBoostData.customCSS || "");

    this.updateDot();
    this.updateButtonToggleVisuals();
    this.onUpdateZapValue();
  }

  /**
   * Saves the current boost data to persistent storage if changes were made.
   */
  saveBoost() {
    if (this.currentBoostData == null || !this.currentBoostData.changeWasMade) return;
    gZenBoostsManager.saveBoostToStore(this.currentBoostData);
  }
}
