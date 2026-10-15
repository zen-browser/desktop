/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

function countGlanceObservers() {
  return Array.from(
    Services.obs.enumerateObservers("quit-application-requested")
  ).filter(observer => {
    const manager = observer.wrappedJSObject || observer;
    return manager.constructor.name === "nsZenGlanceManager";
  }).length;
}

add_task(async function test_glance_observer_removed_on_window_close() {
  const baseline = countGlanceObservers();
  const win = await BrowserTestUtils.openNewBrowserWindow();
  try {
    await win.gZenWorkspaces.promiseInitialized;
    is(
      countGlanceObservers(),
      baseline + 1,
      "The window registers its manager"
    );

    // Simulate two quit requests that leave the window open.
    win.gZenGlanceManager.observe(null, "quit-application-requested");
    win.gZenGlanceManager.observe(null, "quit-application-requested");
    is(
      countGlanceObservers(),
      baseline + 1,
      "Canceled quit requests keep the manager registered"
    );

    const glanceTab = await win.gZenGlanceManager.openGlance({
      url: "https://example.com/",
      clientX: 0,
      clientY: 0,
      width: 0,
      height: 0,
      triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
    });
    ok(glanceTab.hasAttribute("zen-glance-tab"), "A glance is open at close");
  } finally {
    await BrowserTestUtils.closeWindow(win);
  }

  is(
    countGlanceObservers(),
    baseline,
    "Closing the window removes its manager from the observer service"
  );
});
