/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

add_task(async function test_malformedURI() {
  /** Test for Bug 514751 (Wallpaper) */

  let state = {
    windows: [
      {
        tabs: [
          {
            entries: [
              {
                url: "about:mozilla",
                triggeringPrincipal_base64,
                title: "Mozilla",
              },
              {},
            ],
          },
        ],
      },
    ],
  };

  var theWin = openDialog(location, "", "chrome,all,dialog=no");
  await promiseWindowLoaded(theWin);

  var gotError = false;
  try {
    await setWindowState(theWin, state, true);
  } catch (e) {
    if (/NS_ERROR_MALFORMED_URI/.test(e)) {
      gotError = true;
    }
  }

  ok(!gotError, "Didn't get a malformed URI error.");
  await BrowserTestUtils.closeWindow(theWin);
});
