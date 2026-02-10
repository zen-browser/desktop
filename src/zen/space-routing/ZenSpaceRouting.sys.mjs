/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { JSONFile } from "resource://gre/modules/JSONFile.sys.mjs";

class nsZenSpaceRouting {
  #jsonFile = null;

  constructor() {
    this.#jsonFile = new JSONFile({
      path: PathUtils.join(PathUtils.profileDir, "space-routing.json"),
    });
  }
}

export var ZenSpaceRouting = new nsZenSpaceRouting();
