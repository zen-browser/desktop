/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { JSONFile } from "resource://gre/modules/JSONFile.sys.mjs";

class nsZenSmartRoutingManager {
  #file = null;
  #saveFilename = "zen-smart-routing.jsonlz4";

  static SKIP_TYPE = {
    NONE: "none",
    SKIPPED_TAB: "skipped_tab",
    RESTORED_TAB: "restored_tab",
  };

  constructor() {
    this.#readFromDisk();
  }

  /**
   * Callback that will be executed from tabbrowser.js
   * This method can be used to stop the tab from being created.
   * 
   * @param {string} uriString - The URI as a string
   * @param {object} options - The tab creation options
   * @param {Window} win - The window which the tab will be added to
   * @returns {object} Returns an object with { shouldEarlyExit, userContextId, isRouteFound }
   */
  onBeforeAddTab(uriString, options, win) {
    let userContextId = null;
    let isRouteFound = false;
    
    if (this.#shouldSkipProcessing(options, win) != nsZenSmartRoutingManager.SKIP_TYPE.NONE) {
      return { shouldEarlyExit: false, userContextId, isRouteFound };
    }

    const targetRoute = this.routeUri(
      uriString,
      options,
    );
    switch (targetRoute) {
      case "most-recent-space":
        break;
      default:
        const targetWorkspace =
          win.gZenWorkspaces.getWorkspaceFromId(targetRoute);

        if (targetWorkspace) {
          userContextId = targetWorkspace.containerTabId;
          isRouteFound = true;
        }
    }

    return { shouldEarlyExit: false, userContextId, isRouteFound };
  }

  /**
   * Callback that will be executed from tabbrowser.js
   * 
   * @param {string} uriString - The URI as a string
   * @param {object} options - The tab creation options
   * @param {Window} win - The window which the tab was added to
   */
  onAfterAddTab(uriString, newTab, options, win) {
    // Skip processing if needed
    if (this.#shouldSkipProcessing(options, win) != nsZenSmartRoutingManager.SKIP_TYPE.NONE) {
      return;
    }

    this.#routeToWorkspace(uriString, newTab, options, win);
  }

  /**
   * Checks if the tab should be processed or not
   * 
   * @param {object} options - The tab creation options
   * @param {Window} win - The owning window
   * @returns {SKIP_TYPE} The type of skip or null if not skipped 
   */
  #shouldSkipProcessing(options, win) {
    // Do not process these tabs at all
    if (options.skipRoute || options.pinned || options.tabGroup) {
      return nsZenSmartRoutingManager.SKIP_TYPE.SKIPPED_TAB;
    }

    // addTab() is being called when the session restores.
    // To avoid automatically routing these tabs, 
    // a check if the restore is already complete is needed
    if (!win.gZenStartup.isReady) {
      console.log("[ZenSmartRouting] Skipping restored tab...");
      return nsZenSmartRoutingManager.SKIP_TYPE.RESTORED_TAB;
    }

