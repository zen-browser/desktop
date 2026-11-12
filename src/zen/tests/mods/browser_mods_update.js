/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

async function stagingFolders() {
  const children = await IOUtils.getChildren(gZenModsManager.modsRootPath);

  return children.filter(path => PathUtils.filename(path).includes(".staging"));
}

add_task(async function test_failed_update_keeps_the_installed_version() {
  await useStore("store");
  await installFromStore(MOD_A);
  await waitForRootValue(window, "--zen-test-mod-a", '"v1"', "Installed");

  await useStore("store-broken");

  Assert.deepEqual(
    await gZenModsManager.checkForUpdates(),
    [],
    "An update whose files fail to download is not applied"
  );
  is(
    (await gZenModsManager.getMods())[MOD_A].version,
    "1.0.0",
    "The installed version is still recorded"
  );
  is(
    rootValue(window, "--zen-test-mod-a"),
    '"v1"',
    "The installed version keeps applying"
  );
  Assert.deepEqual(
    await stagingFolders(),
    [],
    "The failed download leaves nothing behind"
  );

  await gZenModsManager.uninstallMod(MOD_A);
});

add_task(async function test_update_keeps_whether_the_mod_is_enabled() {
  await useStore("store");
  await installFromStore(MOD_A);
  await gZenModsManager.setModEnabled(MOD_A, false);

  await useStore("store-v2");

  const updates = await gZenModsManager.checkForUpdates();
  const mod = (await gZenModsManager.getMods())[MOD_A];

  Assert.deepEqual(
    updates.map(update => update.id),
    [MOD_A],
    "The newer version is installed"
  );
  is(mod.version, "2.0.0", "The new version is recorded");
  is(mod.enabled, false, "The mod stays disabled");
  is(rootValue(window, "--zen-test-mod-a"), "", "A disabled mod doesn't apply");

  await gZenModsManager.setModEnabled(MOD_A, true);

  is(rootValue(window, "--zen-test-mod-a"), '"v2"', "The new styles apply");

  await gZenModsManager.uninstallMod(MOD_A);
});

add_task(async function test_update_restores_missing_files() {
  await useStore("store");
  await installFromStore(MOD_A);
  await IOUtils.remove(gZenModsManager.getModFolder(MOD_A), {
    recursive: true,
  });

  await gZenModsManager.checkForUpdates();

  is(
    rootValue(window, "--zen-test-mod-a"),
    '"v1"',
    "The store's copy replaces the missing files"
  );

  await gZenModsManager.uninstallMod(MOD_A);
});

add_task(async function test_unreachable_store() {
  await useStore("store");
  await installFromStore(MOD_A);
  await useStore("store-that-does-not-exist");

  is(
    await gZenModsManager.checkForUpdates(),
    null,
    "An unreachable store reports that the check failed"
  );
  is(
    rootValue(window, "--zen-test-mod-a"),
    '"v1"',
    "The installed mod keeps applying"
  );

  await gZenModsManager.uninstallMod(MOD_A);
});

add_task(async function test_no_mods_means_no_store_requests() {
  await useStore("store-that-does-not-exist");

  Assert.deepEqual(
    await gZenModsManager.checkForUpdates(),
    [],
    "Without mods the store is not asked"
  );
});

add_task(async function test_store_mods_cant_load_from_the_web() {
  await useStore("store-remote");
  await Assert.rejects(
    installFromStore(MOD_A),
    error => error.name === "RemoteStylesError",
    "A store mod whose styles load from the web isn't installed"
  );
  ok(!(await gZenModsManager.isModInstalled(MOD_A)), "Nothing of it stays");

  await useStore("store");
  await installFromStore(MOD_A);
  await useStore("store-remote");

  const updates = await gZenModsManager.checkForUpdates();

  Assert.deepEqual(updates, [], "Nor is an update that does");
  is(
    (await gZenModsManager.getMods())[MOD_A].version,
    "1.0.0",
    "The installed version stays"
  );
  is(
    gZenModsManager.getModError(MOD_A)?.type,
    "update-failed",
    "And the mod says why"
  );

  await gZenModsManager.uninstallMod(MOD_A);
});
