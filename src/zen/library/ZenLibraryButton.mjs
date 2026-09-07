/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { nsZenDOMOperatedFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";

class nsZenLibraryButton extends nsZenDOMOperatedFeature {
  #button = null;

  init() {
    this.#button = document.getElementById("zen-library-button");
    if (!this.#button) {
      return;
    }

    this.#button.addEventListener("command", () => {
      if (window.ZenLibrary?.toggle) {
        window.ZenLibrary.toggle();
        return;
      }

      const library = document.querySelector("zen-library");
      if (library) {
        library.toggleAttribute("open");
      }
    });

    this.#button.setAttribute("tooltiptext", "Library");
    this.#button.setAttribute("aria-label", "Library");
  }
}

new nsZenLibraryButton();