/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_every_window_follows_one_build() {
  await useStore("store");
  // Window sync would mirror the new window's tab into this one.
  await SpecialPowers.pushPrefEnv({
    set: [["zen.window-sync.enabled", false]],
  });

  const otherWindow = await BrowserTestUtils.openNewBrowserWindow();

  await otherWindow.gZenWorkspaces.promiseInitialized;

  let builds = 0;
  const countBuilds = () => builds++;

  Services.obs.addObserver(countBuilds, "zen-mods-update");
  registerCleanupFunction(() =>
    Services.obs.removeObserver(countBuilds, "zen-mods-update")
  );

  await installFromStore(MOD_A);

  is(builds, 1, "One install builds the mods once for every window");

  for (const win of [window, otherWindow]) {
    await waitForRootValue(
      win,
      "--zen-test-mod-a",
      '"v1"',
      "The mod applies in every window"
    );
    is(
      rootValue(win, "--zen-test-mods-a-color"),
      "red",
      "String preferences apply in every window"
    );
  }

  Services.prefs.setStringPref("zen.test.mods.a.color", "green");

  await waitForRootValue(
    otherWindow,
    "--zen-test-mods-a-color",
    "green",
    "Preference changes reach every window"
  );

  await gZenModsManager.setModEnabled(MOD_A, false);

  for (const win of [window, otherWindow]) {
    is(rootValue(win, "--zen-test-mod-a"), "", "Disabling applies everywhere");
    is(
      rootValue(win, "--zen-test-mods-a-color"),
      "",
      "Disabling removes the custom properties everywhere"
    );
  }

  await BrowserTestUtils.closeWindow(otherWindow);
  await gZenModsManager.uninstallMod(MOD_A);
});
