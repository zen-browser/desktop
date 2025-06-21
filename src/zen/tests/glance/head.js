/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function openGlanceOnTab(callback, close = true) {
  return new Promise(async (resolve) => {
    setTimeout(() => {
      gZenGlanceManager
        .openGlance({
          url: 'https://example.com',
          clientX: 0,
          clientY: 0,
          width: 0,
          height: 0,
        })
        .then(async (glanceTab) => {
          await callback(glanceTab);
          if (close) {
            setTimeout(() => {
              gZenGlanceManager
                .closeGlance({
                  onTabClose: true,
                })
                .then(() => {
                  resolve();
                });
            }, 500); // Give tons of time for the glance to close
          } else {
            resolve();
          }
        });
    }, 500); // Give tons of time for the glance to open
  });
}
