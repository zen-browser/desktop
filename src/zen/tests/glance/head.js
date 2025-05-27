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
            gZenGlanceManager
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
  });
}
