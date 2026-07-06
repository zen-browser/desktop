/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

XPCOMUtils.defineLazyServiceGetters(this, {
  windowMediator: ["@mozilla.org/appshell/window-mediator;1", "nsIWindowMediator"],
});

this.sidePanel = class extends ExtensionAPI {
  onManifestEntry() {
    let { extension } = this;
    let options = extension.manifest.side_panel;

    if (options?.default_path) {
      this.defaultPanel = options.default_path;
      this.id = `${makeWidgetId(extension.id)}-side-panel`;
      this.enabled = true;
    }
  }

  getAPI(context) {
    let { extension } = context;
    let sidePanel = this;

    return {
      sidePanel: {
        async setOptions(details) {
          if (details.path !== undefined) {
            let url;
            if (!details.path) {
              url = null;
            } else {
              url = context.uri.resolve(details.path);
              if (!context.checkLoadURL(url)) {
                return Promise.reject({
                  message: `Access denied for URL ${url}`,
                });
              }
            }
            sidePanel.defaultPanel = url;
          }

          if (details.enabled !== undefined) {
            sidePanel.enabled = details.enabled;
          }
        },

        async getOptions(details) {
          return {
            path: sidePanel.defaultPanel || null,
            enabled: sidePanel.enabled !== undefined ? sidePanel.enabled : true,
          };
        },

        async open(details) {
          let window = windowMediator.getMostRecentWindow("navigator:browser");
          if (window?.SidebarController && sidePanel.id) {
            window.SidebarController.show(sidePanel.id);
          }
        },

        async setPanelBehavior(behavior) {
          sidePanel.openPanelOnActionClick = behavior.openPanelOnActionClick;
        },

        async getPanelBehavior() {
          return {
            openPanelOnActionClick:
              sidePanel.openPanelOnActionClick !== undefined
                ? sidePanel.openPanelOnActionClick
                : false,
          };
        },
      },
    };
  }
};
// NIXO
