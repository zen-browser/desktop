/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var { ExtensionError } = ExtensionUtils;

this.gcm = class extends ExtensionAPI {
  getAPI(context) {
    return {
      gcm: {
        async register(senderIds) {
          throw new ExtensionError("GCM not supported on this platform");
        },
        async unregister() {
          throw new ExtensionError("GCM not supported on this platform");
        },
        async send(message) {
          throw new ExtensionError("GCM not supported on this platform");
        },
      },
    };
  }
};
