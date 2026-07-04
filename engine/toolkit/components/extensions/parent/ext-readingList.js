/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var { ExtensionError } = ExtensionUtils;

this.readingList = class extends ExtensionAPI {
  getAPI(context) {
    return {
      readingList: {
        async addEntry(entry) {
          throw new ExtensionError("Not supported on this platform");
        },
        async removeEntry(info) {
          throw new ExtensionError("Not supported on this platform");
        },
        async updateEntry(info, updates) {
          throw new ExtensionError("Not supported on this platform");
        },
        async query(info) {
          return [];
        },
      },
    };
  }
};
