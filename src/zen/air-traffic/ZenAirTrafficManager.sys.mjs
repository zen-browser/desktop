/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { JSONFile } from "resource://gre/modules/JSONFile.sys.mjs";

class nsZenAirTrafficManager {

  /**
   * Opens the air traffic control editor in a new popup window.
   *
   * @param {Window} parentWindow - The parent browser window
   * @returns {Window|null} The instanced editor window
   */
  openAirTrafficDialog(parentWindow) {
    const control = parentWindow.openDialog(
      "chrome://browser/content/zen-components/windows/zen-air-traffic.xhtml",
      "",
      "centerscreen,modal,dependent,resizable=no,dialog=yes,chrome,titlebar=no",
      { parentWindow }
    );

    control.focus();
    return control;
  }
}

export const ZenAirTrafficManager = new nsZenAirTrafficManager();