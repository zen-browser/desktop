/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  ZenAirTrafficManager: "resource:///modules/zen/airtraffic/ZenAirTrafficManager.sys.mjs",
});

class nsZenAirTrafficControlIntegration {
  constructor() {
    this._originalFunc = null;

    Services.obs.addObserver(this, "browser-delayed-startup-finished");
  }

  observe(subject, topic, data) {
    if (topic === "browser-delayed-startup-finished") {
      console.log("[ZenAirTraffic] Initializing...");
      this.init(subject);
    }

    Services.obs.removeObserver(this, "browser-delayed-startup-finished");
  }

  init(win) {
    const gBrowser = win.gBrowser;
    this._originalFunc = gBrowser.addTab.bind(gBrowser);

    gBrowser.addTab = (uriString, options = {}) => {
      return this._hookedOpenURI(uriString, options, win);
    };

    console.log("[ZenAirTraffic] Hooked into addTab");
  }

  _hookedOpenURI(uriString, options, win) {
    console.log(uriString);
    const newTab = this._originalFunc(uriString, options);

    if (options.skipAnimation) {
      // Skipping restored tabs / initial tab creation
      return newTab; 
    }

    this._routeToWorkspace(uriString, newTab, options, win);
    return newTab;
  }

  _routeToWorkspace(uriString, newTab, options, win) {
    // Initial timeout to wait for tab creation
    win.setTimeout(() => {
      try {
        // Check if tab still exists
        if (!newTab || !newTab.parentNode) return;

        const targetRoute = lazy.ZenAirTrafficManager.routeUri(uriString, options);
        switch(targetRoute) {
          // Do nothing
          case "most-recent-space":
            return newTab;

          // Open Lil Zen
          case "lil-zen":
            console.error("[ZenAirTraffic] Lil Zen does not exist yet.");
            return newTab;

          default: 
            const targetWorkspace = gZenWorkspaces.getWorkspaceFromId(targetRoute);
            
            if (targetWorkspace) {             
              // Move tab and change workspace
              win.gZenWorkspaces.moveTabToWorkspace(newTab, targetWorkspace.uuid);

              // Necessary due to Window Sync
              const mostRecentWindow = Services.wm.getMostRecentWindow("navigator:browser");
              const isOriginatingWindow = (win === mostRecentWindow);

              // Only switch the workspace if the window is the current one
              if (isOriginatingWindow) {
                win.gZenWorkspaces.changeWorkspaceWithID(targetWorkspace.uuid);
                
                // Select the tab but wait a tick 
                // so the workspace can properly switch first
                win.setTimeout(() => win.gBrowser.selectedTab = newTab);
              }
            }
            return newTab;
        }
      } catch (err) {
        console.error("[ZenAirTraffic]: Error moving tab to workspace:", err);
      }
    }, 0);

    return newTab;
  }
}

new nsZenAirTrafficControlIntegration();
