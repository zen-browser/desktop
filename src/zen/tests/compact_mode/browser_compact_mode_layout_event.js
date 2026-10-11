/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const HIDE_PREFS = [
  "zen.view.compact.hide-tabbar",
  "zen.view.compact.hide-toolbar",
];

add_task(function test_layout_update_is_dispatched_synchronously() {
  const saved = HIDE_PREFS.map(pref => Services.prefs.getBoolPref(pref));
  registerCleanupFunction(() => {
    HIDE_PREFS.forEach((pref, i) => Services.prefs.setBoolPref(pref, saved[i]));
  });

  let fired = 0;
  const listener = () => fired++;
  window.addEventListener("ZenCompactMode:LayoutUpdate", listener);

  // Layout listeners may correct an impossible combination of the two prefs
  // and dispatch again, so only the synchronous dispatch is asserted.
  const dispatchesSynchronously = (name, action) => {
    const before = fired;
    action();
    Assert.greater(fired, before, `${name} dispatches the layout update`);
  };

  try {
    dispatchesSynchronously("hideSidebar", () =>
      gZenCompactModeManager.hideSidebar()
    );
    ok(Services.prefs.getBoolPref(HIDE_PREFS[0]), "The tab bar is hidden");
    ok(!Services.prefs.getBoolPref(HIDE_PREFS[1]), "The toolbar is shown");

    dispatchesSynchronously("hideToolbar", () =>
      gZenCompactModeManager.hideToolbar()
    );

    dispatchesSynchronously("hideBoth", () =>
      gZenCompactModeManager.hideBoth()
    );
    ok(Services.prefs.getBoolPref(HIDE_PREFS[0]), "The tab bar is hidden");
    ok(Services.prefs.getBoolPref(HIDE_PREFS[1]), "The toolbar is hidden");
  } finally {
    window.removeEventListener("ZenCompactMode:LayoutUpdate", listener);
  }
});
