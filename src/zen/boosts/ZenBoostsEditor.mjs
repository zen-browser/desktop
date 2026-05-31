/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const { gZenBoostsManager } = ChromeUtils.importESModule(
  "resource:///modules/zen/boosts/ZenBoostsManager.sys.mjs"
);

export class nsZenBoostEditor {
  doc = null;
  editorWindow = null;
  openerWindow = null;
  codeEditorReady = false;

  static OBSERVERS = [
    "zen-boosts-kill-editor",
    "zap-list-update",
    "zap-state-update",
    "selector-picker-state-update",
    "zen-boosts-active-change",
  ];

  /**
   * Creates a new boost editor instance for the specified domain.
   *
   * @param {Document} doc - The document object for the editor window.
   * @param {string} domain - The domain for which to edit the boost.
   * @param {Window} editorWindow - The window object for the editor.
   * @param {Window} openerWindow - The window object which instanced this editor.
   */
  constructor(doc, domain, editorWindow, openerWindow) {
    this.doc = doc;
    this.editorWindow = editorWindow;
    this.openerWindow = openerWindow;

    this._codeEditorWidth = 450;
    this._boostEditorWidth = 185;
    this._pickerCallback = null;

    this.isMouseDown = false;
    this.wasDragging = false;
    this.dragTarget = "";
    this.mouseDownPosition = { x: 0, y: 0 };
    this.lastDotSetPos = { x: 0, y: 0 };
    this.currentBoostData = null;
    this.boostInfo = null;

    this.killOtherEditorInstances();

    nsZenBoostEditor.OBSERVERS.forEach(observe => {
      Services.obs.addObserver(this, observe);
    });

    this.init();
    this.initColorPicker();
    this.initFonts();
    this.loadBoost(domain);
  }

