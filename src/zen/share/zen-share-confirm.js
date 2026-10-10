/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

{
  const args = window.arguments?.[0] || {};

  window.addEventListener(
    "load",
    () => {
      const nameInput = document.getElementById("zen-share-confirm-name");
      nameInput.value = args.name || "";
      nameInput.focus();

      document.addEventListener("dialogaccept", () => {
        args.accepted = true;
        args.name = nameInput.value.trim();
        args.dontAsk = document.getElementById(
          "zen-share-confirm-dont-ask"
        ).checked;
      });
    },
    { once: true }
  );
}
