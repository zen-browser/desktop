/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';

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
