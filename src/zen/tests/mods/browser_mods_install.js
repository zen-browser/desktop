/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_install_applies_styles_and_preferences() {
  await useStore("store");
  await installFromStore(MOD_A);

  const folder = gZenModsManager.getModFolder(MOD_A);

  ok(await gZenModsManager.isModInstalled(MOD_A), "The mod is installed");
  ok(
    await IOUtils.exists(PathUtils.join(folder, "chrome.css")),
    "The mod's styles are on disk"
  );
  await waitForRootValue(
    window,
    "--zen-test-mod-a",
    '"v1"',
    "The mod's styles apply"
  );
  ok(
    Services.prefs.getBoolPref("zen.test.mods.a.checkbox"),
    "Checkbox preferences get their default value"
  );
  is(
    rootValue(window, "--zen-test-mods-a-color"),
    "red",
    "String preferences become custom properties on the root"
  );
  is(
    document
      .getElementById("theme-Test-Mod-A")
      ?.getAttribute("zen-test-mods-a-mode"),
    "compact",
    "Dropdown preferences are set on the mod's hidden element"
  );

  Services.prefs.setStringPref("zen.test.mods.a.color", "blue");
  await waitForRootValue(
    window,
    "--zen-test-mods-a-color",
    "blue",
    "Changing a string preference applies right away"
  );

  await gZenModsManager.uninstallMod(MOD_A);

  ok(!(await IOUtils.exists(folder)), "Uninstalling removes the mod's files");
  is(rootValue(window, "--zen-test-mod-a"), "", "The mod's styles are gone");
  is(
    rootValue(window, "--zen-test-mods-a-color"),
    "",
    "The mod's custom properties are gone"
  );
  ok(
    !document.getElementById("theme-Test-Mod-A"),
    "The mod's hidden element is gone"
  );
  is(
    Services.prefs.getPrefType("zen.test.mods.a.checkbox"),
    Services.prefs.PREF_INVALID,
    "Uninstalling clears the mod's preferences"
  );
});

add_task(async function test_disable_keeps_the_mod() {
  await useStore("store");
  await installFromStore(MOD_A);
  await waitForRootValue(window, "--zen-test-mod-a", '"v1"', "Installed");

  await gZenModsManager.setModEnabled(MOD_A, false);

  is(rootValue(window, "--zen-test-mod-a"), "", "A disabled mod doesn't apply");
  ok(
    await IOUtils.exists(gZenModsManager.getModFolder(MOD_A)),
    "A disabled mod keeps its files"
  );

  await gZenModsManager.setModEnabled(MOD_A, true);

  is(
    rootValue(window, "--zen-test-mod-a"),
    '"v1"',
    "Enabling applies it again"
  );

  await gZenModsManager.uninstallMod(MOD_A);
});

add_task(async function test_missing_files_only_skip_that_mod() {
  await useStore("store");
  await installFromStore(MOD_A);
  await installFromStore(MOD_B);

  await IOUtils.remove(
    PathUtils.join(gZenModsManager.getModFolder(MOD_A), "chrome.css")
  );
  await gZenModsManager.setModEnabled(MOD_B, false);
  await gZenModsManager.setModEnabled(MOD_B, true);

  is(rootValue(window, "--zen-test-mod-a"), "", "The broken mod is skipped");
  is(
    rootValue(window, "--zen-test-mod-b"),
    '"b"',
    "The other mods still apply"
  );

  await gZenModsManager.uninstallMod(MOD_A);
  await gZenModsManager.uninstallMod(MOD_B);
});

add_task(async function test_concurrent_changes_are_all_kept() {
  await useStore("store");

  const [modA, modB] = await Promise.all([
    gZenModsManager.fetchStoreMod(MOD_A),
    gZenModsManager.fetchStoreMod(MOD_B),
  ]);

  await Promise.all([
    gZenModsManager.installMod(modA),
    gZenModsManager.installMod(modB),
  ]);
  await Promise.all([
    gZenModsManager.setModEnabled(MOD_A, false),
    gZenModsManager.setModEnabled(MOD_B, false),
    gZenModsManager.setModEnabled(MOD_A, true),
  ]);

  const saved = await IOUtils.readJSON(gZenModsManager.modsDataFile);

  ok(saved[MOD_A] && saved[MOD_B], "Both installs were saved");
  is(saved[MOD_A].enabled, true, "The last change to mod A wins");
  is(saved[MOD_B].enabled, false, "The change to mod B was saved");

  await gZenModsManager.uninstallMod(MOD_A);
  await gZenModsManager.uninstallMod(MOD_B);
});
