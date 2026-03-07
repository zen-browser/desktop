// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { html } from "chrome://global/content/vendor/lit.all.mjs";
import { MozLitElement } from "chrome://global/content/lit-utils.mjs";

class ZenLibrarySection extends MozLitElement {
  static largeContent = false;

  static get id() {
    throw new Error("Unimplemented");
  }

  static get label() {
    throw new Error("Unimplemented");
  }
}

export const ZenLibrarySections = {
  history: class extends ZenLibrarySection {
    static id = "history";
    static label = "library-history-section-title";
  },
  downloads: class extends ZenLibrarySection {
    static id = "downloads";
    static label = "library-downloads-section-title";
  },
  spaces: class extends ZenLibrarySection {
    static largeContent = true;
    static id = "spaces";
    static label = "library-spaces-section-title";
  },
};
