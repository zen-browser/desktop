/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const { ZenAirTrafficManager } = ChromeUtils.importESModule(
  "resource:///modules/zen/airtraffic/ZenAirTrafficManager.sys.mjs"
);

export class nsZenAirTrafficDialog {
  doc = null;
  editorWindow = null;
  openerWindow = null;

  static OBSERVERS = ["zen-air-traffic-kill"];

  /**
   * Creates a new boost share instance for the specified domain.
   *
   * @param {Document} doc - The document object for the share window.
   * @param {Window} editorWindow - The window object for the share instance.
   * @param {Window} openerWindow - The window object which instanced this editor.
   */
  constructor(doc, editorWindow, openerWindow) {
    this.doc = doc;
    this.editorWindow = editorWindow;
    this.openerWindow = openerWindow;

    this.killOtherShareInstances();

    nsZenAirTrafficDialog.OBSERVERS.forEach((observe) => {
      Services.obs.addObserver(this, observe);
    });

    this.init();
  }

  /**
   * Initializes the boost share instance by setting up event listeners for all UI controls.
   */
  init() {
    this.editorWindow.addEventListener("unload", () => this.handleClose(), {
      once: true,
    });

    this.doc
      .getElementById("at-new-route")
      .addEventListener("click", this.onNewRouteClicked.bind(this));
    
    this.doc.addEventListener("keydown", (event) => {
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
   * Will create a new route and update the route list
   */
  onNewRouteClicked() {
    this.createRouteElement("equal-to", "lil-zen", "florianbutz.de");
  }

  /**
   * Will create the rule element content and inject it into the ui
   * 
   * @param {string} matchType - The match type (e.g. "contains", "equal-to") 
   * @param {string} openIn - The open type (e.g. "most-recent-space", "lil-zen")
   * @param {string} reference - The link that will be used for the operation
   * @param {string} routeId - The unique identifier for the rule
   * @returns 
   */
  createRouteElement(matchType, openIn, reference, routeId) {
    const container = this.doc.getElementById("at-content");

    const root = this.doc.createElement("vbox");
    root.setAttribute("routeId", routeId);
    root.className = "at-rule-container";

    // ---- Top row

    const topRow = this.doc.createElement("hbox");
    topRow.className = "at-rule-row";
    topRow.id = "at-rule-top";

    const topLabelContainer = this.doc.createElement("hbox");
    topLabelContainer.className = "at-label-container";

    const urlIcon = this.doc.createXULElement("image");
    urlIcon.className = "at-url-icon";

    const urlLabel = this.doc.createElement("p");
    urlLabel.className = "at-label";
    urlLabel.textContent = "URL";

    topLabelContainer.append(urlIcon, urlLabel);

    // Match type

    const matchTypeSelect = this.doc.createElement("select");
    matchTypeSelect.className = "select";
    matchTypeSelect.id = "match-type-select";

    [["Contains", "contains"], ["Is equal to", "equal-to"]].forEach(text => {
        const option = this.doc.createElement("option");
        option.textContent = text[0];
        option.value = text[1];
        matchTypeSelect.appendChild(option);
    });

    matchTypeSelect.value = matchType;

    // Input domain

    const input = this.doc.createElement("input");
    input.className = "input";
    input.placeholder = "zen-browser.app";

    const removeButton = this.doc.createXULElement("button");
    removeButton.className = "at-remove";

    topRow.append(
        topLabelContainer,
        matchTypeSelect,
        input,
        removeButton
    );

    // ---- Bottom row

    const bottomRow = this.doc.createElement("hbox");
    bottomRow.className = "at-rule-row";
    bottomRow.id = "at-rule-bottom";

    const bottomLabelContainer = this.doc.createElement("hbox");
    bottomLabelContainer.className = "at-label-container";

    const openInIcon = this.doc.createXULElement("image");
    openInIcon.className = "at-open-in-icon";

    const openInLabel = this.doc.createElement("p");
    openInLabel.className = "at-label";
    openInLabel.textContent = "Open in";

    bottomLabelContainer.append(openInIcon, openInLabel);

    // Open in

    const openInSelect = this.doc.createElement("select");
    openInSelect.className = "select";
    openInSelect.id = "open-in-select";

    [["Most Recent Space", "most-recent-space"], ["Lil Zen", "lil-zen"]].forEach(text => {
        const option = this.doc.createElement("option");
        option.textContent = text[0];
        option.value = text[1];
        openInSelect.appendChild(option);
    });

    openInSelect.value = openIn;

    bottomRow.append(
        bottomLabelContainer,
        openInSelect
    );

    root.append(topRow, bottomRow);
    container.appendChild(root);

    removeButton.addEventListener("click", () => {
      root.remove();
    });

    return root;
  }

  /**
   * Uninitializes the boost editor by cleaning up event listeners and observers.
   */
  uninit() {
    nsZenAirTrafficDialog.OBSERVERS.forEach((observe) => {
      Services.obs.removeObserver(this, observe);
    });
  }

  /**
   * Kills all other air traffic control dialog instances
   */
  killOtherShareInstances() {
    Services.obs.notifyObservers(null, "zen-air-traffic-kill");
  }

  /**
   * Observer callback that handles notifications from the observer service.
   * Closes the control window when a 'zen-air-traffic-kill' notification is received.
   *
   * @param {object} subject - The subject of the notification.
   * @param {string} topic - The topic of the notification.
   */
  observe(subject, topic) {
    switch (topic) {
      case "zen-air-traffic-kill":
        this.editorWindow.close();
        break;
    }
  }

  /**
   * Callback for when the user presses the close button
   */
  onClosePressed() {
    this.editorWindow.close();
  }

  /**
   * Handles the window close event
   */
  handleClose() {}
}
