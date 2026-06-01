/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { JSONFile } from "resource://gre/modules/JSONFile.sys.mjs";

class nsZenAirTrafficManager {
  #file = null;
  #saveFilename = "zen-air-traffic.jsonlz4";

  constructor() {
    this.#readFromDisk();
  }

  /**
   * Opens the air traffic control editor in a new popup window.
   *
   * @param {Window} parentWindow - The parent browser window
   * @returns {Window|null} The instanced editor window
   */
  openAirTrafficDialog(parentWindow) {
    const control = parentWindow.openDialog(
      "chrome://browser/content/zen-components/windows/zen-air-traffic.xhtml",
      "",
      "centerscreen,modal,dependent,resizable=no,dialog=yes,chrome,titlebar=no",
      { parentWindow },
    );

    control.focus();
    return control;
  }

  /**
   * @returns {object} Returns a new empty air traffic route
   */
  getEmptyRoute() {
    return {
      id: crypto.randomUUID(),
      reference: "",
      openIn: "most-recent-space",
      matchType: "contains"
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

    this.#writeToDisk();
    return structuredClone(newRoute);
  }

  /**
   * Removes an existing route with the given id
   * 
   * @param {string} id - The given id
   */
  removeRoute(id) {
    const objWithIdIndex = this.#file.data.routes.findIndex((r) => r.id === id);
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
   * Writes the air traffic data back onto the disk.
   * 
   * @private
   */
  #writeToDisk() {
    this.#file.saveSoon();
  }

  /**
   * Reads air traffic data from disk and decompresses it.
   *
   * @returns {Promise<Map>} A promise that resolves to an array of air traffic rules.
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
   * Gets the file path where air traffic data is stored in the user's profile directory.
   *
   * @returns {string} The full path to the air traffic storage file.
   * @private
   */
  get #storePath() {
    const profilePath = PathUtils.profileDir;
    return PathUtils.join(profilePath, this.#saveFilename);
  }
}

export const ZenAirTrafficManager = new nsZenAirTrafficManager();
