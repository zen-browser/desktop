/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// eslint-disable-next-line no-shadow
const { gZenSmartRoutingManager } = ChromeUtils.importESModule(
  "resource:///modules/zen/smartrouting/ZenSmartRoutingManager.sys.mjs"
);

export class nsZenSmartRoutingDialog {
  doc = null;
  editorWindow = null;
  openerWindow = null;

  static OBSERVERS = ["zen-smart-routing-kill"];

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

    nsZenSmartRoutingDialog.OBSERVERS.forEach(observe => {
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
      .getElementById("sr-close")
      .addEventListener("click", this.onClosePressed.bind(this));
    this.doc
      .getElementById("sr-new-route")
      .addEventListener("click", this.onNewRoutePressed.bind(this));

    const defaultRouteSelect = this.doc.getElementById(
      "sr-default-external-open-in"
    );
    this.createOpenInList(
      defaultRouteSelect,
      gZenSmartRoutingManager.getDefaultExternalRoute()
    );

    defaultRouteSelect.addEventListener("command", e =>
      this.onRouteDefaultExternalChange(e.target.value)
    );

    this.doc.addEventListener("keydown", event => {
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
    const allRoutes = gZenSmartRoutingManager.getAllRoutes();
    allRoutes.forEach(r => this.createRouteElement(r));
  }

  /**
   * Will create a new route and update the route list
   */
  onNewRoutePressed() {
    const newRoute = gZenSmartRoutingManager.createNewRoute();
    this.createRouteElement(newRoute);
  }

  /**
   * Will remove a route and update the list
   *
   * @param {string} routeId - The unique ID of the affected route
   * @param {string} containerElement - The container element of the route in the list
   */
  onRemoveRoutePressed(routeId, containerElement) {
    gZenSmartRoutingManager.removeRoute(routeId);
    containerElement.remove();

    this.updateShowNoRouteText();
  }

  /**
   * Will create the rule element content and inject it into the ui
   *
   * @param {object} route - The target route
   * @returns {Element} The created element for the route
   */
  createRouteElement(route) {
    const container = this.doc.getElementById("sr-content");

    const root = this.doc.createElement("vbox");
    root.setAttribute("routeId", route.id);
    root.className = "sr-rule-container";

    // ---- Top row

    const topRow = this.doc.createElement("hbox");
    topRow.className = "sr-rule-row";
    topRow.id = "sr-rule-top";

    const topLabelContainer = this.doc.createElement("hbox");
    topLabelContainer.className = "sr-label-container";

    const urlIcon = this.doc.createXULElement("image");
    urlIcon.className = "sr-url-icon";

    const urlLabel = this.doc.createElement("p");
    urlLabel.className = "sr-label";
    urlLabel.textContent = "URL";

    topLabelContainer.append(urlIcon, urlLabel);

    // Match type

    const matchTypeMenulist = this.doc.createXULElement("menulist");
    matchTypeMenulist.className = "select";
    matchTypeMenulist.id = "match-type-select";

    const matchTypePopup = this.doc.createXULElement("menupopup");
    matchTypeMenulist.appendChild(matchTypePopup);

    ["contains", "equal-to", "regex"].forEach(id => {
      const menuItem = this.doc.createXULElement("menuitem");
      menuItem.setAttribute("data-l10n-id", `zen-smart-routing-${id}`);
      menuItem.setAttribute("value", id);
      matchTypePopup.appendChild(menuItem);
    });

    matchTypeMenulist.value = route.matchType;

    // Input domain

    const input = this.doc.createElement("input");
    input.className = "input";
    input.value = route.reference;
    this.updateInputPlaceholder(route.matchType, input);

    const removeButton = this.doc.createXULElement("button");
    removeButton.className = "sr-remove";

    topRow.append(topLabelContainer, matchTypeMenulist, input, removeButton);

    // ---- Bottom row

    const bottomRow = this.doc.createElement("hbox");
    bottomRow.className = "sr-rule-row";
    bottomRow.id = "sr-rule-bottom";

    const bottomLabelContainer = this.doc.createElement("hbox");
    bottomLabelContainer.className = "sr-label-container";

    const openInIcon = this.doc.createXULElement("image");
    openInIcon.className = "sr-open-in-icon";

    const openInLabel = this.doc.createElement("p");
    openInLabel.className = "sr-label";
    openInLabel.textContent = "Open in";

    bottomLabelContainer.append(openInIcon, openInLabel);

    // Open in

    const openInMenulist = this.doc.createXULElement("menulist");
    openInMenulist.className = "select";
    openInMenulist.id = "open-in-select";

    const openInMenupopup = this.doc.createXULElement("menupopup");
    openInMenulist.appendChild(openInMenupopup);

    this.createOpenInList(openInMenulist, route.openIn);

    bottomRow.append(bottomLabelContainer, openInMenulist);

    root.append(topRow, bottomRow);
    container.appendChild(root);

    removeButton.addEventListener("click", () => {
      this.onRemoveRoutePressed(route.id, root);
    });

    input.addEventListener("input", e =>
      this.onRotueReferenceChange(e.target.value, route.id, input)
    );
    matchTypeMenulist.addEventListener("command", e =>
      this.onRouteMatchTypeChange(e.target.value, route.id, input)
    );
    openInMenulist.addEventListener("command", e =>
      this.onRouteOpenInChange(e.target.value, route.id)
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
    const container = this.doc.getElementById("sr-content");
    const noRoutesText = this.doc.getElementById("sr-empty-content");

    // One because of the element itself
    noRoutesText.style.display =
      container.children.length == 1 ? "flex" : "none";
  }

  /**
   * Callback for when the reference text changes
   *
   * @param {string} value - The new value
   * @param {string} routeId - The ID of the affected route
   * @param {Element} input - The input element
   */
  onRotueReferenceChange(value, routeId, input) {
    const route = gZenSmartRoutingManager.getRoute(routeId);
    route.reference = value;

    this.updateInputPlaceholder(route.matchType, input);

    // Don't update the route if the regex is invalid
    if (route.matchType == "regex") {
      if (!this.onCheckRegexValid(input)) {
        return;
      }
    }

    gZenSmartRoutingManager.updateRoute(route);
  }

  /**
   * Callback for when the open in attribute changes
   *
   * @param {string} value - The new value
   * @param {string} routeId - The ID of the affected route
   */
  onRouteOpenInChange(value, routeId) {
    const route = gZenSmartRoutingManager.getRoute(routeId);
    route.openIn = value;
    gZenSmartRoutingManager.updateRoute(route);
  }

  /**
   * Callback for when the route match type changes
   *
   * @param {string} value - The new value
   * @param {string} routeId - The ID of the affected route
   * @param {Element} input - The text input
   */
  onRouteMatchTypeChange(value, routeId, input) {
    const route = gZenSmartRoutingManager.getRoute(routeId);
    route.matchType = value;

    this.updateInputPlaceholder(route.matchType, input);

    // Don't update the route if the regex is invalid
    if (route.matchType == "regex") {
      if (!this.onCheckRegexValid(input)) {
        return;
      }
    }

    gZenSmartRoutingManager.updateRoute(route);
  }

  /**
   * Updates the input placeholder based on the
   * current route match type
   *
   * @param {string} matchType - The match type (e.g. "contains", "equal-to", "regex")
   * @param {Element} input - The input element
   */
  updateInputPlaceholder(matchType, input) {
    switch (matchType) {
      case "regex":
        input.placeholder = "zen-browser\\.app";
        break;
      default:
        input.placeholder = "zen-browser.app";
        break;
    }
  }

  /**
   * Will validate and return the validity of the
   * regex. Applies a tint to the input if an error occurs.
   *
   * @param {Element} input - The input element for the regex
   * @returns {bool} True if regex is valid
   */
  onCheckRegexValid(input) {
    const reference = input.value;

    // Ignore empty
    if (reference.trim() == "") {
      input.classList.remove("invalid");
      return true;
    }

    try {
      new RegExp(reference);
    } catch (e) {
      input.classList.add("invalid");
      return false;
    }
    input.classList.remove("invalid");
    return true;
  }

  /**
   * Callback for when the default external route changes
   *
   * @param {string} value - The new value
   */
  onRouteDefaultExternalChange(value) {
    gZenSmartRoutingManager.setDefaultExternalRoute(value);
  }

  /**
   * Creates the options list selects
   *
   * @param {Element} selectElement - The menulist element
   * @param {string} value - The initial value
   */
  async createOpenInList(selectElement, value) {
    const popupElement =
      selectElement.querySelector("menupopup") || selectElement;
    popupElement.replaceChildren(); // Clear existing

    const [openInSpace, mostRecentSpace] = await this.doc.l10n.formatMessages([
      "zen-smart-routing-open-in-space",
      "zen-smart-routing-most-recent-space",
    ]);

    const sectionHeader = this.doc.createXULElement("menuitem");
    sectionHeader.setAttribute("label", openInSpace.value);
    sectionHeader.setAttribute("disabled", "true");
    sectionHeader.classList.add("menu-section-header");
    popupElement.appendChild(sectionHeader);

    let availOptions = [];

    let createXulItem = (text, id, iconPath = null) => {
      if (text === "sep") {
        popupElement.appendChild(this.doc.createXULElement("menuseparator"));
        return;
      }

      availOptions.push(id || text);
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

    createXulItem(mostRecentSpace.value, "most-recent-space");
    createXulItem("sep");

    workspaces.forEach(workspace => {
      createXulItem(workspace.name, workspace.uuid, workspace.icon);
    });

    // Check if the workspace still exists, if not use default
    if (availOptions.includes(value)) {
      selectElement.value = value;
    } else {
      selectElement.value = "most-recent-space";
    }
  }

  /**
   * Uninitializes the boost editor by cleaning up event listeners and observers.
   */
  uninit() {
    nsZenSmartRoutingDialog.OBSERVERS.forEach(observe => {
      Services.obs.removeObserver(this, observe);
    });
  }

  /**
   * Kills all other Smart Routing dialog instances
   */
  killOtherShareInstances() {
    Services.obs.notifyObservers(null, "zen-smart-routing-kill");
  }

  /**
   * Observer callback that handles notifications from the observer service.
   * Closes the control window when a 'zen-smart-routing-kill' notification is received.
   *
   * @param {object} subject - The subject of the notification.
   * @param {string} topic - The topic of the notification.
   */
  observe(subject, topic) {
    switch (topic) {
      case "zen-smart-routing-kill":
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
    gZenSmartRoutingManager.saveRoutes();
  }
}
