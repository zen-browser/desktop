/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * This test ensures that navigator.requestMediaKeySystemAccess() requests
 * to run EME with persistent state are rejected in private browsing windows.
 * Bug 1334111.
 */

const TEST_URL =
  getRootDirectory(gTestPath).replace(
    "chrome://mochitests/content",
    "https://example.com"
  ) + "empty_file.html";

async function isEmePersistentStateSupported(mode) {
  let win = await BrowserTestUtils.openNewBrowserWindow(mode);
  let tab = await BrowserTestUtils.openNewForegroundTab(win.gBrowser, TEST_URL);
  let persistentStateSupported = await SpecialPowers.spawn(
    tab.linkedBrowser,
    [],
    async function () {
      try {
        let config = [
          {
            initDataTypes: ["webm"],
            videoCapabilities: [{ contentType: 'video/webm; codecs="vp9"' }],
            persistentState: "required",
          },
        ];
        await content.navigator.requestMediaKeySystemAccess(
          "org.w3.clearkey",
          config
        );
      } catch (ex) {
        return false;
      }
      return true;
    }
  );

  await BrowserTestUtils.closeWindow(win);

  return persistentStateSupported;
}

add_task(async function test() {
  is(
    await isEmePersistentStateSupported({ private: true }),
    true,
    "EME persistentState *SHOULD* be supported in private browsing window."
  );
  is(
    await isEmePersistentStateSupported({ private: false }),
    true,
    "EME persistentState *SHOULD* be supported in non private browsing window."
  );
});
