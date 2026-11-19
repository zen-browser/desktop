/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const TITLE_ID = "zen-live-folder-rss-invalid-url-title";
const DESCRIPTION_ID = "zen-live-folder-rss-invalid-url-description";
const ZOOM_TOAST_ID = "zen-zoom-changed-toast";
const TEST_PAGE_URL = "https://example.com/";

function toastContainer() {
  return document.getElementById("zen-toast-container");
}

function toasts() {
  return [...toastContainer().querySelectorAll(".zen-toast")];
}

function zoomToasts() {
  return toasts().filter(
    toast =>
      toast.querySelector("label")?.getAttribute("data-l10n-id") ===
      ZOOM_TOAST_ID
  );
}

function waitForToastsGone() {
  return TestUtils.waitForCondition(
    () => !toasts().length && toastContainer().hasAttribute("hidden"),
    "All toasts are removed and the container is hidden again"
  );
}

function waitForLayout(singleToolbar) {
  return TestUtils.waitForCondition(
    () => gZenVerticalTabsManager._hasSetSingleToolbar === singleToolbar,
    `The ${singleToolbar ? "single" : "double"} toolbar layout is active`
  );
}

add_setup(async function () {
  await TestUtils.waitForCondition(
    () => !toasts().length,
    "No toast is showing when the test starts"
  );
});

add_task(async function test_show_and_auto_hide() {
  await gZenUIManager.showToast(TITLE_ID, { timeout: 100 });

  ok(!toastContainer().hasAttribute("hidden"), "Container is shown");
  const [toast] = toasts();
  is(toasts().length, 1, "One toast is shown");
  is(
    toast.querySelector("label").getAttribute("data-l10n-id"),
    TITLE_ID,
    "The toast label uses the message id"
  );
  ok(!toast.querySelector(".description"), "No description was asked for");
  ok(!toast.hasAttribute("button"), "No button was asked for");

  await waitForToastsGone();
});

add_task(async function test_description() {
  await gZenUIManager.showToast(TITLE_ID, {
    timeout: 100,
    descriptionId: DESCRIPTION_ID,
  });
  const description = toasts()[0].querySelector(".description");
  ok(description, "A description label is shown");
  is(
    description.getAttribute("data-l10n-id"),
    DESCRIPTION_ID,
    "The description uses its message id"
  );
  await waitForToastsGone();
});

add_task(async function test_same_message_reuses_toast() {
  await gZenUIManager.showToast(TITLE_ID, { timeout: 200 });
  const [first] = toasts();
  await gZenUIManager.showToast(TITLE_ID, { timeout: 200 });
  is(toasts().length, 1, "Showing the same message again does not stack");
  is(toasts()[0], first, "The existing toast element is reused");
  await waitForToastsGone();
});

add_task(async function test_same_message_updates_l10n_args() {
  const SHORTCUT_ID = "zen-sidebar-drag-collapsed-toast";
  await gZenUIManager.showToast(SHORTCUT_ID, {
    timeout: 200,
    l10nArgs: { shortcut: "Ctrl+B" },
  });
  const [toast] = toasts();
  const label = toast.querySelector("label");
  is(
    JSON.parse(label.getAttribute("data-l10n-args")).shortcut,
    "Ctrl+B",
    "The first set of arguments is applied"
  );

  await gZenUIManager.showToast(SHORTCUT_ID, {
    timeout: 200,
    l10nArgs: { shortcut: "Ctrl+Shift+B" },
  });
  is(toasts().length, 1, "The toast is reused");
  is(
    JSON.parse(label.getAttribute("data-l10n-args")).shortcut,
    "Ctrl+Shift+B",
    "The reused toast updates its arguments"
  );
  await waitForToastsGone();
});

add_task(async function test_button() {
  let clicks = 0;
  await gZenUIManager.showToast(TITLE_ID, {
    timeout: 200,
    button: {
      id: "zen-test-toast-button",
      command: () => clicks++,
    },
  });
  const [toast] = toasts();
  ok(toast.hasAttribute("button"), "The toast is marked as having a button");
  const button = toast.querySelector("button");
  is(button?.id, "zen-test-toast-button", "The button has the given id");
  button.doCommand();
  is(clicks, 1, "The button command runs");

  // Re-showing with a new button replaces the old one.
  await gZenUIManager.showToast(TITLE_ID, {
    timeout: 200,
    button: {
      id: "zen-test-toast-button-2",
      command: () => {},
    },
  });
  is(toasts().length, 1, "Still a single toast");
  is(toast.querySelectorAll("button").length, 1, "Only one button remains");
  is(toast.querySelector("button").id, "zen-test-toast-button-2");
  await waitForToastsGone();
});

