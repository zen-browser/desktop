/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const MOD_BROKEN = "zen-test-mod-broken";

add_task(async function test_broken_css_stays_in_its_mod() {
  await useStore("store");
  // Order matters: the broken mod loads first and leaves a block open.
  await installFromStore(MOD_BROKEN);
  await installFromStore(MOD_B);

  is(
    rootValue(window, "--zen-test-mod-b"),
    '"b"',
    "A mod after one with an unclosed block still applies"
  );

  await gZenModsManager.uninstallMod(MOD_BROKEN);
  await gZenModsManager.uninstallMod(MOD_B);
});

add_task(async function test_rebuild_reads_the_mod_files_again() {
  await useStore("store");
  await installFromStore(MOD_A);

  is(rootValue(window, "--zen-test-mod-a"), '"v1"', "Installed");

  await IOUtils.writeUTF8(
    PathUtils.join(gZenModsManager.getModFolder(MOD_A), "chrome.css"),
    ':root { --zen-test-mod-a: "edited" !important; }'
  );
  // Any change rebuilds; this one keeps the mod as it is.
  await gZenModsManager.setModEnabled(MOD_A, true);

  is(
    rootValue(window, "--zen-test-mod-a"),
    '"edited"',
    "A rebuild applies what is on disk now"
  );

  await gZenModsManager.uninstallMod(MOD_A);
});

add_task(async function test_disable_all_turns_every_mod_off() {
  await useStore("store");
  await installFromStore(MOD_A);

  const rebuilt = () =>
    TestUtils.topicObserved("zen-mods-update").then(() => {});

  let update = rebuilt();

  Services.prefs.setBoolPref("zen.themes.disable-all", true);
  await update;

  is(rootValue(window, "--zen-test-mod-a"), "", "No mod applies");
  is(
    rootValue(window, "--zen-test-mods-a-color"),
    "",
    "No mod preference applies"
  );

  update = rebuilt();
  Services.prefs.clearUserPref("zen.themes.disable-all");
  await update;

  is(rootValue(window, "--zen-test-mod-a"), '"v1"', "The mods apply again");

  await gZenModsManager.uninstallMod(MOD_A);
});

add_task(async function test_new_windows_get_the_current_sheet() {
  await useStore("store");
  await installFromStore(MOD_A);
  await SpecialPowers.pushPrefEnv({
    set: [["zen.window-sync.enabled", false]],
  });

  const otherWindow = await BrowserTestUtils.openNewBrowserWindow();

  is(
    rootValue(otherWindow, "--zen-test-mod-a"),
    '"v1"',
    "A window opened after a rebuild uses the new sheet"
  );

  await BrowserTestUtils.closeWindow(otherWindow);
  await gZenModsManager.uninstallMod(MOD_A);
});
