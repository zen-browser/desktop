// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const OBSERVING = ['browser-window-before-show'];

class nsZenWindowSync {
  constructor() {}

  init() {
    for (let topic of OBSERVING) {
      Services.obs.addObserver(this, topic);
    }
  }

  uninit() {
    for (let topic of OBSERVING) {
      Services.obs.removeObserver(this, topic);
    }
  }
}

export const ZenWindowSync = new nsZenWindowSync();