add_task(async function test_hover_pauses_auto_hide() {
  await gZenUIManager.showToast(TITLE_ID, { timeout: 200 });
  const [toast] = toasts();
  toast.dispatchEvent(new MouseEvent("mouseover"));
  // eslint-disable-next-line mozilla/no-arbitrary-setTimeout
  await new Promise(resolve => setTimeout(resolve, 600));
  is(toasts().length, 1, "A hovered toast stays while the mouse is over it");
  toast.dispatchEvent(new MouseEvent("mouseout"));
  await waitForToastsGone();
});

add_task(async function test_zoom_change_shows_toast_in_single_toolbar() {
  await waitForLayout(true);

  await BrowserTestUtils.withNewTab(TEST_PAGE_URL, async () => {
    FullZoom.enlarge();
    await TestUtils.waitForCondition(
      () => zoomToasts().length === 1,
      "A zoom toast is shown"
    );

    const label = zoomToasts()[0].querySelector("label");
    is(
      JSON.parse(label.getAttribute("data-l10n-args")).percentage,
      Number(gBrowser.selectedBrowser.fullZoom.toFixed(2)),
      "The toast shows the new zoom level"
    );
  });

  await waitForToastsGone();
});

add_task(async function test_zoom_change_does_not_show_toast_on_blank_page() {
  await waitForLayout(true);

  await BrowserTestUtils.withNewTab("about:blank", async () => {
    const zoomChanged = new Promise(resolve =>
      window.addEventListener("FullZoomChange", resolve, { once: true })
    );
    FullZoom.enlarge();
    await zoomChanged;
    // eslint-disable-next-line mozilla/no-arbitrary-setTimeout
    await new Promise(resolve => setTimeout(resolve, 500));
    is(zoomToasts().length, 0, "No zoom toast is shown on about:blank");

    await FullZoom.reset();
  });

  await waitForToastsGone();
});

add_task(
  async function test_zoom_change_does_not_show_toast_in_double_toolbar() {
    await SpecialPowers.pushPrefEnv({
      set: [["zen.view.use-single-toolbar", false]],
    });
    await waitForLayout(false);
    await waitForToastsGone();

    await BrowserTestUtils.withNewTab(TEST_PAGE_URL, async () => {
      FullZoom.enlarge();
      // eslint-disable-next-line mozilla/no-arbitrary-setTimeout
      await new Promise(resolve => setTimeout(resolve, 500));
      is(zoomToasts().length, 0, "No zoom toast is shown");

      await FullZoom.reset();
    });

    await SpecialPowers.popPrefEnv();
  }
);

add_task(
  async function test_zoom_change_does_not_show_toast_in_single_toolbar_when_zoom_button_kept() {
    await SpecialPowers.pushPrefEnv({
      set: [["zen.urlbar.single-toolbar-show-zoom-button", true]],
    });
    await waitForLayout(true);
    await waitForToastsGone();

    await BrowserTestUtils.withNewTab(TEST_PAGE_URL, async () => {
      FullZoom.enlarge();
      await TestUtils.waitForCondition(
        () =>
          !document
            .getElementById("urlbar-zoom-button")
            .hasAttribute("hidden") &&
          getComputedStyle(document.getElementById("urlbar-zoom-button"))
            .display !== "none",
        "The zoom button is visible in the URL bar"
      );
      // eslint-disable-next-line mozilla/no-arbitrary-setTimeout
      await new Promise(resolve => setTimeout(resolve, 500));
      is(
        zoomToasts().length,
        0,
        "No zoom toast is shown while the URL bar is visible"
      );

      await FullZoom.reset();
    });

    await SpecialPowers.popPrefEnv();
  }
);

add_task(
  async function test_zoom_change_shows_toast_in_single_toolbar_compact_with_zoom_button_kept() {
    await SpecialPowers.pushPrefEnv({
      set: [
        ["zen.urlbar.single-toolbar-show-zoom-button", true],
        ["zen.view.compact.hide-toolbar", false],
        ["zen.view.compact.animate-sidebar", false],
        [
          "zen.view.compact.enable-at-startup",
          Services.prefs.getBoolPref(
            "zen.view.compact.enable-at-startup",
            false
          ),
        ],
      ],
    });
    await waitForLayout(true);

    gZenCompactModeManager.preference = true;
    await TestUtils.waitForCondition(
      () => gZenCompactModeManager.preference,
      "Compact mode is enabled"
    );

    await BrowserTestUtils.withNewTab(TEST_PAGE_URL, async () => {
      FullZoom.enlarge();
      await TestUtils.waitForCondition(
        () => zoomToasts().length === 1,
        "A zoom toast is shown because the URL bar is hidden in compact mode"
      );

      await FullZoom.reset();
    });

    gZenCompactModeManager.preference = false;
    await TestUtils.waitForCondition(
      () => !gZenCompactModeManager.preference,
      "Compact mode is disabled again"
    );

    await waitForToastsGone();
    await SpecialPowers.popPrefEnv();
  }
);
