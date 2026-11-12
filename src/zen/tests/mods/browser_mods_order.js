/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

async function orderedIds() {
  return (await gZenModsManager.getOrderedMods()).map(mod => mod.id);
}

add_task(async function test_later_mods_win() {
  await useStore("store");
  await installFromStore(MOD_A);
  await installFromStore(MOD_B);

  Assert.deepEqual(
    await orderedIds(),
    [MOD_A, MOD_B],
    "Mods load in the order they were installed"
  );
  is(
    rootValue(window, "--zen-test-shared"),
    '"b"',
    "The mod that loads last wins"
  );

  await gZenModsManager.setModsOrder([MOD_B, MOD_A]);

  Assert.deepEqual(await orderedIds(), [MOD_B, MOD_A], "The new order is kept");
  is(
    rootValue(window, "--zen-test-shared"),
    '"a"',
    "Moving a mod later makes it win"
  );

  const saved = await IOUtils.readJSON(gZenModsManager.modsDataFile);

  is(saved[MOD_B].order, 0, "The order is saved");
  is(saved[MOD_A].order, 1, "The order is saved for every mod");

  await gZenModsManager.uninstallMod(MOD_A);
  await gZenModsManager.uninstallMod(MOD_B);
});

add_task(async function test_reinstall_fixes_missing_files() {
  await useStore("store");
  await installFromStore(MOD_A);
  await installFromStore(MOD_B);
  await gZenModsManager.setModsOrder([MOD_B, MOD_A]);
  await IOUtils.remove(
    PathUtils.join(gZenModsManager.getModFolder(MOD_A), "chrome.css")
  );
  // Any change rebuilds and notices the missing file.
  await gZenModsManager.setModEnabled(MOD_A, true);

  is(
    gZenModsManager.getModError(MOD_A)?.type,
    "missing-files",
    "A mod without its styles reports it"
  );
  is(gZenModsManager.getModError(MOD_B), null, "The other mod is fine");

  await gZenModsManager.reinstallMod(MOD_A);

  const mod = (await gZenModsManager.getMods())[MOD_A];

  is(gZenModsManager.getModError(MOD_A), null, "Reinstalling clears the error");
  is(rootValue(window, "--zen-test-mod-a"), '"v1"', "The mod applies again");
  is(mod.order, 1, "Reinstalling keeps where the mod loads");
  is(mod.enabled, true, "Reinstalling keeps the mod enabled");

  await gZenModsManager.uninstallMod(MOD_A);
  await gZenModsManager.uninstallMod(MOD_B);
});

add_task(async function test_failed_update_is_reported() {
  await useStore("store");
  await installFromStore(MOD_A);
  await useStore("store-broken");

  const notified = TestUtils.topicObserved("zen-mods-update");

  await gZenModsManager.checkForUpdates();
  await notified;

  is(
    gZenModsManager.getModError(MOD_A)?.type,
    "update-failed",
    "A failed update is reported on the mod"
  );

  await gZenModsManager.uninstallMod(MOD_A);

  is(gZenModsManager.getModError(MOD_A), null, "Uninstalling forgets it");
});
