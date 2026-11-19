/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const TEST_ROOT_CHROME = getRootDirectory(gTestPath);
const TEST_DIALOG_PATH = TEST_ROOT_CHROME + "subdialog.xhtml";

/**
 * Tests that tab dialogs are focused when switching tabs.
 */
add_task(async function test_tabdialogbox_tab_switch_focus() {
  // Open 3 tabs
  let tabPromises = [];
  for (let i = 0; i < 3; i += 1) {
    tabPromises.push(
      BrowserTestUtils.openNewForegroundTab(
        gBrowser,
        // eslint-disable-next-line sdl/no-insecure-url
        "http://example.com",
        true
      )
    );
  }

  // Wait for tabs to be ready
  let tabs = await Promise.all(tabPromises);

  // Open subdialog in first two tabs
  let dialogs = [];
  for (let i = 0; i < 2; i += 1) {
    let dialogBox = gBrowser.getTabDialogBox(tabs[i].linkedBrowser);
    dialogBox.open(TEST_DIALOG_PATH);
    dialogs.push(dialogBox.getTabDialogManager()._topDialog);
  }

  // Wait for dialogs to be ready
  await Promise.all([dialogs[0]._dialogReady, dialogs[1]._dialogReady]);

  // Switch to first tab which has dialog
  await BrowserTestUtils.switchTab(gBrowser, tabs[0]);

  // The textbox in the dialogs content window should be focused
  let dialogTextbox =
    dialogs[0]._frame.contentDocument.querySelector("#textbox");
  is(Services.focus.focusedElement, dialogTextbox, "Dialog textbox is focused");

  // Switch to second tab which has dialog
  await BrowserTestUtils.switchTab(gBrowser, tabs[1]);

  // The textbox in the dialogs content window should be focused
  let dialogTextbox2 =
    dialogs[1]._frame.contentDocument.querySelector("#textbox");
  is(
    Services.focus.focusedElement,
    dialogTextbox2,
    "Dialog2 textbox is focused"
  );

  // Switch to third tab which does not have a dialog
  await BrowserTestUtils.switchTab(gBrowser, tabs[2]);

  // Test that content is focused
  is(
    Services.focus.focusedElement,
    tabs[2].linkedBrowser,
    "Top level browser is focused"
  );

  // Cleanup
  tabs.forEach(tab => {
    BrowserTestUtils.removeTab(tab);
  });
});

/**
 * Tests that if we're showing multiple tab dialogs they are focused in the
 * correct order and custom focus handlers are called.
 */
add_task(async function test_tabdialogbox_multiple_focus() {
  await BrowserTestUtils.withNewTab(gBrowser, async browser => {
    let dialogBox = gBrowser.getTabDialogBox(browser);
    let dialogAClose = dialogBox.open(
      TEST_DIALOG_PATH,
      {},
      {
        testCustomFocusHandler: true,
      }
    ).closedPromise;
    let dialogBClose = dialogBox.open(TEST_DIALOG_PATH).closedPromise;
    let dialogCClose = dialogBox.open(
      TEST_DIALOG_PATH,
      {},
      {
        testCustomFocusHandler: true,
      }
    ).closedPromise;

    let dialogs = dialogBox._tabDialogManager._dialogs;
    let [dialogA, dialogB, dialogC] = dialogs;

    // Wait until all dialogs are ready
    await Promise.all(dialogs.map(dialog => dialog._dialogReady));

    // Dialog A's custom focus target should be focused
    let dialogElementA =
      dialogA._frame.contentDocument.querySelector("#custom-focus-el");
    is(
      Services.focus.focusedElement,
      dialogElementA,
      "Dialog A custom focus target is focused"
    );

    // Close top dialog
    dialogA.close();
    await dialogAClose;

    // Dialog B's first focus target should be focused
    let dialogElementB =
      dialogB._frame.contentDocument.querySelector("#textbox");
    is(
      Services.focus.focusedElement,
      dialogElementB,
      "Dialog B default focus target is focused"
    );

    // close top dialog
    dialogB.close();
    await dialogBClose;

    // Dialog C's custom focus target should be focused
    let dialogElementC =
      dialogC._frame.contentDocument.querySelector("#custom-focus-el");
    is(
      Services.focus.focusedElement,
      dialogElementC,
      "Dialog C custom focus target is focused"
    );

    // Close last dialog
    dialogC.close();
    await dialogCClose;

    is(
      dialogBox._tabDialogManager._dialogs.length,
      0,
      "All dialogs should be closed"
    );
    is(
      Services.focus.focusedElement,
      browser,
      "Focus should be back on the browser"
    );
  });
});

/**
 * Tests that other dialogs are still visible if one dialog is hidden.
 */
add_task(async function test_tabdialogbox_tab_switch_hidden() {
  // Open 2 tabs
  let tabPromises = [];
  for (let i = 0; i < 2; i += 1) {
    tabPromises.push(
      BrowserTestUtils.openNewForegroundTab(
        gBrowser,
        // eslint-disable-next-line sdl/no-insecure-url
        "http://example.com",
        true
      )
    );
  }

  // Wait for tabs to be ready
  let tabs = await Promise.all(tabPromises);

  // Open subdialog in tabs
  let dialogs = [];
  let dialogBox, dialogBoxManager, browser;
  for (let i = 0; i < 2; i += 1) {
    dialogBox = gBrowser.getTabDialogBox(tabs[i].linkedBrowser);
    browser = tabs[i].linkedBrowser;
    dialogBox.open(TEST_DIALOG_PATH);
    dialogBoxManager = dialogBox.getTabDialogManager();
    dialogs.push(dialogBoxManager._topDialog);
  }

  // Wait for dialogs to be ready
  await Promise.all([dialogs[0]._dialogReady, dialogs[1]._dialogReady]);

  // Hide the top dialog
  dialogBoxManager.hideDialog(browser);

  ok(
    BrowserTestUtils.isHidden(dialogBoxManager._dialogStack),
    "Dialog stack is hidden"
  );

  // Switch to first tab
  await BrowserTestUtils.switchTab(gBrowser, tabs[0]);

  // Check the dialog stack is showing in first tab
  dialogBoxManager = gBrowser
    .getTabDialogBox(tabs[0].linkedBrowser)
    .getTabDialogManager();
  is(dialogBoxManager._dialogStack.hidden, false, "Dialog stack is showing");

  // Cleanup
  tabs.forEach(tab => {
    BrowserTestUtils.removeTab(tab);
  });
});
