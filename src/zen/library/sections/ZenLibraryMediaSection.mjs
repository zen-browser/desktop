/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { html } from "chrome://global/content/vendor/lit.all.mjs";
import { MozLitElement } from "chrome://global/content/lit-utils.mjs";

export class ZenLibraryMediaSection extends MozLitElement {
  static id = "media";
  static label = "library-media-section-title";

  static render(library) {
    return html`
      <zen-library-media-section
        class="zen-library-section"
        data-section="media"
        .library=${library}
      ></zen-library-media-section>
    `;
  }

  render() {
    return html`
      <div class="zen-library-empty" data-l10n-id="library-media-empty"></div>
    `;
  }
}

customElements.define("zen-library-media-section", ZenLibraryMediaSection);
