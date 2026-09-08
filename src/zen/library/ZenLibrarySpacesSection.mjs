/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { html } from "chrome://global/content/vendor/lit.all.mjs";

export class ZenLibrarySpacesSection {
  static id = "spaces";
  static label = "library-spaces-section-title";

  static render() {
    return html`
      <div class="zen-library-section" data-section=${this.id}>
        <h1>${this.label}</h1>
      </div>
    `;
  }
}