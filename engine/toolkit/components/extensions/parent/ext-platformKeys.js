/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var { ExtensionError } = ExtensionUtils;

this.platformKeys = class extends ExtensionAPI {
  getAPI(context) {
    return {
      platformKeys: {
        async getKeyPair(certificate, parameters) {
          throw new ExtensionError("Not supported on this platform");
        },
        async subtleCrypto() {
          return crypto.subtle;
        },
        async selectClientCertificates(details) {
          return [];
        },
        async getTokens() {
          return [];
        },
      },
    };
  }
};