    return nsZenSmartRoutingManager.SKIP_TYPE.NONE;
  }

  /**
   * Will route the given tab to a space if a rule applies
   * 
   * @param {string} uriString - The URI as a string
   * @param {Element} newTab - The tab element 
   * @param {object} options - Tab creation args
   * @param {Window} win - The window which the tab was added to
   * @private
   */
  async #routeToWorkspace(uriString, newTab, options, win) {
    try {
      // Check if tab still exists
      if (!newTab || !newTab.parentNode) {
        return;
      }

      const targetRoute = this.routeUri(
        uriString,
        options,
      );
      switch (targetRoute) {
        // Do nothing
        case "most-recent-space":
          return newTab;

        default:
          const targetWorkspace =
            win.gZenWorkspaces.getWorkspaceFromId(targetRoute);

          if (targetWorkspace) {
            // Move tab and change workspace
            win.gZenWorkspaces.moveTabToWorkspace(newTab, targetWorkspace.uuid);

            // Necessary due to Window Sync
            const mostRecentWindow =
              Services.wm.getMostRecentWindow("navigator:browser");
            const isOriginatingWindow = win === mostRecentWindow;

            // Only switch the workspace if the window is the current one
            if (isOriginatingWindow) {
              win.gZenWorkspaces.lastSelectedWorkspaceTabs[targetWorkspace.uuid] = newTab;
              await win.gZenWorkspaces.changeWorkspace(targetWorkspace);
            }
          }
      }
    } catch (err) {
      console.error("[ZenSmartRouting]: Error moving tab to workspace:", err);
    }
  }

  /**
   * This will give the id of the workspace this uri will
   * route to, or "most-recent-space" or "lil-zen"
   *
   * @param {string} uriString - The uri which will be routed
   * @param {object} options - The tab creation options
   * @returns {string} Route instructions
   */
  routeUri(uriString, options) {
    const isExternal = options.fromExternal;

    // Go over all routes and return the open type for the first match
    const allRoutes = this.getAllRoutes();
    for (const route of allRoutes) {
      if (this.isRouteMatching(uriString, route)) {
        return route.openIn;
      }
    }

    // If nothing matches and it's an external link,
    // use the default external route
    if (isExternal) {
      return this.getDefaultExternalRoute();
    }

    // If nothing matches, open in most recent space
    return "most-recent-space";
  }

  /**
   * Checks if a given rule matches a uriString
   *
   * @param {string} uriString - The uri
   * @param {object} route - The route
   * @returns {boolean} True if the rule matches
   */
  isRouteMatching(uriString, route) {
    let reference = route.reference.toLowerCase();
    if (reference.trim() == "") {
      reference = "zen-browser.app";
    } // Placeholder Reference

    const uri = uriString.toLowerCase();
    switch (route.matchType) {
      case "contains":
        if (uri.includes(reference)) {
          return true;
        }
        break;
      case "equal-to":
        if (this.#normalizeURL(uri) == reference) {
          return true;
        }
        break;
      case "regex":
        let unmodifiedReference = route.reference;
        if (unmodifiedReference.trim() == "") {
          unmodifiedReference = "zen-browser\.app";
        } // Placeholder RegEx
        try {
          // Use unmodified parameters for the regex test
          const regex = new RegExp(unmodifiedReference);
          if (regex.test(uriString)) {
            return true;
          }
        } catch (e) {
          console.error("[ZenSmartRouting] Failed to resolve regular expression");
        }
        break;
    }
  }

  /**
   * Will remove any protocol sequences to normalize the url
   *
   * @param {string} uriString - The url
   * @returns {string} The normalized url
   */
  #normalizeURL(uriString) {
    if (!uriString) {
      return "";
    }
    let clean = uriString.trim();

    // Remove protocol sequences with regex
    clean = clean.replace(/^https?:\/\//i, "");
    clean = clean.replace(/^www\./i, "");

    // If there is a trailing slash, remove
    if (clean.endsWith("/")) {
      clean = clean.slice(0, -1);
    }

    return clean;
  }

  /**
   * Opens the Smart Routing editor in a new popup window.
   *
   * @param {Window} parentWindow - The parent browser window
   * @returns {Window|null} The instanced editor window
   */
  openSmartRoutingDialog(parentWindow) {
    const control = parentWindow.openDialog(
      "chrome://browser/content/zen-components/windows/zen-smart-routing.xhtml",
      "",
      "centerscreen,modal,dependent,resizable=no,titlebar=no",
      { parentWindow }
    );

    control.focus();
    return control;
  }

  /**
   * @returns {object} Returns a new empty Smart Routing route
   */
  getEmptyRoute() {
    return {
      id: crypto.randomUUID(),
      reference: "",
      openIn: "most-recent-space",
      matchType: "contains",
    };
  }

  /**
   * @returns {Array<object>} A copy of the routes list
   */
  getAllRoutes() {
    return structuredClone(this.#file.data.routes);
  }

  /**
   * Returns a specific route
   *
   * @param {string} id - The ID of the given route
   * @returns {object} The route
   */
  getRoute(id) {
    const idx = this.#file.data.routes.findIndex(r => r.id === id);
    return structuredClone(this.#file.data.routes[idx]);
  }

  /**
   * Will update an existing route
   *
   * @param {object} route - The updated route
   */
  updateRoute(route) {
    const idx = this.#file.data.routes.findIndex(r => r.id === route.id);
    this.#file.data.routes[idx] = structuredClone(route);
  }

  /**
   * Creates a new route and returns it
   *
   * @returns {object} Returns the empty route
   */
  createNewRoute() {
    const newRoute = this.getEmptyRoute();
    this.#file.data.routes.push(newRoute);

    return structuredClone(newRoute);
  }

  /**
   * Removes an existing route with the given id
   *
   * @param {string} id - The given id
   */
  removeRoute(id) {
    const objWithIdIndex = this.#file.data.routes.findIndex(r => r.id === id);
    this.#file.data.routes.splice(objWithIdIndex, 1);
  }

  /**
   * @returns {string} Returns the default route type for external links
   */
  getDefaultExternalRoute() {
    return this.#file.data.defaultRouteExternal;
  }

  /**
   * @param {string} routeType - Sets the default route type for external links
   */
  setDefaultExternalRoute(routeType) {
    this.#file.data.defaultRouteExternal = routeType;
  }

  /**
   * Saves all routes
   */
  saveRoutes() {
    this.#writeToDisk();
  }

  /**
   * Writes the Smart Routing data back onto the disk.
   *
   * @private
   */
  #writeToDisk() {
    this.#file.saveSoon();
  }

  /**
   * Reads Smart Routing data from disk and decompresses it.
   *
   * @returns {Promise<Map>} A promise that resolves to an array of Smart Routing rules.
   * @private
   */
  async #readFromDisk() {
    this.#file = new JSONFile({
      path: this.#storePath,
      compression: "lz4",

      dataPostProcessor(data) {
        if (!data.routes) {
          data.routes = [];
          data.defaultRouteExternal = "most-recent-space";
        }
        return data;
      },
    });

    await this.#file.load();
  }

  /**
   * Gets the file path where Smart Routing data is stored in the user's profile directory.
   *
   * @returns {string} The full path to the Smart Routing storage file.
   * @private
   */
  get #storePath() {
    const profilePath = PathUtils.profileDir;
    return PathUtils.join(profilePath, this.#saveFilename);
  }
}

export const ZenSmartRoutingManager = new nsZenSmartRoutingManager();
