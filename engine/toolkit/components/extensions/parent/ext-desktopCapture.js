/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

this.desktopCapture = class extends ExtensionAPI {
  getAPI(context) {
    return {
      desktopCapture: {
        async chooseDesktopMedia(sources, targetTab) {
          // Stub: return null stream ID
          return null;
        },

        cancelChooseDesktopMedia(desktopMediaRequestId) {
          // No-op stub
        },
      },
    };
  }
};
// NIXO: Chrome API compat added
