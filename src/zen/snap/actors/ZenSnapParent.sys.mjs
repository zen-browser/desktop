// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/* eslint-disable consistent-return */

export class ZenSnapParent extends JSWindowActorParent {
  receiveMessage(message) {
    if (message.name === "ZenSnap:InputClicked") {
      const win = this.browsingContext?.topChromeWindow;
      win?.gZenSnapManager?.onInputClicked(message.data);
    }
  }
}
