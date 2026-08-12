/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_toolbar_collapses_after_modal_dialog_closes() {
  const toolbar = document.getElementById("zen-appcontent-navbar-wrapper");
  const browser = gBrowser.selectedBrowser;

  EventUtils.synthesizeMouseAtCenter(browser, { type: "mousemove" }, window);
  await TestUtils.waitForCondition(
    () => !toolbar.matches(":hover"),
    "The pointer should be outside the toolbar"
  );

  gZenCompactModeManager._setElementExpandAttribute(toolbar, true);
  Assert.ok(
    toolbar.hasAttribute("zen-has-hover"),
    "The toolbar starts with a stale hover state"
  );

  // Firefox dispatches this event after beforeunload and other modal prompts.
  window.dispatchEvent(new CustomEvent("DOMModalDialogClosed"));

  Assert.ok(
    !toolbar.hasAttribute("zen-has-hover"),
    "Closing a modal dialog clears the stale toolbar hover state"
  );
});
