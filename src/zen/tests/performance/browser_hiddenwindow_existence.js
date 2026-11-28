/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_hiddenwindow_existence() {
  switch (AppConstants.platform) {
    case "macosx":
      is(Services.appShell.hasHiddenWindow, true, "Hidden window exists");
      break;
    default:
      is(
        Services.appShell.hasHiddenWindow,
        false,
        "Hidden window does not exist"
      );
  }
});
