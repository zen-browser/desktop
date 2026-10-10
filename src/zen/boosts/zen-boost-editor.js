/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const { nsZenBoostEditor } = ChromeUtils.importESModule(
  "resource:///modules/zen/boosts/ZenBoostsEditor.mjs"
);

window.boostEditor = new nsZenBoostEditor(
  document,
  window.domain,
  window,
  window.openerWindow
);
