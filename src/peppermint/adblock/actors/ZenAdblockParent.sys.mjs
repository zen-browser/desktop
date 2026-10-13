// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  gZenAdblock: "resource:///modules/zen/adblock/ZenAdblockManager.sys.mjs",
});

export class ZenAdblockParent extends JSWindowActorParent {
  receiveMessage(message) {
    if (message.name === "ZenAdblock:GetCosmetics") {
      return lazy.gZenAdblock.getCosmetics(message.data);
    }
    return null;
  }
}
