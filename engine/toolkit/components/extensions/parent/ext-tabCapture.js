/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var { ExtensionError } = ExtensionUtils;

this.tabCapture = class extends ExtensionAPI {
  getAPI(context) {
    let capturedTabs = [];

    return {
      tabCapture: {
        async capture(options) {
          // Stub: in a real implementation, this would use getUserMedia
          // with tab-capture constraints. For now, return null.
          return null;
        },

        async getCapturedTabs() {
          return capturedTabs;
        },
      },
    };
  }
};
