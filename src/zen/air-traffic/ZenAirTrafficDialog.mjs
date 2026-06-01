/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const { ZenAirTrafficManager } = ChromeUtils.importESModule(
  "resource:///modules/zen/airtraffic/ZenAirTrafficManager.sys.mjs",
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
      .getElementById("at-close")
      .addEventListener("click", this.onClosePressed.bind(this));
    this.doc
      .getElementById("at-new-route")
      .addEventListener("click", this.onNewRoutePressed.bind(this));

    const defaultRouteSelect = this.doc.getElementById("at-default-external-open-in");
    this.createOpenInList(defaultRouteSelect);
    defaultRouteSelect.value = ZenAirTrafficManager.getDefaultExternalRoute();

    defaultRouteSelect.addEventListener("command", (e) =>
      this.onRouteDefaultExternalChange(e.target.value),
    );

    this.doc.addEventListener("keydown", (event) => {
      if (
        event.key === "Escape" ||
        (event.key === "w" && (event.ctrlKey || event.metaKey))
      ) {
        this.onClosePressed();
      }
    });

    this.initRouteList();
    this.initialized = true;
  }

  /**
   * Initializes the routes list and loads all current routes from the disk
   */
  initRouteList() {
    const allRoutes = ZenAirTrafficManager.getAllRoutes();
    allRoutes.forEach((r) => this.createRouteElement(r));
  }

  /**
   * Will create a new route and update the route list
   */
  onNewRoutePressed() {
    const newRoute = ZenAirTrafficManager.createNewRoute();
    this.createRouteElement(newRoute);
  }

  /**
   * Will remove a route and update the list
   *
   * @param {string} routeId - The unique ID of the affected route
   * @param {string} containerElement - The container element of the route in the list
   */
  onRemoveRoutePressed(routeId, containerElement) {
    ZenAirTrafficManager.removeRoute(routeId);
    containerElement.remove();

    this.updateShowNoRouteText();
  }

  /**
   * Will create the rule element content and inject it into the ui
   *
   * @param {object} route - The target route
   * @returns
   */
  createRouteElement(route) {
    const container = this.doc.getElementById("at-content");

    const root = this.doc.createElement("vbox");
    root.setAttribute("routeId", route.id);
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

    const matchTypeMenulist = this.doc.createElement("select");
    matchTypeMenulist.className = "select";
    matchTypeMenulist.id = "match-type-select";

    [
      ["Contains", "contains"],
      ["Is equal to", "equal-to"],
    ].forEach((text) => {
      const option = this.doc.createElement("option");
      option.textContent = text[0];
      option.value = text[1];
      matchTypeMenulist.appendChild(option);
    });

    matchTypeMenulist.value = route.matchType;

    // Input domain

    const input = this.doc.createElement("input");
    input.className = "input";
    input.placeholder = "zen-browser.app";
    input.value = route.reference;

    const removeButton = this.doc.createXULElement("button");
    removeButton.className = "at-remove";

    topRow.append(topLabelContainer, matchTypeMenulist, input, removeButton);

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

    const openInSelect = this.doc.createXULElement("menulist");
    openInSelect.className = "select";
    openInSelect.id = "open-in-select";

    const openInMenuPopup = this.doc.createXULElement("menupopup");
    openInSelect.appendChild(openInMenuPopup);
  
    this.createOpenInList(openInSelect);
    openInSelect.value = route.openIn;

    bottomRow.append(bottomLabelContainer, openInSelect);

    root.append(topRow, bottomRow);
    container.appendChild(root);

    removeButton.addEventListener("click", () => {
      this.onRemoveRoutePressed(route.id, root);
    });

    input.addEventListener("change", (e) =>
      this.onRotueReferenceChange(e.target.value, route.id),
    );
    matchTypeMenulist.addEventListener("change", (e) =>
      this.onRouteMatchTypeChange(e.target.value, route.id),
    );
    openInSelect.addEventListener("command", (e) =>
      this.onRouteOpenInChange(e.target.value, route.id),
    );

    input.focus();

    this.updateShowNoRouteText();

    return root;
  }

  /**
   * Checks if the text for when no routes are
   * created should be displayed
   */
  updateShowNoRouteText() {
    const container = this.doc.getElementById("at-content");
    const noRoutesText = this.doc.getElementById('at-empty-content');

    // One because of the element itself
    noRoutesText.style.display = container.children.length == 1 ? "flex" : "none";
  }

  /**
   * Callback for when the reference text changes
   *
   * @param {string} value - The new value
   * @param {string} routeId - The ID of the affected route
   */
  onRotueReferenceChange(value, routeId) {
    const route = ZenAirTrafficManager.getRoute(routeId);
    route.reference = value;
    ZenAirTrafficManager.updateRoute(route);
  }

  /**
   * Callback for when the open in attribute changes
   *
   * @param {string} value - The new value
   * @param {string} routeId - The ID of the affected route
   */
  onRouteOpenInChange(value, routeId) {
    const route = ZenAirTrafficManager.getRoute(routeId);
    route.openIn = value;
    ZenAirTrafficManager.updateRoute(route);
  }

  /**
   * Callback for when the route match type changes
   *
   * @param {string} value - The new value
   * @param {string} routeId - The ID of the affected route
   */
  onRouteMatchTypeChange(value, routeId) {
    const route = ZenAirTrafficManager.getRoute(routeId);
    route.matchType = value;
    ZenAirTrafficManager.updateRoute(route);
  }

  /**
   * Callback for when the default external route changes
   *
   * @param {string} value - The new value
   */
  onRouteDefaultExternalChange(value) {
    ZenAirTrafficManager.setDefaultExternalRoute(value);
  }

  /**
   * Creates the options list selects
   *
   * @param {Element} selectElement - The menulist element
   */
  createOpenInList(selectElement) {
    const popupElement =
      selectElement.querySelector("menupopup") || selectElement;
    popupElement.replaceChildren(); // Clear existing

    const sectionHeader = this.doc.createXULElement("menuitem");
    sectionHeader.setAttribute("label", "Open in Space");
    sectionHeader.setAttribute("disabled", "true");
    sectionHeader.classList.add("menu-section-header");
    popupElement.appendChild(sectionHeader);

    let createXulItem = (text, id, iconPath = null) => {
      if (text === "sep") {
        popupElement.appendChild(this.doc.createXULElement("menuseparator"));
        return;
      }

      const menuItem = this.doc.createXULElement("menuitem");
      menuItem.setAttribute("label", text);
      menuItem.setAttribute("value", id || text);

      if (iconPath) {
        if (iconPath.startsWith("chrome://")) {
          menuItem.setAttribute("class", "menuitem-iconic");
          menuItem.setAttribute("image", iconPath);
        } else {
          menuItem.setAttribute("label", `${iconPath} ${text}`);
        }
      }

      popupElement.appendChild(menuItem);
    };

    const workspaces = this.openerWindow.gZenWorkspaces.getWorkspaces();

    createXulItem("Most Recent Space", "most-recent-space");

    workspaces.forEach((workspace) => {
      createXulItem(workspace.name, workspace.uuid, workspace.icon);
    });

    createXulItem("sep");
    createXulItem("Lil Zen", "lil-zen");
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
  handleClose() {
    ZenAirTrafficManager.saveRoutes();
  }
}
