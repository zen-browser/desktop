// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { nsZenDOMOperatedFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";

class nsZenTabMultiSelectDrag extends nsZenDOMOperatedFeature {
  #enabled = false;

  init() {
    this.#enabled = Services.prefs.getBoolPref(
      "zen.tabs.middle-drag-select.enabled",
      true
    );
    if (!this.#enabled) {
      return;
    }
    // Gesture listeners are wired up in a later task (middle-mouse drag-select).
  }

  get enabled() {
    return this.#enabled;
  }
}

window.gZenTabMultiSelectDrag = new nsZenTabMultiSelectDrag();