  /**
   * Initializes the boost editor by setting up event listeners for all UI controls.
   */
  init() {
    this.editorWindow.addEventListener("unload", () => this.handleClose(), {
      once: true,
    });

    this.doc.getElementById("zenBoostWindow").setAttribute("editor", "boost");
    this.doc.getElementById("zen-boost-editor-root").style.display = "flex";
    this.doc.getElementById("zen-boost-code-editor-root").style.display =
      "none";

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
      .getElementById("zen-boost-case")
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
      .addEventListener("click", event => this.openAdvancedColorOptions(event));
    this.doc
      .getElementById("zen-boost-name-container")
      .addEventListener("click", this.onNameTextClick.bind(this));
    this.doc
      .getElementById("zen-boost-close")
      .addEventListener("click", this.onClosePressed.bind(this));
    this.doc
      .getElementById("zen-boost-shuffle")
      .addEventListener("click", this.shuffleBoost.bind(this));
    this.doc
      .getElementById("zen-boost-css-picker")
      .addEventListener("click", this.onPickerButtonPressed.bind(this));
    this.doc
      .getElementById("zen-boost-css-inspector")
      .addEventListener("click", this.onInspectorButtonPressed.bind(this));

    this.doc.addEventListener("keydown", event => {
      if (
        event.key === "Escape" ||
        (event.key === "w" && (event.ctrlKey || event.metaKey))
      ) {
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

    nsZenBoostEditor.OBSERVERS.forEach(observe => {
      Services.obs.removeObserver(this, observe);
    });
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
   *
   * @param {object} subject - The subject of the notification.
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
        this.editorWindow.close();
        break;
      case "zen-boosts-active-change":
        this.editorWindow.close();
        break;
    }
  }

  /**
   * Initializes the code editor for the css editor
   */
  async initCodeEditor() {
    if (this.codeEditorReady) {
      return;
    }

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

    this.editorWindow._editor = editor;
    this.codeEditorReady = true;
  }

  /**
   * Inserts a code snippet at the current cursor position
   *
   * @param {string} code The code to insert
   */
  insertCode(code) {
    if (!code) {
      code = "";
    }

    const cm = this.editorWindow._editor.codeMirror;
    const cursor = cm.getCursor(); // { line, ch }
    cm.replaceRange(code, cursor);
    cm.focus();
  }

  /**
   * Inserts a code snippet at the end of the code
   *
   * @param {string} code The code to insert
   */
  appendCode(code) {
    if (!code) {
      code = "";
    }

    const cm = this.editorWindow._editor.codeMirror;
    const line = cm.lineCount();
    const content = this.editorWindow._editor.getText();
    const ch = 0;

    if (content == "") {
      cm.replaceRange(code, { line, ch });
    } else {
      cm.replaceRange(`\n${code}`, { line, ch });
    }

    cm.focus();
  }

  onCodeEditorChange() {
    this.currentBoostData.customCSS = this.editorWindow._editor.getText();
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
      "Helvetica",
      "Garamond",
      "Century Gothic",
      "Arial Black",
      "Papyrus",
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
    const buttonCount = 15;

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
      fontButton.title = font;
      fontButton.addEventListener("click", this.onFontButtonClick.bind(this));

      fontButtonGroup.appendChild(fontButton);
    }

    // Add default value
    const defaultOption = this.doc.createElement("option");
    defaultOption.value = ""; // Use default font of site
    defaultOption.label = "Default";
    fontList.appendChild(defaultOption);
    fontList.appendChild(this.doc.createElement("hr"));

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
   *
   * @returns {Array<AString>} An array with names of available fonts.
   */
  fetchFontList() {
    const enumerator = Cc["@mozilla.org/gfx/fontenumerator;1"].createInstance(
      Ci.nsIFontEnumerator
    );

    return enumerator.EnumerateFonts(null, null);
  }

  /**
   * Handles the code editor button press, resizing and offsetting the window and enabling the code view
   */
  onCodeButtonPressed() {
    const offset = 265;
    const openRightAligned =
      this.openerWindow.screenX + this.openerWindow.outerWidth / 2 <
      this.editorWindow.screenX;
    const windowElem = this.doc.getElementById("zenBoostWindow");

    if (windowElem.getAttribute("editor") == "code") {
      return;
    }
    windowElem.setAttribute("editor", "code");

    // Store the old boost editor width.
    // The window needs the outer width which includes
    // window chrome. This results in the window
    // being smaller than it should be
    this._boostEditorWidth = this.editorWindow.outerWidth;

    this.editorWindow.requestAnimationFrame(() => {
      this.editorWindow.resizeTo(
        this._codeEditorWidth,
        this.editorWindow.outerHeight
      );
      if (openRightAligned) {
        this.editorWindow.moveTo(
          this.editorWindow.screenX - offset,
          this.editorWindow.screenY
        );
      }

      this.doc.getElementById("zen-boost-editor-root").style.display = "none";
      this.doc.getElementById("zen-boost-code-editor-root").style.display =
        "initial";
    });
  }

  /**
   * Handles the back button in the code view, resizing and offsetting the window and changing back to boost view
   */
  onCodeBackButtonPressed() {
    const offset = 265;
    const openRightAligned =
      this.openerWindow.screenX + this.openerWindow.outerWidth / 2 <
      this.editorWindow.screenX;
    const windowElem = this.doc.getElementById("zenBoostWindow");

    if (windowElem.getAttribute("editor") == "boost") {
      return;
    }
    windowElem.setAttribute("editor", "boost");

    this.editorWindow.requestAnimationFrame(() => {
      this.editorWindow.resizeTo(
        this._boostEditorWidth,
        this.editorWindow.outerHeight
      );
      if (openRightAligned) {
        this.editorWindow.moveTo(
          this.editorWindow.screenX + offset,
          this.editorWindow.screenY
        );
      }

      this.doc.getElementById("zen-boost-editor-root").style.display = "flex";
      this.doc.getElementById("zen-boost-code-editor-root").style.display =
        "none";
    });

    // Disable picker mode
    this.disableAllPickers();
  }

  async onZapButtonPressed() {
    const linkedBrowser = this.openerWindow.gBrowser.selectedTab.linkedBrowser;
    const actor =
      linkedBrowser.browsingContext.currentWindowGlobal.getActor("ZenBoosts");
    actor.sendQuery("ZenBoost:ToggleZapMode");

    // Focus the parent browser window
    this.openerWindow.focus();
  }

  async onPickerButtonPressed() {
    const linkedBrowser = this.openerWindow.gBrowser.selectedTab.linkedBrowser;
    const actor =
      linkedBrowser.browsingContext.currentWindowGlobal.getActor("ZenBoosts");
    actor.sendQuery("ZenBoost:TogglePickerMode");
    this.openerWindow.focus();
  }

  onPickerPickedCallback(cssSelector) {
    this.disableAllPickers();

    // Insert the css selector at the cursor position in the css editor
    this.appendCode(`
${cssSelector} {

}`);

    Services.obs.removeObserver(this, "selector-picker-picked");
  }

  /**
   * Disables zap mode and picker mode
   */
  disableAllPickers() {
    Services.obs.notifyObservers(null, "zen-boosts-disable-zap");
    Services.obs.notifyObservers(null, "zen-boosts-disable-picker");
  }

  onInspectorButtonPressed() {
    const linkedBrowser = this.openerWindow.gBrowser.selectedTab.linkedBrowser;
    const actor =
      linkedBrowser.browsingContext.currentWindowGlobal.getActor("ZenBoosts");
    actor.sendQuery("ZenBoost:OpenInspector");
  }

  async onUpdateZapButtonVisual() {
    const linkedBrowser = this.openerWindow.gBrowser.selectedTab.linkedBrowser;
    const actor =
      linkedBrowser.browsingContext.currentWindowGlobal.getActor("ZenBoosts");
    const zapButton = this.doc.getElementById("zen-boost-zap");

    const zapEnabled = await actor.sendQuery("ZenBoost:ZapModeEnabled");
    // Checks if there are any zaps
    const zapAny = await actor.sendQuery("ZenBoost:ZapModeAny");

    zapButton.setAttribute("enabled", zapEnabled || zapAny ? "true" : "false");
  }

  async onUpdatePickerButtonVisual() {
    const linkedBrowser = this.openerWindow.gBrowser.selectedTab.linkedBrowser;
    const actor =
      linkedBrowser.browsingContext.currentWindowGlobal.getActor("ZenBoosts");

    const pickerButton = this.doc.getElementById("zen-boost-css-picker");
    const selectEnabled = await actor.sendQuery(
      "ZenBoost:SelectorPickerModeEnabled"
    );

    pickerButton.setAttribute("enabled", selectEnabled ? "true" : "false");
  }

  onUpdatePickerObserver(data) {
    if (!data) {
      return;
    }

    if (data == "onenable") {
      Services.obs.addObserver(this, "selector-picker-picked");
    } else if (data == "ondisable") {
      Services.obs.removeObserver(this, "selector-picker-picked");
    }
  }

  onUpdateZapValue() {
    const zapButton = this.doc.getElementById("zen-boost-zap");
    const zapValueBox = this.doc.getElementById("zen-boost-zap-value");
    const zapCount = this.currentBoostData.zapSelectors.length;

    if (zapCount == 0) {
      zapValueBox.textContent = "";
      zapButton.setAttribute("hideicon", "false");
    } else {
      zapValueBox.textContent = zapCount;
      zapButton.setAttribute("hideicon", "true");
    }
  }

  /**
   * Initializes the color picker by setting up mouse event listeners for
   * interactive color selection on the gradient picker.
   */
  initColorPicker() {
    const themePicker = this.doc.querySelector(
      ".zen-boost-color-picker-gradient"
    );
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
    const themePicker = this.doc.querySelector(
      ".zen-boost-color-picker-gradient"
    );
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
   *
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

      this.currentBoostData.changeWasMade = true;
      this.updateButtonToggleVisuals();

      if (this.dragTarget == "zen-boost-color-picker-dot-secondary") {
        this.setSecondaryDotPos(event.clientX, event.clientY);
      } else if (event.target.id != "zen-boost-magic-theme") {
        this.setDotPos(event.clientX, event.clientY, false);
      }
    }
  }

  /**
   * Handles mouse down events to initiate color picker dragging.
   *
   * @param {MouseEvent} event - The mouse down event.
   */
  onMouseDown(event) {
    if (event.button === 2) {
      return;
    }

    this.mouseDownPosition = { x: event.clientX, y: event.clientY };
    this.isMouseDown = true;
    this.dragTarget = event.target.id;
  }

  /**
   * Handles mouse up events to end color picker dragging.
   *
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
   * Handles the text case toggle button press, cycling through case override options
   * (none, lower, upper) and updating the UI accordingly.
   */
  onBoostCasePressed() {
    if (this.currentBoostData.textCaseOverride == "uppercase") {
      this.currentBoostData.textCaseOverride = "lowercase";
    } else if (this.currentBoostData.textCaseOverride == "lowercase") {
      this.currentBoostData.textCaseOverride = "capitalize";
    } else if (this.currentBoostData.textCaseOverride == "capitalize") {
      this.currentBoostData.textCaseOverride = "none";
    } else {
      this.currentBoostData.textCaseOverride = "uppercase";
    }

    this.updateCaseButtonVisuals();
    this.updateCurrentBoost();
  }

  /**
   * Handles the size toggle button press, cycling through size override options
   */
  onBoostSizePressed() {
    if (this.currentBoostData.sizeOverride == 1) {
      this.currentBoostData.sizeOverride = 1.1;
    } else if (this.currentBoostData.sizeOverride == 1.1) {
      this.currentBoostData.sizeOverride = 1.25;
    } else if (this.currentBoostData.sizeOverride == 1.25) {
      this.currentBoostData.sizeOverride = 1.5;
    } else if (this.currentBoostData.sizeOverride == 1.5) {
      this.currentBoostData.sizeOverride = 0.9;
    } else if (this.currentBoostData.sizeOverride == 0.9) {
      this.currentBoostData.sizeOverride = 1;
    }

    this.updateSizeButtonVisuals();
    this.updateCurrentBoost();
  }

  /**
   * Handles changes to color option sliders (contrast, brightness, saturation)
   * and updates the current boost data accordingly.
   */
  onColorOptionChange() {
    this.currentBoostData.contrast = this.doc.getElementById(
      "zen-boost-color-contrast"
    ).value;
    this.currentBoostData.brightness = this.doc.getElementById(
      "zen-boost-color-brightness"
    ).value;
    this.currentBoostData.saturation = this.doc.getElementById(
      "zen-boost-color-saturation"
    ).value;

    this.updateCurrentBoost();
  }

  /**
   * Opens the advanced color options popup panel.
   *
   * @param {Event} event - The click event that triggered this action.
   */
  openAdvancedColorOptions(event) {
    const panel = this.doc.getElementById(
      "zen-boost-advanced-color-options-panel"
    );
    panel.openPopup(event.target, "bottomcenter topcenter", 0, 2);
  }

  /**
   * Handles clicks on the theme picker gradient or magic theme button.
   * Updates the dot position or toggles auto-theme mode based on the click target.
   *
   * @param {MouseEvent} event - The click event.
   */
  onThemePickerClick(event) {
    event.preventDefault();

    this.currentBoostData.changeWasMade = true;

    this.currentBoostData.enableColorBoost = true;

    if (event.target.id == "zen-boost-magic-theme") {
      this.currentBoostData.autoTheme = !this.currentBoostData.autoTheme;
      this.updateCurrentBoost();
    } else if (this.dragTarget != "zen-boost-color-picker-dot-secondary") {
      this.setDotPos(event.clientX, event.clientY, !this.wasDragging);
    }

    this.updateButtonToggleVisuals();
    this.wasDragging = false;
  }

  /**
   * Sets the position of the color picker dot on the gradient and updates
   * the boost data with the corresponding angle and distance values.
   *
   * @param {number|null} pixelX - The X coordinate in pixels, or null to center the dot.
   * @param {number|null} pixelY - The Y coordinate in pixels, or null to center the dot.
   * @param {boolean} animate - Whether to animate the dot movement (currently not implemented).
   */
  setDotPos(pixelX, pixelY, animate = true) {
    const gradient = this.doc.querySelector(".zen-boost-color-picker-gradient");
    const dot = this.doc.querySelector("#zen-boost-color-picker-dot-primary");
    const dotSec = this.doc.querySelector(
      "#zen-boost-color-picker-dot-secondary"
    );

    const rect = gradient.getBoundingClientRect();
    const padding = 50;

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const radius = (rect.width - padding) / 2;

    let pixelXSec = pixelX;
    let pixelYSec = pixelY;

    if (!animate) {
      let nDistance = Math.sqrt(
        (pixelX - this.lastDotSetPos.x) ** 2 +
          (pixelY - this.lastDotSetPos.y) ** 2
      );

      if (nDistance > 15) {
        this.lastDotSetPos = {
          x: pixelX,
          y: pixelY,
        };
      }
    }

    if (pixelX == null || pixelY == null) {
      pixelX = centerX;
      pixelY = centerY;
      pixelXSec = centerX;
      pixelYSec = centerY;

      this.currentBoostData.dotAngleDeg = 0;
      this.currentBoostData.dotDistance = 0;
    } else {
      let distance = Math.sqrt(
        (pixelX - centerX) ** 2 + (pixelY - centerY) ** 2
      );
      distance = Math.min(distance, radius); // Clamp distance

      // Primary dot

      const angle = Math.atan2(pixelY - centerY, pixelX - centerX);
      pixelX = centerX + Math.cos(angle) * distance;
      pixelY = centerY + Math.sin(angle) * distance;

      // Rad to degree
      this.currentBoostData.dotAngleDeg =
        ((Math.atan2(pixelY - centerY, pixelX - centerX) * 180) / Math.PI +
          100) %
        360;
      if (this.currentBoostData.dotAngleDeg < 0) {
        this.currentBoostData.dotAngleDeg += 360;
      }

      // Map to 0-1 range
      this.currentBoostData.dotDistance = distance / radius;

      // Secondary dot

      const angleSec =
        (angle +
          (this.currentBoostData.secondaryDotAngleDegDelta * Math.PI) / 180) %
        (Math.PI * 2);
      pixelXSec = centerX + Math.cos(angleSec) * distance;
      pixelYSec = centerY + Math.sin(angleSec) * distance;

      // Enable color boosting again
      if (!this.currentBoostData.enableColorBoost) {
        this.onToggleDisable(false);
      }
      this.currentBoostData.autoTheme = false;
    }

    const relativeX = pixelX - rect.left;
    const relativeY = pixelY - rect.top;
    const relativeXSec = pixelXSec - rect.left;
    const relativeYSec = pixelYSec - rect.top;

    // Capture normalized position of dot for restoring it correctly later
    this.currentBoostData.dotPos.x = relativeX / rect.width;
    this.currentBoostData.dotPos.y = relativeY / rect.height;

    // Make sure to update store to feature proper new secondary position
    this.currentBoostData.secondaryDotPos.x = relativeXSec / rect.width;
    this.currentBoostData.secondaryDotPos.y = relativeYSec / rect.height;

    dot.setAttribute("animated", animate ? "true" : "false");
    dot.style.left = `${relativeX}px`;
    dot.style.top = `${relativeY}px`;
    dotSec.setAttribute("animated", animate ? "true" : "false");
    dotSec.style.left = `${relativeXSec}px`;
    dotSec.style.top = `${relativeYSec}px`;

    this.updateButtonToggleVisuals();
    this.updateDot();
    this.updateCircleRadius();
    this.updateCurrentBoost();
  }

  /**
   * Updates the visual appearance of the color picker dot
   * based on the current boost data's angle and distance values.
   */
  updateDot() {
    const dot = this.doc.querySelector("#zen-boost-color-picker-dot-primary");
    const dotSec = this.doc.querySelector(
      "#zen-boost-color-picker-dot-secondary"
    );

    const dotDistance = this.currentBoostData.dotDistance;
    const dotAngleDeg = this.currentBoostData.dotAngleDeg;
    const secondaryDotAngleDelta =
      this.currentBoostData.secondaryDotAngleDegDelta ?? 0;

    dot.style.setProperty(
      "--zen-theme-picker-dot-color",
      `hsl(${dotAngleDeg}deg, ${dotDistance * 100}%, 55%)`
    );
    dotSec.style.setProperty(
      "--zen-theme-picker-dot-color",
      `hsl(${dotAngleDeg + secondaryDotAngleDelta}deg, ${dotDistance * 100}%, 20%)`
    );
  }

  /**
   * Sets the position of the secondary color picker dot on the gradient and updates
   * the boost data with the corresponding angle values.
   *
   * @param {number|null} pixelX - The X coordinate in pixels.
   * @param {number|null} pixelY - The Y coordinate in pixels.
   */
  setSecondaryDotPos(pixelX, pixelY) {
    const gradient = this.doc.querySelector(".zen-boost-color-picker-gradient");
    const dotSec = this.doc.querySelector(
      "#zen-boost-color-picker-dot-secondary"
    );

    const rect = gradient.getBoundingClientRect();
    const padding = 50;

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const radius = (rect.width - padding) / 2;

    const dotDistance = this.currentBoostData.dotDistance;
    const primaryDotAngleDeg = this.currentBoostData.dotAngleDeg;

    let angle = null;
    if (pixelX == null || pixelY == null) {
      pixelX = centerX;
      pixelY = centerY;
      angle = this.currentBoostData.secondaryDotAngleDegDelta;
    } else {
      angle = Math.atan2(pixelY - centerY, pixelX - centerX);
      pixelX = centerX + Math.cos(angle) * dotDistance * radius;
      pixelY = centerY + Math.sin(angle) * dotDistance * radius;
    }

    // Rad to degree
    this.currentBoostData.secondaryDotAngleDegDelta =
      ((angle * 180) / Math.PI + 100 - primaryDotAngleDeg) % 360;
    if (this.currentBoostData.secondaryDotAngleDegDelta < 0) {
      this.currentBoostData.secondaryDotAngleDegDelta += 360;
    }

    const relativeX = pixelX - rect.left;
    const relativeY = pixelY - rect.top;

    // Capture normalized position of dot for restoring it correctly later
    this.currentBoostData.secondaryDotPos.x = relativeX / rect.width;
    this.currentBoostData.secondaryDotPos.y = relativeY / rect.height;

    dotSec.setAttribute("animated", "false");
    dotSec.style.left = `${relativeX}px`;
    dotSec.style.top = `${relativeY}px`;

    this.updateButtonToggleVisuals();
    this.updateDot();
    this.updateCircleRadius();
    this.updateCurrentBoost();
  }

  /**
   * Updates the radius of the circle based on the dot's position.
   */
  updateCircleRadius() {
    const gradient = this.doc.querySelector(".zen-boost-color-picker-gradient");
    const rect = gradient.getBoundingClientRect();
    const padding = 50;
    const radius = (rect.width - padding) / 2;
    const cx = rect.width / 2;
    const cy = rect.height / 2;

    const dotDistance = this.currentBoostData.dotDistance;
    const dotAngleDeg = this.currentBoostData.dotAngleDeg;
    const secondaryDotAngleDelta =
      this.currentBoostData.secondaryDotAngleDegDelta ?? 0;

    // Updating the circle size to match the distance of the point
    const circle = this.doc.querySelector(".zen-boost-color-picker-circle");
    circle.setAttribute("animated", "false");
    circle.style.width = `${dotDistance * radius * 2}px`;
    circle.style.height = `${dotDistance * radius * 2}px`;

    const dotColor = `hsl(${dotAngleDeg}deg, ${dotDistance * 100}%, 55%)`;
    const dotColorSec = `hsl(${dotAngleDeg + secondaryDotAngleDelta}deg, ${dotDistance * 100}%, 20%)`;

    this.updateArcFill(cx, cy, radius, dotColor, dotColorSec);
  }

  /**
   * Updates the filled gradient arc between both color dots
   *
   * @param {number} cx - Half width of the gradient area
   * @param {number} cy - Half height of the gradient area
   * @param {number} radius - The target radius of the circle
   * @param {string} color1 - Primary css color
   * @param {string} color2 - Secondary css color
   */
  updateArcFill(cx, cy, radius, color1, color2) {
    const svg = this.doc.querySelector(".zen-boost-color-picker-arc-svg");

    // Create SVG if it doesn't exist
    if (!svg) {
      this.initArcSVG();
      this.updateArcFill(cx, cy, radius, color1, color2);
      return;
    }

    const angle1 = this.currentBoostData.dotAngleDeg;
    const angle2 =
      this.currentBoostData.dotAngleDeg +
      this.currentBoostData.secondaryDotAngleDegDelta;
    const dist = this.currentBoostData.dotDistance;
    const r = dist * radius;
    const thickness = 2;

    const toXY = (deg, ra) => {
      const rad = ((deg - 90) * Math.PI) / 180;
      return [cx + ra * Math.cos(rad), cy + ra * Math.sin(rad)];
    };

    const [x1, y1] = toXY(angle1, r);
    const [x2, y2] = toXY(angle2, r);

    // Gradient endpoints for matched dot positions
    const grad = svg.querySelector("#arc-gradient");
    grad.querySelector("#ag-stop1").setAttribute("stop-color", color1);
    grad.querySelector("#ag-stop2").setAttribute("stop-color", color2);
    grad.setAttribute("x1", x1);
    grad.setAttribute("y1", y1);
    grad.setAttribute("x2", x2);
    grad.setAttribute("y2", y2);

    // Ring sector path
    const outerR = r + thickness / 2;
    const innerR = Math.max(r - thickness / 2, 1);
    const delta = (angle2 - angle1 + 360) % 360;
    const large = delta > 180 ? 1 : 0;
    const [ox1, oy1] = toXY(angle1, outerR);
    const [ox2, oy2] = toXY(angle2, outerR);
    const [ix2, iy2] = toXY(angle2, innerR);
    const [ix1, iy1] = toXY(angle1, innerR);

    const d = `M ${ox1} ${oy1} A ${outerR} ${outerR} 0 ${large} 1 ${ox2} ${oy2} L ${ix2} ${iy2} A ${innerR} ${innerR} 0 ${large} 0 ${ix1} ${iy1} Z`;
    svg.querySelector(".arc-fill").setAttribute("d", d);
  }

  /**
   * Initializes the filled gradient arc between both color picker dots in form of a svg
   */
  initArcSVG() {
    const NS = "http://www.w3.org/2000/svg";
    const container = this.doc.querySelector(
      ".zen-boost-color-picker-gradient"
    );

    if (!container.clientWidth || !container.clientHeight) {
      return;
    }

    const w = container.clientWidth;
    const h = container.clientHeight;

    const svg = this.doc.createElementNS(NS, "svg");
    svg.classList.add("zen-boost-color-picker-arc-svg");
    svg.setAttribute("width", w);
    svg.setAttribute("height", h);
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.style.cssText =
      "position:absolute; top:0; left:0; pointer-events:none; z-index:3;";

    const defs = this.doc.createElementNS(NS, "defs");
    const grad = this.doc.createElementNS(NS, "linearGradient");
    grad.setAttribute("id", "arc-gradient");
    grad.setAttribute("gradientUnits", "userSpaceOnUse");

    const stop1 = this.doc.createElementNS(NS, "stop");
    stop1.setAttribute("id", "ag-stop1");
    stop1.setAttribute("offset", "0%");

    const stop2 = this.doc.createElementNS(NS, "stop");
    stop2.setAttribute("id", "ag-stop2");
    stop2.setAttribute("offset", "100%");

    grad.appendChild(stop1);
    grad.appendChild(stop2);
    defs.appendChild(grad);
    svg.appendChild(defs);

    // Arc fill path
    const arcFill = this.doc.createElementNS(NS, "path");
    arcFill.classList.add("arc-fill");
    arcFill.setAttribute("fill", "url(#arc-gradient)");
    arcFill.setAttribute("opacity", "0.65");
    svg.appendChild(arcFill);

    container.style.position = "relative";
    container.appendChild(svg);
  }

  /**
   * Toggles the color boost enable/disable state.
   *
   * @param {boolean} userAction - Whether this was triggered by a user action (default: true).
   */
  onToggleDisable(userAction = true) {
    this.currentBoostData.enableColorBoost =
      !this.currentBoostData.enableColorBoost;

    if (userAction) {
      this.currentBoostData.changeWasMade = true;
    }

    this.updateButtonToggleVisuals();
    this.updateCurrentBoost();
  }

  /**
   * Toggles the smart invert feature, which automatically inverts colors
   * based on the window's color scheme.
   *
   * @param {boolean} userAction - Whether this was triggered by a user action (default: true).
   */
  onToggleInvert(userAction = true) {
    this.currentBoostData.smartInvert = !this.currentBoostData.smartInvert;

    if (userAction) {
      this.currentBoostData.changeWasMade = true;
    }

    this.updateButtonToggleVisuals();
    this.updateCurrentBoost();
  }

  /**
   * Updates the visual state of the text case toggle button based on the current
   * text case override value (none, upper, or lower).
   */
  updateCaseButtonVisuals() {
    const caseButton = this.doc.getElementById("zen-boost-case");
    const caseText = this.doc.getElementById("zen-boost-case-text");
    caseButton.setAttribute(
      "case-mode",
      this.currentBoostData.textCaseOverride
    );

    switch (this.currentBoostData.textCaseOverride) {
      case "uppercase":
        caseButton.setAttribute("mode", "orange");
        caseText.style.display = "none";
        break;
      case "lowercase":
        caseButton.setAttribute("mode", "orange-red");
        caseText.style.display = "none";
        break;
      case "capitalize":
        caseButton.setAttribute("mode", "red");
        caseText.style.display = "none";
        break;
      default:
        caseButton.setAttribute("mode", "none");
        caseText.style.display = "initial";
        break;
    }
  }

  /**
   * Updates the visual state of the text case toggle button based on the current
   * text case override value (none, upper, or lower).
   */
  updateSizeButtonVisuals() {
    const sizeButton = this.doc.getElementById("zen-boost-size");
    const sizeText = this.doc.getElementById("zen-boost-size-text");
    const sizeValue = this.doc.getElementById("zen-boost-size-value");

    switch (this.currentBoostData.sizeOverride) {
      case 1:
        sizeButton.setAttribute("mode", "none");
        sizeText.style.display = "initial";
        sizeValue.style.display = "none";
        break;
      case 1.1:
        sizeButton.setAttribute("mode", "orange");
        sizeText.style.display = "none";
        sizeValue.style.display = "initial";
        break;
      case 1.25:
        sizeButton.setAttribute("mode", "orange-red");
        sizeText.style.display = "none";
        sizeValue.style.display = "initial";
        break;
      case 1.5:
        sizeButton.setAttribute("mode", "red");
        sizeText.style.display = "none";
        sizeValue.style.display = "initial";
        break;
      case 0.9:
        sizeButton.setAttribute("mode", "blue");
        sizeText.style.display = "none";
        sizeValue.style.display = "initial";
        break;
    }
    sizeValue.setHTML(
      `${Math.round(this.currentBoostData.sizeOverride * 100)}%`
    );
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

    if (this.currentBoostData.autoTheme) {
      autoThemeButton.classList.add("zen-boost-button-active");
    } else {
      autoThemeButton.classList.remove("zen-boost-button-active");
    }

    if (this.currentBoostData.smartInvert) {
      invertButton.classList.add("zen-boost-button-active");
    } else {
      invertButton.classList.remove("zen-boost-button-active");
    }

    if (this.currentBoostData.smartInvert) {
      invertButton.classList.add("zen-boost-button-active");
    } else {
      invertButton.classList.remove("zen-boost-button-active");
    }

    if (!this.currentBoostData.enableColorBoost) {
      disableButton.classList.add("zen-boost-button-active-transparent");
    } else {
      disableButton.classList.remove("zen-boost-button-active-transparent");
    }

    // Give the gradient a grayscale effect
    // when the color boosting is disabled
    // or the theme is set automatically
    if (
      !this.currentBoostData.enableColorBoost ||
      this.currentBoostData.autoTheme
    ) {
      gradient.classList.add("zen-boost-panel-disabled");
    } else {
      gradient.classList.remove("zen-boost-panel-disabled");
    }
  }

  /**
   * Updates the value of the sliders with the current boost data
   */
  updateColorControlSliderVisuals() {
    const contrastSlider = this.doc.getElementById("zen-boost-color-contrast");
    const brightnessSlider = this.doc.getElementById(
      "zen-boost-color-brightness"
    );
    const saturationSlider = this.doc.getElementById(
      "zen-boost-color-saturation"
    );

    contrastSlider.value = this.currentBoostData.contrast;
    brightnessSlider.value = this.currentBoostData.brightness;
    saturationSlider.value = this.currentBoostData.saturation;
  }

  /**
   * Handles font button clicks to change the selected font family.
   *
   * @param {Event} event - The click event from a font button.
   */
  onFontButtonClick(event) {
    const font = event?.target?.getAttribute("font-data") ?? "";
    this.onFontChange(font);
  }

  /**
   * Handles font dropdown selection changes to change the selected font family.
   *
   * @param {Event} event - The change event from the font dropdown.
   */
  onFontDropdownSelect(event) {
    const select = event.target;
    this.onFontChange(select.value);
  }

  /**
   * Changes the font family for the boost. If the same font is selected again,
   * it clears the font override (sets to empty string).
   *
   * @param {string} font - The font family string to apply.
   */
  onFontChange(font) {
    if (this.currentBoostData.fontFamily == font) {
      this.currentBoostData.fontFamily = "";
    } else {
      this.currentBoostData.fontFamily = font;
    }
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
    let foundActive = false;
    for (let i = 0; i < fontButtonGroup.children.length; i++) {
      const fontButton = fontButtonGroup.children[i];
      if (
        fontButton.getAttribute("font-data") == this.currentBoostData.fontFamily
      ) {
        fontButton.classList.add("zen-boost-font-button-active");
        foundActive = true;
      } else {
        fontButton.classList.remove("zen-boost-font-button-active");
      }
    }

    const fontSelect = this.doc.getElementById("zen-boost-font-select");
    for (let i = 0; i < fontSelect.options.length; i++) {
      const option = fontSelect.options[i];
      if (option.value == this.currentBoostData.fontFamily) {
        fontSelect.value = option.value;
        break;
      }
    }
    if (this.currentBoostData.fontFamily !== "" && !foundActive) {
      fontSelect.setAttribute("has-selection", "true");
    } else {
      fontSelect.removeAttribute("has-selection");
    }
  }

  /**
   * Updates the boost data in the boosts manager with the current boost data.
   * This triggers notifications to observers but does not persist to disk.
   */
  updateCurrentBoost() {
    const boost = gZenBoostsManager.loadBoostFromStore(
      this.boostInfo.domain,
      this.boostInfo.id
    );
    boost.boostEntry.boostData = this.currentBoostData;
    gZenBoostsManager.updateBoost(boost);
  }

  /**
   * Deletes the current boost for the domain and closes the editor window.
   */
  deleteBoost() {
    const boost = gZenBoostsManager.loadBoostFromStore(
      this.boostInfo.domain,
      this.boostInfo.id
    );
    gZenBoostsManager.deleteBoost(boost);

    this.currentBoostData = null;
    this.editorWindow.close();
  }

  /**
   * Handles showing the popup when clicking the name text
   *
   * @param {Event} event
   */
  onNameTextClick(event) {
    const renameBoost = this.doc.getElementById("zen-boost-edit-rename");
    const deleteBoost = this.doc.getElementById("zen-boost-edit-delete");
    const resetBoost = this.doc.getElementById("zen-boost-edit-reset");

    const popup = this.doc.getElementById("zenBoostContextMenu");
    popup.addEventListener(
      "popupshown",
      () => {
        // Don't give the user following options if the boost
        // is not going to save / not currently saved (unchanged)
        let shouldDisable = !this.currentBoostData.changeWasMade;
        const items = [renameBoost, deleteBoost, resetBoost];
        for (let item of items) {
          if (shouldDisable) {
            item.setAttribute("disabled", "");
          } else {
            item.removeAttribute("disabled");
          }
        }
      },
      { once: true }
    );
    popup.openPopup(
      event.target,
      "bottomcenter topcenter",
      0,
      0,
      true /* isContextMenu */,
      false /* attributesOverride */,
      event
    );
  }

  /**
   * Handles showing a text field for renaming the boost
   */
  async editBoostName() {
    const nameText = this.doc.getElementById("zen-boost-name-text");

    const [title] = await this.doc.l10n.formatMessages([
      "zen-boost-rename-boost-prompt",
    ]);

    let input = {
      value: this.currentBoostData.boostName, // Default value and also output
    };
    const success = await Services.prompt.prompt(
      this.openerWindow,
      title.value,
      null,
      input,
      null,
      { value: false }
    );

    if (!success) {
      return;
    }
    const newName = input.value;
    const maxDisplayedNameChars = 10;

    if (newName.trim().length !== 0) {
      var truncatedName = newName.substring(0, maxDisplayedNameChars);
      this.currentBoostData.boostName = truncatedName;
      nameText.textContent = this.currentBoostData.boostName;
      this.updateCurrentBoost();
    }
  }

  /**
   * Handles the close button press by closing the editor window.
   */
  onClosePressed() {
    this.editorWindow.close();
  }

  /**
   * Handles opening a save file dialog and exporting the boost data to a JSON file
   */
  async onSaveBoostClick() {
    const success = await gZenBoostsManager.exportBoost(
      this.editorWindow,
      this.currentBoostData
    );

    if (success) {
      this.openerWindow.gZenUIManager.showToast(
        "zen-panel-ui-boosts-exported-message"
      );
    }
  }

  /**
   * Handles opening a load file dialog and importing the boost data to a JSON file
   */
  async onLoadBoostClick() {
    const data = await gZenBoostsManager.importBoost(this.editorWindow);
    if (data) {
      this.currentBoostData = data;
      this.updateAllVisuals();
      this.windowImportAnimation();
    }
  }

  /**
   * Handles animating the window with the import glint animation
   */
  windowImportAnimation() {
    const windowWrapper = this.doc.getElementById("zenBoostWindow");
    if (!windowWrapper) {
      return;
    }

    const element = this.doc.createElement("div");
    element.id = "import-animation";

    const elementBorder = this.doc.createElement("div");
    elementBorder.id = "import-animation-border";

    const elementShadow = this.doc.createElement("div");
    elementShadow.id = "import-animation-shadow";

    this.editorWindow.requestAnimationFrame(() => {
      if (this.openerWindow.gReduceMotion) {
        element.remove();
        elementBorder.remove();
        elementShadow.remove();
        return;
      }

      windowWrapper.appendChild(element);
      windowWrapper.appendChild(elementBorder);
      windowWrapper.appendChild(elementShadow);

      const anim1 = element.animate(
        [
          { top: "100%", opacity: 0.5 },
          { top: "-50%", opacity: 1 },
        ],
        {
          duration: 350,
          delay: 120,
          fill: "forwards",
          easing: "ease-out",
        }
      );

      const anim2 = elementBorder.animate(
        [{ "--background-top": "150%" }, { "--background-top": "-50%" }],
        {
          duration: 350,
          delay: 200,
          fill: "forwards",
          easing: "ease-out",
        }
      );

      const anim3 = elementShadow.animate(
        [{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }],
        {
          duration: 460,
          fill: "forwards",
          easing: "ease-out",
        }
      );

      Promise.all([anim1.finished, anim2.finished, anim3.finished]).then(() => {
        element.remove();
        elementBorder.remove();
        elementShadow.remove();
      });
    });
  }

  /**
   * Shuffles the boost data and updates the presentation
   */
  shuffleBoost() {
    const availFonts = this.fetchFontList();
    const commonFonts = this.commonFonts;
    let font = commonFonts[Math.round(Math.random() * commonFonts.length)];
    if (availFonts.includes(font)) {
      this.currentBoostData.fontFamily = font;
    }

    this.currentBoostData.smartInvert = Math.random() > 0.5;
    this.currentBoostData.autoTheme = false;

    this.currentBoostData.brightness = Math.random();
    this.currentBoostData.contrast = Math.random();
    this.currentBoostData.saturation = Math.random();

    const gradient = this.doc.querySelector(".zen-boost-color-picker-gradient");
    const rect = gradient.getBoundingClientRect();
    this.currentBoostData.secondaryDotAngleDegDelta = Math.random() * 360;
    this.setDotPos(
      Math.round(rect.left + Math.random() * rect.width),
      Math.round(rect.top + Math.random() * rect.height),
      true
    );
    this.currentBoostData.changeWasMade = true;

    this.updateCurrentBoost();
    this.updateAllVisuals();
  }

  /**
   * Reverts boost data to defaults
   */
  resetBoost() {
    this.currentBoostData = gZenBoostsManager.getEmptyBoostEntry().boostData;

    this.updateCurrentBoost();
    this.updateAllVisuals();
  }

  /**
   * Handles the editor window close event. Saves the boost if changes were made,
   * or deletes it if no changes were made (temporary boost).
   */
  handleClose() {
    this.uninit();
    if (this.currentBoostData != null && this.currentBoostData.changeWasMade) {
      this.saveBoost();
    } else if (
      this.currentBoostData != null &&
      !this.currentBoostData.changeWasMade
    ) {
      const boost = gZenBoostsManager.loadBoostFromStore(
        this.boostInfo.domain,
        this.boostInfo.id
      );
      gZenBoostsManager.deleteBoost(boost);
    }

    this.disableAllPickers();
  }

  /**
   * Loads boost data for the specified domain and initializes the editor UI
   * with the boost settings (dot position, sliders, buttons, etc.).
   *
   * @param {string} domain - The domain for which to load the boost.
   */
  async loadBoost(domain) {
    const boost = gZenBoostsManager.loadActiveBoostFromStore(domain);
    this.currentBoostData = boost.boostEntry.boostData;
    this.boostInfo = { domain, id: boost.id };

    // Initial save to register the boost
    gZenBoostsManager.saveBoostToStore(boost);

    // The code editor needs time to initialize
    await this.initCodeEditor();
    this.updateAllVisuals();
  }

  updateAllVisuals() {
    this.doc.getElementById("zen-boost-name-text").textContent =
      this.currentBoostData.boostName;
    const dot = this.doc.querySelector("#zen-boost-color-picker-dot-primary");
    const dotSec = this.doc.querySelector(
      "#zen-boost-color-picker-dot-secondary"
    );
    const gradient = this.doc.querySelector(".zen-boost-color-picker-gradient");
    const rect = gradient.getBoundingClientRect();

    if (!this.currentBoostData.sizeOverride) {
      this.currentBoostData.sizeOverride = 1;
    }

    if (
      // Test if the stored position is a non-normalized dot position
      this.currentBoostData.dotPos.x > 1 ||
      this.currentBoostData.dotPos.x < 0 ||
      this.currentBoostData.dotPos.y > 1 ||
      this.currentBoostData.dotPos.y < 0
    ) {
      // Normalize position
      this.currentBoostData.dotPos.x =
        this.currentBoostData.dotPos.x / rect.width;
      this.currentBoostData.dotPos.y =
        this.currentBoostData.dotPos.y / rect.height;
    }

    // Convert normalized position to relative position
    const xPos = this.currentBoostData.dotPos.x * rect.width;
    const yPos = this.currentBoostData.dotPos.y * rect.height;

    dot.style.left = `${xPos}px`;
    dot.style.top = `${yPos}px`;

    const xPosSec = this.currentBoostData.secondaryDotPos.x * rect.width;
    const yPosSec = this.currentBoostData.secondaryDotPos.y * rect.height;

    dotSec.style.left = `${xPosSec}px`;
    dotSec.style.top = `${yPosSec}px`;

    this.editorWindow._editor.setText(this.currentBoostData.customCSS || "");

    this.updateFontButtonVisuals();
    this.updateCaseButtonVisuals();
    this.updateSizeButtonVisuals();
    this.updateColorControlSliderVisuals();
    this.updateButtonToggleVisuals();
    this.updateDot();
    this.updateCircleRadius();
    this.onUpdateZapValue();
    this.onUpdateZapButtonVisual();
  }

  /**
   * Saves the current boost data to persistent storage if changes were made.
   */
  saveBoost() {
    if (this.currentBoostData == null || !this.currentBoostData.changeWasMade) {
      return;
    }

    const boost = gZenBoostsManager.loadBoostFromStore(
      this.boostInfo.domain,
      this.boostInfo.id
    );
    boost.boostEntry.boostData = this.currentBoostData;

    gZenBoostsManager.saveBoostToStore(boost);
  }
}
