/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * bookmarkProperties.xhtml opts into zen-max-window-ratio="0.8": SubDialog
 * must cap the frame at 80% of the window height, re-measure when a section
 * expands (the zen MutationObserver watches `hidden` flips), and disconnect
 * the observer on close.
 */

const { SubDialog } = ChromeUtils.importESModule(
  "resource://gre/modules/SubDialog.sys.mjs"
);

const DIALOG_URL = "chrome://browser/content/places/bookmarkProperties.xhtml";
const TEST_URI = Services.io.newURI("about:buildconfig");

// Toolbar/dialog helpers live with the spaces suite.
Services.scriptloader.loadSubScript(
  new URL("../spaces/bookmark_edit_helpers.js", gTestPath).href,
  this
);

add_task(async function test_zen_max_window_ratio_clamps_and_autosizes() {
  // Capture the active SubDialog instance and count resize calls. The dialog
  // is the only SubDialog alive in this window for the duration of the task.
  const originalResize = SubDialog.prototype.resizeVertically;
  let resizeCalls = 0;
  let activeDialog = null;
  SubDialog.prototype.resizeVertically = function (...args) {
    resizeCalls++;
    activeDialog = this;
    return originalResize.apply(this, args);
  };
  registerCleanupFunction(() => {
    SubDialog.prototype.resizeVertically = originalResize;
  });

  // Open the "add bookmark" variant: it needs no existing bookmark or
  // bookmarks toolbar node, and it exercises the same markup.
  let dialogPromise = BrowserTestUtils.promiseAlertDialogOpen(
    null,
    DIALOG_URL,
    { isSubDialog: true }
  );
  executeSoon(() => {
    window.gDialogBox.open(DIALOG_URL, {
      action: "add",
      type: "bookmark",
      uri: TEST_URI,
    });
  });
  let dialogWin = await dialogPromise;
  await dialogWin.document.mozSubdialogReady;

  const doc = dialogWin.document;
  const frame = dialogWin.browsingContext.embedderElement;
  ok(frame, "the SubDialog frame should be reachable from the dialog window");
  ok(
    doc.querySelector("[zen-max-window-ratio]"),
    "the bookmark properties dialog should opt into zen-max-window-ratio"
  );

  const maxHeightTarget = () => window.innerHeight * 0.8;
  await TestUtils.waitForCondition(
    () =>
      frame.style.maxHeight &&
      Math.abs(parseFloat(frame.style.maxHeight) - maxHeightTarget()) <= 2,
    `frame maxHeight should clamp to ~80% of window height (${maxHeightTarget()}px)`
  );
  Assert.ok(
    frame.getBoundingClientRect().height <= maxHeightTarget() + 1,
    "the initial dialog height should be within the clamp"
  );

  // The autosize observer is installed at the end of SubDialog.resizeDialog(),
  // which can still be settling after the dialog reports itself ready.
  await TestUtils.waitForCondition(
    () => !!activeDialog?._zenAutosize,
    "the zen autosize observer should be installed"
  );
  const autosize = activeDialog._zenAutosize;

  // Simulate expanding a section: flipping a `hidden` attribute must make the
  // zen MutationObserver re-measure. The workspace list starts hidden.
  const expandable = doc.getElementById("editBMPanel_workspaceList");
  ok(expandable, "the dialog should have a collapsible section");
  const resizesBeforeExpand = resizeCalls;
  expandable.hidden = false;
  await TestUtils.waitForCondition(
    () => resizeCalls > resizesBeforeExpand,
    "the zen autosize observer should trigger a resize on expand"
  );
  // Let the resize settle over two frames, then re-check the clamp.
  await new Promise(resolve =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  );
  Assert.ok(
    frame.getBoundingClientRect().height <= maxHeightTarget() + 1,
    "the expanded dialog should still be clamped to 80% of the window"
  );

  // The observer must be disconnected when the dialog closes.
  let disconnected = false;
  const originalDisconnect = autosize.disconnect.bind(autosize);
  autosize.disconnect = () => {
    disconnected = true;
    originalDisconnect();
  };

  const closed = promiseDialogClosed(dialogWin);
  doc.getElementById("bookmarkpropertiesdialog").cancelDialog();
  await closed;
  ok(disconnected, "the zen autosize observer should disconnect on close");
});
