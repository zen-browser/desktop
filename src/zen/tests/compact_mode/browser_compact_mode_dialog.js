/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_toolbar_collapses_after_modal_dialog_closes() {
  const toolbar = document.getElementById("zen-appcontent-navbar-wrapper");

  EventUtils.synthesizeMouseAtCenter(
    gBrowser.selectedBrowser,
    { type: "mousemove" },
    window
  );
  await TestUtils.waitForCondition(
    () => !toolbar.matches(":hover"),
    "The pointer should be outside the toolbar"
  );

  gZenCompactModeManager._setElementExpandAttribute(toolbar, true);
  Assert.ok(
    toolbar.hasAttribute("zen-has-hover"),
    "The toolbar starts with a stale hover state"
  );

  const dialogClosed = BrowserTestUtils.waitForEvent(
    window,
    "DOMModalDialogClosed"
  );
  const dialogOpened = BrowserTestUtils.promiseAlertDialogOpen();
  setTimeout(() => Services.prompt.alert(window, "Test", "Test"), 0);

  let dialogWindow = await dialogOpened;
  let dialogContainer =
    dialogWindow.docShell.chromeEventHandler.closest("dialog");
  const dialogRemoved = BrowserTestUtils.waitForMutationCondition(
    dialogContainer,
    { childList: true, attributes: true },
    () => !dialogContainer.hasChildNodes() && !dialogContainer.open
  );

  dialogWindow.document.querySelector("dialog").acceptDialog();
  await dialogClosed;
  await dialogRemoved;
  dialogWindow = null;
  dialogContainer = null;

  Assert.ok(
    !toolbar.hasAttribute("zen-has-hover"),
    "Closing a modal dialog clears the stale toolbar hover state"
  );
});
