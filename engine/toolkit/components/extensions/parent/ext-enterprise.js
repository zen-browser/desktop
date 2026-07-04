/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

this.enterprise = class extends ExtensionAPI {
  getAPI(context) {
    return {
      enterprise: {},
      "enterprise.platformKeys": {
        async getTokens() {
          return [];
        },
        async getCertificate(tokenId) {
          return null;
        },
      },
      "enterprise.networkingAttributes": {
        async getNetworkDetails() {
          return {};
        },
      },
      "enterprise.hardware": {
        async getDeviceUUID() {
          return "";
        },
      },
    };
  }
};
