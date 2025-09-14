/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

async function goNextWelcomePage(l10nId) {
  await new Promise(async (resolve) => {
    const button = document.querySelector(
      `#zen-welcome-page-sidebar-buttons button[data-l10n-id="${l10nId}"]`
    );
    if (!button) {
      throw new Error(`Button with l10n-id "${l10nId}" not found`);
    }
    await EventUtils.synthesizeMouseAtCenter(button, {});
    setTimeout(() => {
      setTimeout(() => {
        resolve();
      }, 0);
    }, 3000); // Wait for the transition to complete
  });
}

async function waitForFocus(...args) {
  await new Promise((resolve) => SimpleTest.waitForFocus(resolve, ...args));
}
