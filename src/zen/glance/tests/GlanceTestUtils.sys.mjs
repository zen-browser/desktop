/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export function openGlanceOnTab(window, callback, close = true) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve) => {
    window.gZenGlanceManager
      .openGlance({
        url: "https://example.com",
        clientX: 0,
        clientY: 0,
        width: 0,
        height: 0,
      })
      .then(async (glanceTab) => {
        await callback(glanceTab);
        if (close) {
          window.gZenGlanceManager
            .closeGlance({
              onTabClose: true,
            })
            .then(() => {
              resolve();
            });
        } else {
          resolve();
        }
      });
  });
}
