/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var { ExtensionError } = ExtensionUtils;

this.instanceID = class extends ExtensionAPI {
  getAPI(context) {
    return {
      instanceID: {
        async getID() {
          throw new ExtensionError("Not supported on this platform");
        },
        async getCreationTime() {
          throw new ExtensionError("Not supported on this platform");
        },
        async getToken(options) {
          throw new ExtensionError("Not supported on this platform");
        },
        async deleteToken(options) {
          throw new ExtensionError("Not supported on this platform");
        },
        async deleteID() {
          throw new ExtensionError("Not supported on this platform");
        },
      },
    };
  }
};
