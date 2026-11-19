/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

function test() {
  waitForExplicitFinish();

  let eventReceived = false;

  registerCleanupFunction(function () {
    ok(eventReceived, "SSWindowClosing event received");
  });

  newWindow(function (win) {
    win.addEventListener(
      "SSWindowClosing",
      function () {
        eventReceived = true;
      },
      { once: true }
    );

    BrowserTestUtils.closeWindow(win).then(() => {
      waitForFocus(finish);
    });
  });
}

function newWindow(callback) {
  let opts = "chrome,all,dialog=no,height=800,width=800";
  let win = window.openDialog(AppConstants.BROWSER_CHROME_URL, "_blank", opts);

  win.addEventListener(
    "load",
    function () {
      executeSoon(() => callback(win));
    },
    { once: true }
  );
}
