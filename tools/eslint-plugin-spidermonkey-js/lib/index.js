/**
 * @file A processor to help parse the spidermonkey js code.
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

// ------------------------------------------------------------------------------
// Plugin Definition
// ------------------------------------------------------------------------------
module.exports = {
  meta: { name: "eslint-plugin-spidermonkey-js", version: "0.1.1" },
  processors: {
    processor: require("./processors/self-hosted"),
  },
  environments: {
    environment: require("./environments/self-hosted"),
  },
};
