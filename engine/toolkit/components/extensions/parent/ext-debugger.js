/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var { ExtensionError } = ExtensionUtils;

// WeakMap[Extension -> Set of attached debuggees]
let attachedTargets = new WeakMap();

this.debugger = class extends ExtensionAPI {
  getAPI(context) {
    let { extension } = context;

    let tabTracker;
    try {
      tabTracker = ChromeUtils.importESModule(
        "resource://gre/modules/ExtensionParent.sys.mjs"
      ).ExtensionParent.apiManager.getAPI("tabs")?.tabTracker;
    } catch (e) {}

    return {
      debugger: {
        async attach(target, requiredVersion) {
          let targetId = target.tabId || target.extensionId || target.targetId;
          if (!targetId) {
            throw new ExtensionError("Invalid debug target");
          }

          if (!attachedTargets.has(extension)) {
            attachedTargets.set(extension, new Set());
          }
          attachedTargets.get(extension).add(targetId);
        },

        async detach(target) {
          let targetId = target.tabId || target.extensionId || target.targetId;
          if (attachedTargets.has(extension)) {
            attachedTargets.get(extension).delete(targetId);
          }
        },

        async sendCommand(target, method, commandParams) {
          // Stub: return empty result for all commands
          return {};
        },

        async getTargets() {
          let targets = [];
          if (tabTracker) {
            for (let tab of tabTracker.tabs()) {
              targets.push({
                id: String(tab.id),
                type: "page",
                title: tab.title || "",
                url: tab.url || "",
                attached: attachedTargets.has(extension) &&
                  attachedTargets.get(extension).has(tab.id),
                tabId: tab.id,
              });
            }
          }
          return targets;
        },
      },
    };
  }
};
