/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const SNAP_TEST_PAGE =
  "data:text/html,<input id='file-input' type='file' accept='image/*' multiple>" +
  "<label id='file-label' for='file-input'>Choose an image</label>";

let gOriginalClipboardImageData;
let gOriginalRecentDownloads;

function snapModal() {
  return document.getElementById("zen-snap-modal");
}

async function waitForSnapToOpen() {
  await TestUtils.waitForCondition(
    () => gZenSnapManager.isModalOpen(),
    "The Snap modal should open"
  );
}

async function waitForSnapToClose() {
  await TestUtils.waitForCondition(
    () => snapModal().hidden,
    "The Snap modal should be hidden after its closing animation"
  );
}

add_setup(function () {
  gOriginalClipboardImageData = gZenSnapManager.getClipboardImageData;
  gOriginalRecentDownloads = gZenSnapManager.getRecentDownloads;

  gZenSnapManager.getClipboardImageData = () => null;
  gZenSnapManager.getRecentDownloads = async () => [];

  registerCleanupFunction(() => {
    gZenSnapManager.getClipboardImageData = gOriginalClipboardImageData;
    gZenSnapManager.getRecentDownloads = gOriginalRecentDownloads;
    gZenSnapManager.hideModal();
  });
});

add_task(async function test_file_input_opens_empty_snap_modal() {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.snap.position", "bottom-right"]],
  });

  await BrowserTestUtils.withNewTab(SNAP_TEST_PAGE, async (browser) => {
    await BrowserTestUtils.synthesizeMouseAtCenter("#file-input", {}, browser);
    await waitForSnapToOpen();

    const modal = snapModal();
    ok(!modal.hidden, "The modal is visible");
    is(
      modal.getAttribute("data-position"),
      "bottom-right",
      "The modal uses the configured position"
    );
    ok(
      !document.getElementById("zen-snap-empty-status").hidden,
      "The empty state is shown when there is no clipboard image or download"
    );
    ok(
      document.getElementById("zen-snap-clipboard-card").hidden,
      "The clipboard card is hidden without a clipboard image"
    );
    ok(
      document.getElementById("zen-snap-download-card").hidden,
      "The download card is hidden without a recent download"
    );

    document.getElementById("zen-snap-close-btn").doCommand();
    await waitForSnapToClose();
  });

  await SpecialPowers.popPrefEnv();
});

add_task(async function test_label_opens_snap_and_escape_dismisses_it() {
  await BrowserTestUtils.withNewTab(SNAP_TEST_PAGE, async (browser) => {
    await BrowserTestUtils.synthesizeMouseAtCenter("#file-label", {}, browser);
    await waitForSnapToOpen();

    await BrowserTestUtils.synthesizeKey("KEY_Escape", {}, browser);
    await waitForSnapToClose();
  });
});

add_task(async function test_manager_does_not_open_when_snap_is_disabled() {
  await SpecialPowers.pushPrefEnv({ set: [["zen.snap.enabled", false]] });

  await gZenSnapManager.onInputClicked({}, {});
  ok(!gZenSnapManager.isModalOpen(), "The disabled feature does not open");

  await SpecialPowers.popPrefEnv();
});
