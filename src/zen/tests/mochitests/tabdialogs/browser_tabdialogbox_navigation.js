/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const TEST_ROOT_CHROME = getRootDirectory(gTestPath);
const TEST_DIALOG_PATH = TEST_ROOT_CHROME + "subdialog.xhtml";

/**
 * Tests that all tab dialogs are closed on navigation.
 */
add_task(async function test_tabdialogbox_multiple_close_on_nav() {
  await BrowserTestUtils.withNewTab(
    "https://example.com",
    async function (browser) {
      // Open two dialogs and wait for them to be ready.
      let dialogBox = gBrowser.getTabDialogBox(browser);
      let closedPromises = [
        dialogBox.open(TEST_DIALOG_PATH).closedPromise,
        dialogBox.open(TEST_DIALOG_PATH).closedPromise,
      ];

      let dialogs = dialogBox.getTabDialogManager()._dialogs;

      is(dialogs.length, 2, "Dialog manager has two dialogs.");

      info("Waiting for dialogs to open.");
      await Promise.all(dialogs.map(dialog => dialog._dialogReady));

      // Navigate to a different page
      BrowserTestUtils.startLoadingURIString(browser, "https://example.org");

      info("Waiting for dialogs to close.");
      await closedPromises;

      ok(true, "All open dialogs should close on navigation");
    }
  );
});

/**
 * Tests dialog close on navigation triggered by web content.
 */
add_task(async function test_tabdialogbox_close_on_content_nav() {
  await BrowserTestUtils.withNewTab(
    "https://example.com",
    async function (browser) {
      // Open a dialog and wait for it to be ready
      let dialogBox = gBrowser.getTabDialogBox(browser);
      let { closedPromise } = dialogBox.open(TEST_DIALOG_PATH);

      let dialog = dialogBox.getTabDialogManager()._topDialog;

      is(
        dialogBox.getTabDialogManager()._dialogs.length,
        1,
        "Dialog manager has one dialog."
      );

      info("Waiting for dialog to open.");
      await dialog._dialogReady;

      // Trigger a same origin navigation by the content
      await SpecialPowers.spawn(browser, [], () => {
        // eslint-disable-next-line sdl/no-insecure-url
        content.location = "http://example.com/1";
      });

      info("Waiting for dialog to close.");
      await closedPromise;
      ok(
        true,
        "Dialog should close for same origin navigation by the content."
      );

      // Open a new dialog
      closedPromise = dialogBox.open(TEST_DIALOG_PATH, {
        keepOpenSameOriginNav: true,
      }).closedPromise;

      info("Waiting for dialog to open.");
      await dialog._dialogReady;

      SimpleTest.requestFlakyTimeout("Waiting to ensure dialog does not close");
      let race = Promise.race([
        closedPromise,
        // eslint-disable-next-line mozilla/no-arbitrary-setTimeout
        new Promise(resolve => setTimeout(() => resolve("success"), 1000)),
      ]);

      // Trigger a same origin navigation by the content
      await SpecialPowers.spawn(browser, [], () => {
        // eslint-disable-next-line sdl/no-insecure-url
        content.location = "http://example.com/test";
      });

      is(
        await race,
        "success",
        "Dialog should not close for same origin navigation by the content."
      );

      // Trigger a cross origin navigation by the content
      await SpecialPowers.spawn(browser, [], () => {
        // eslint-disable-next-line sdl/no-insecure-url
        content.location = "http://example.org/test2";
      });

      info("Waiting for dialog to close");
      await closedPromise;

      ok(
        true,
        "Dialog should close for cross origin navigation by the content."
      );
    }
  );
});

/**
 * Hides a dialog stack and tests that behavior doesn't change. Ensures
 * navigation triggered by web content still closes all dialogs.
 */
add_task(async function test_tabdialogbox_hide() {
  await BrowserTestUtils.withNewTab(
    "https://example.com",
    async function (browser) {
      // Open a dialog and wait for it to be ready
      let dialogBox = gBrowser.getTabDialogBox(browser);
      let dialogBoxManager = dialogBox.getTabDialogManager();
      let closedPromises = [
        dialogBox.open(TEST_DIALOG_PATH).closedPromise,
        dialogBox.open(TEST_DIALOG_PATH).closedPromise,
      ];

      let dialogs = dialogBox.getTabDialogManager()._dialogs;

      is(
        dialogBox.getTabDialogManager()._dialogs.length,
        2,
        "Dialog manager has two dialogs."
      );

      info("Waiting for dialogs to open.");
      await Promise.all(dialogs.map(dialog => dialog._dialogReady));

      ok(
        !BrowserTestUtils.isHidden(dialogBoxManager._dialogStack),
        "Dialog stack is showing"
      );

      dialogBoxManager.hideDialog(browser);

      is(
        dialogBoxManager._dialogs.length,
        2,
        "Dialog manager still has two dialogs."
      );

      ok(
        BrowserTestUtils.isHidden(dialogBoxManager._dialogStack),
        "Dialog stack is hidden"
      );

      // Navigate to a different page
      BrowserTestUtils.startLoadingURIString(browser, "https://example.org");

      info("Waiting for dialogs to close.");
      await closedPromises;

      ok(true, "All open dialogs should still close on navigation");
    }
  );
});
