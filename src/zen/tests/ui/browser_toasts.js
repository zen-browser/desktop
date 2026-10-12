/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const TITLE_ID = "zen-live-folder-rss-invalid-url-title";
const DESCRIPTION_ID = "zen-live-folder-rss-invalid-url-description";

function toastContainer() {
  return document.getElementById("zen-toast-container");
}

function toasts() {
  return [...toastContainer().querySelectorAll(".zen-toast")];
}

function waitForToastsGone() {
  return TestUtils.waitForCondition(
    () => !toasts().length && toastContainer().hasAttribute("hidden"),
    "All toasts are removed and the container is hidden again"
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
