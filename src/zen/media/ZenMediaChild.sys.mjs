/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export class ZenMediaChild extends JSWindowActorChild {
  receiveMessage(message) {
    if (message.name === "ZenMedia:SetVolume") {
      this.setVolume(message.data.volume);
    }
  }

  setVolume(volume) {
    if (isNaN(volume)) {
      return;
    }
    const clampedVolume = Math.max(0, Math.min(1, volume));
    const mediaElements = this.document.querySelectorAll("audio, video");
    for (const media of mediaElements) {
      media.volume = clampedVolume;
    }
  }
}
