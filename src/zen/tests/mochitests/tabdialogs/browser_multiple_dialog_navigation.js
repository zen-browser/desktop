/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_multiple_dialog_navigation() {
  await BrowserTestUtils.withNewTab(
    "https://example.com/gone",
    async browser => {
      let firstDialogPromise = BrowserTestUtils.promiseAlertDialogOpen();
      // We're gonna queue up some dialogs, and navigate. The tasks queueing the dialog
      // are going to get aborted when the navigation happened, but that's OK because by
      // that time they will have done their job. Detect and swallow that specific
      // exception:
      let navigationCatcher = e => {
        if (e.name == "AbortError" && e.message.includes("destroyed before")) {
          return;
        }
        throw e;
      };
      // Queue up 2 dialogs
      let firstTask = SpecialPowers.spawn(browser, [], async function () {
        content.eval(`alert('hi');`);
      }).catch(navigationCatcher);
      let secondTask = SpecialPowers.spawn(browser, [], async function () {
        content.eval(`alert('hi again');`);
      }).catch(navigationCatcher);
      info("Waiting for first dialog.");
      let dialogWin = await firstDialogPromise;

      let secondDialogPromise = BrowserTestUtils.promiseAlertDialogOpen();
      dialogWin.document
        .getElementById("commonDialog")
        .getButton("accept")
        .click();
      dialogWin = null;

      info("Wait for second dialog to appear.");
      let secondDialogWin = await secondDialogPromise;
      let closedPromise = BrowserTestUtils.waitForEvent(
        secondDialogWin,
        "unload"
      );
      let loadedOtherPage = BrowserTestUtils.waitForLocationChange(
        gBrowser,
        "https://example.org/gone"
      );
      BrowserTestUtils.startLoadingURIString(
        browser,
        "https://example.org/gone"
      );
      info("Waiting for the next page to load.");
      await loadedOtherPage;
      info(
        "Waiting for second dialog to close. If we time out here that's a bug!"
      );
      await closedPromise;
      is(secondDialogWin.closed, true, "Should have closed second dialog.");
      info("Ensure content tasks are done");
      await secondTask;
      await firstTask;
    }
  );
});
