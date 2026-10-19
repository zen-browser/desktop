/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

// Test Summary:
// 1.  call ss.setWindowState with a broken state
// 1a. ensure that it doesn't throw.

add_task(async function test_brokenWindowState() {
  let brokenState = {
    windows: [
      {
        tabs: [
          { entries: [{ url: "about:mozilla", triggeringPrincipal_base64 }] },
        ],
      },
    ],
    selectedWindow: 2,
  };

  let gotError = false;
  try {
    await setWindowState(window, brokenState, true);
  } catch (ex) {
    gotError = true;
    info(ex);
  }

  ok(!gotError, "ss.setWindowState did not throw an error");

  // Make sure that we reset the state. Use a full state just in case things get crazy.
  let blankState = {
    windows: [
      {
        tabs: [
          { entries: [{ url: "about:blank", triggeringPrincipal_base64 }] },
        ],
      },
    ],
  };
  await promiseBrowserState(blankState);
});
