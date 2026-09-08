/**
 * Test helper function that opens a series of windows, closes them
 * and then checks the closed window data from SessionStore against
 * expected results.
 *
 * @param windowsToOpen (Array)
 *        An array of Objects, where each object must define a single
 *        property "isPopup" for whether or not the opened window should
 *        be a popup.
 * @param expectedResults (Array)
 *        An Object with two properies: mac and other, where each points
 *        at yet another Object, with the following properties:
 *
 *        popup (int):
 *          The number of popup windows we expect to be in the closed window
 *          data.
 *        normal (int):
 *          The number of normal windows we expect to be in the closed window
 *          data.
 * @returns Promise
 */
function testWindows(windowsToOpen, expectedResults) {
  return (async function () {
    let num = 0;
    for (let winData of windowsToOpen) {
      let features = "chrome,dialog=no," + (winData.isPopup ? "all=no" : "all");
      let url = "http://example.com/?window=" + num;
      num = num + 1;

      let openWindowPromise = BrowserTestUtils.waitForNewWindow({ url });
      openDialog(AppConstants.BROWSER_CHROME_URL, "", features, url);
      let win = await openWindowPromise;
      await BrowserTestUtils.closeWindow(win);
    }

    let closedWindowData = ss.getClosedWindowData();
    let numPopups = closedWindowData.filter(function (el) {
      return el.isPopup;
    }).length;
    let numNormal = ss.getClosedWindowCount() - numPopups;
    // #ifdef doesn't work in browser-chrome tests, so do a simple regex on platform
    let oResults = navigator.platform.match(/Mac/)
      ? expectedResults.mac
      : expectedResults.other;
    is(
      numPopups,
      oResults.popup,
      "There were " + oResults.popup + " popup windows to reopen"
    );
    is(
      numNormal,
      oResults.normal,
      "There were " + oResults.normal + " normal windows to reopen"
    );
  })();
}

add_task(async function test_closed_window_states() {
  // This test takes quite some time, and timeouts frequently, so we require
  // more time to run.
  // See Bug 518970.
  requestLongerTimeout(2);

  let windowsToOpen = [
    { isPopup: false },
    { isPopup: true },
    { isPopup: true },
    { isPopup: true },
    { isPopup: true },
    { isPopup: true },
  ];
  let expectedResults = {
    mac: { popup: 5, normal: 0 },
    other: { popup: 5, normal: 1 },
  };

  await testWindows(windowsToOpen, expectedResults);

  let windowsToOpen2 = [
    { isPopup: false },
    { isPopup: false },
    { isPopup: false },
    { isPopup: false },
    { isPopup: false },
    { isPopup: false },
  ];
  let expectedResults2 = {
    mac: { popup: 0, normal: 5 },
    other: { popup: 0, normal: 5 },
  };

  await testWindows(windowsToOpen2, expectedResults2);
});
