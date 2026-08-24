/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const QUIT_REQUESTED_TOPIC = "quit-application-requested";

function isObserverRegistered(observerToFind) {
  return [...Services.obs.enumerateObservers(QUIT_REQUESTED_TOPIC)].includes(
    observerToFind
  );
}

add_task(async function test_glance_manager_cleans_up_on_window_unload() {
  const testWindow = await BrowserTestUtils.openNewBrowserWindow();
  const manager = testWindow.gZenGlanceManager;

  try {
    Assert.ok(
      isObserverRegistered(manager),
      "A new window should register its Glance quit observer"
    );
  } finally {
    await BrowserTestUtils.closeWindow(testWindow);
  }

  Assert.ok(
    !isObserverRegistered(manager),
    "Closing a browser window should unregister its Glance manager"
  );
});
