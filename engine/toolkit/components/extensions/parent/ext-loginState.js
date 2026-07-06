/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

this.loginState = class extends ExtensionAPI {
  getAPI(context) {
    return {
      loginState: {
        async getProfileType() {
          return "UNMANAGED";
        },
        async getSessionState() {
          return "SIGNED_IN";
        },
      },
    };
  }
};
// NIXO: Chrome API compat added
