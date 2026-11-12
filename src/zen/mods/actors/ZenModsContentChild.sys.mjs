// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * Reloads the mods' styles for pages in this process when the parent
 * rewrites them. Every process loads them on its own, so each one is told.
 */
export class ZenModsContentChild extends JSProcessActorChild {
  receiveMessage({ name }) {
    if (name !== "ZenModsContent:Reload") {
      return;
    }

    try {
      Cc["@mozilla.org/zen/mods-backend;1"]
        .getService(Ci.nsIZenModsBackend)
        .reloadModsContentStyles();
    } catch (error) {
      console.warn("[ZenMods]: Could not reload the mods' page styles:", error);
    }
  }
}
