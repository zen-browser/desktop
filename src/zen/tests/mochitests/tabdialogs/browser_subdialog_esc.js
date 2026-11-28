/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const TEST_ROOT_CHROME = getRootDirectory(gTestPath);
const TEST_DIALOG_PATH = TEST_ROOT_CHROME + "subdialog.xhtml";

const WEB_ROOT = TEST_ROOT_CHROME.replace(
  "chrome://mochitests/content",
  "https://example.com"
);
const TEST_LOAD_PAGE = WEB_ROOT + "loadDelayedReply.sjs";

/**
 * Tests that ESC on a SubDialog does not cancel ongoing loads in the parent.
 */
add_task(async function test_subdialog_esc_does_not_cancel_load() {
  await BrowserTestUtils.withNewTab(
    "https://example.com",
    async function (browser) {
      // Start loading a page
      let loadStartedPromise = BrowserTestUtils.startLoadingURIString(
        browser,
        TEST_LOAD_PAGE
      );
      let loadedPromise = BrowserTestUtils.browserLoaded(browser);
      await loadStartedPromise;

      // Open a dialog
      let dialogBox = gBrowser.getTabDialogBox(browser);
      let dialogClose = dialogBox.open(TEST_DIALOG_PATH, {
        keepOpenSameOriginNav: true,
      }).closedPromise;

      let dialogs = dialogBox.getTabDialogManager()._dialogs;

      is(dialogs.length, 1, "Dialog manager has a dialog.");

      info("Waiting for dialogs to open.");
      await dialogs[0]._dialogReady;

      // Close the dialog with esc key
      EventUtils.synthesizeKey("KEY_Escape");

      info("Waiting for dialog to close.");
      await dialogClose;

      info("Triggering load complete");
      fetch(TEST_LOAD_PAGE, {
        method: "POST",
      });

      // Load must complete
      info("Waiting for load to complete");
      await loadedPromise;
      ok(true, "Load completed");
    }
  );
});

/**
 * Tests that ESC on a SubDialog with an open dropdown doesn't close the dialog.
 */
add_task(async function test_subdialog_esc_on_dropdown_does_not_close_dialog() {
  await BrowserTestUtils.withNewTab(
    "https://example.com",
    async function (browser) {
      // Open the test dialog
      let dialogBox = gBrowser.getTabDialogBox(browser);
      let dialogClose = dialogBox.open(TEST_DIALOG_PATH, {
        keepOpenSameOriginNav: true,
      }).closedPromise;

      let dialogs = dialogBox.getTabDialogManager()._dialogs;

      is(dialogs.length, 1, "Dialog manager has a dialog.");

      let dialog = dialogs[0];

      info("Waiting for dialog to open.");
      await dialog._dialogReady;

      // Open dropdown
      let select = dialog._frame.contentDocument.getElementById("select");
      let shownPromise = BrowserTestUtils.waitForSelectPopupShown(window);

      info("Opening dropdown");
      select.focus();
      EventUtils.synthesizeKey("VK_SPACE", {}, dialog._frame.contentWindow);

      let selectPopup = await shownPromise;

      let hiddenPromise = BrowserTestUtils.waitForEvent(
        selectPopup,
        "popuphiding",
        true
      );

      // Race dropdown closing vs SubDialog close
      let race = Promise.race([
        hiddenPromise.then(() => true),
        dialogClose.then(() => false),
      ]);

      // Close the dropdown
      if (selectPopup.isNativeMenu) {
        info("Hiding menupopup.");
        await selectPopup.hidePopup();
      } else {
        info("Hitting escape key.");
        await EventUtils.synthesizeKey("KEY_Escape");
      }

      let result = await race;
      ok(result, "Select closed first");

      await new Promise(resolve => executeSoon(resolve));

      ok(!dialog._isClosing, "Dialog is not closing");
      ok(dialog._openedURL, "Dialog is open");
    }
  );
});
