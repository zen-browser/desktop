/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const SCRIPTS_PREF = "zen.mods.scripts.enabled";

/**
 * A script that marks the window's root, through a helper it imports, and
 * takes the mark away on uninit unless told not to.
 */
function markerScript({ withUninit = true, throws = false } = {}) {
  return `
    import { marker } from "./lib/marker.mjs";

    export function init(win) {
      ${throws ? 'throw new Error("This mod fails on purpose");' : ""}
      win.document.documentElement.setAttribute("zen-test-script", marker);
    }

    ${
      withUninit
        ? `export function uninit(win) {
            win.document.documentElement.removeAttribute("zen-test-script");
          }`
        : ""
    }
  `;
}

/**
 * Writes a mod into a temporary folder of its own.
 *
 * @param {object} [options]
 * @returns {Promise<string>} The folder
 */
async function makeLocalMod({
  manifest = {},
  script = markerScript(),
  marker = "m1",
} = {}) {
  const folder = await IOUtils.createUniqueDirectory(
    PathUtils.tempDir,
    "zen-local-mod"
  );

  await IOUtils.writeJSON(PathUtils.join(folder, "theme.json"), {
    name: "Local Mod",
    version: "1.0.0",
    author: "zen-tests",
    scripts: ["main.mjs"],
    ...manifest,
  });
  await IOUtils.writeUTF8(
    PathUtils.join(folder, "chrome.css"),
    ':root { --zen-test-local: "local" !important; }'
  );
  await IOUtils.writeUTF8(PathUtils.join(folder, "main.mjs"), script);
  await IOUtils.makeDirectory(PathUtils.join(folder, "lib"));
  await IOUtils.writeUTF8(
    PathUtils.join(folder, "lib", "marker.mjs"),
    `export const marker = "${marker}";`
  );

  registerCleanupFunction(() =>
    IOUtils.remove(folder, { recursive: true, ignoreAbsent: true })
  );

  return folder;
}

function marker(win = window) {
  return win.document.documentElement.getAttribute("zen-test-script");
}

function waitForMarker(expected, message, win = window) {
  return TestUtils.waitForCondition(() => marker(win) === expected, message);
}

add_task(async function test_scripts_stay_off_without_the_pref() {
  const folder = await makeLocalMod();
  const modId = await gZenModsManager.installLocalMod(folder, {
    scriptsApproved: true,
  });

  await waitForRootValue(
    window,
    "--zen-test-local",
    '"local"',
    "A local mod's styles apply"
  );
  is(marker(), null, "Its scripts don't run while scripts are off");
  is(gZenModsManager.getScriptsState(modId), "off", "The mod says so");

  await gZenModsManager.uninstallMod(modId);

  ok(await IOUtils.exists(folder), "Removing a local mod keeps its folder");
});

add_task(async function test_scripts_start_and_stop_in_every_window() {
  await SpecialPowers.pushPrefEnv({
    set: [
      [SCRIPTS_PREF, true],
      ["zen.window-sync.enabled", false],
    ],
  });

  const folder = await makeLocalMod();
  const modId = await gZenModsManager.installLocalMod(folder, {
    scriptsApproved: true,
  });

  await waitForMarker("m1", "The script runs in the open window");
  is(gZenModsManager.getScriptsState(modId), "running", "The mod says so");

  const otherWindow = await BrowserTestUtils.openNewBrowserWindow();

  await waitForMarker("m1", "The script runs in new windows", otherWindow);

  await gZenModsManager.setModEnabled(modId, false);

  is(marker(), null, "Turning the mod off undoes its script");
  is(marker(otherWindow), null, "Everywhere");

  await gZenModsManager.setModEnabled(modId, true);
  await waitForMarker("m1", "Turning it back on runs it again");

  await BrowserTestUtils.closeWindow(otherWindow);
  await gZenModsManager.uninstallMod(modId);

  is(marker(), null, "Removing the mod undoes its script");
});

add_task(async function test_reload_picks_up_edited_files() {
  await SpecialPowers.pushPrefEnv({ set: [[SCRIPTS_PREF, true]] });

  const folder = await makeLocalMod();
  const modId = await gZenModsManager.installLocalMod(folder, {
    scriptsApproved: true,
  });

  await waitForMarker("m1", "The first version runs");

  await IOUtils.writeUTF8(
    PathUtils.join(folder, "lib", "marker.mjs"),
    'export const marker = "m2";'
  );
  await gZenModsManager.reloadLocalMod(modId);

  await waitForMarker(
    "m2",
    "Reloading runs the edited file a script imports, not the cached one"
  );

  await gZenModsManager.uninstallMod(modId);
});

add_task(async function test_scripts_wait_for_approval() {
  await SpecialPowers.pushPrefEnv({ set: [[SCRIPTS_PREF, true]] });

  const folder = await makeLocalMod();
  const modId = await gZenModsManager.installLocalMod(folder);

  is(
    gZenModsManager.getScriptsState(modId),
    "needs-approval",
    "Scripts nobody allowed wait"
  );
  is(marker(), null, "And don't run");

  await gZenModsManager.approveScripts(modId);
  await waitForMarker("m1", "Allowing them runs them");

  await gZenModsManager.reloadLocalMod(modId);

  is(
    gZenModsManager.getScriptsState(modId),
    "running",
    "Reloading keeps them allowed"
  );

  await gZenModsManager.uninstallMod(modId);
});

add_task(async function test_failing_scripts_stay_contained() {
  await SpecialPowers.pushPrefEnv({ set: [[SCRIPTS_PREF, true]] });
  await useStore("store");
  await installFromStore(MOD_B);

  const folder = await makeLocalMod({
    script: markerScript({ throws: true }),
  });
  const modId = await gZenModsManager.installLocalMod(folder, {
    scriptsApproved: true,
  });

  await TestUtils.waitForCondition(
    () => gZenModsManager.getModError(modId)?.type === "script-failed",
    "The failing script is reported on its mod"
  );
  is(
    rootValue(window, "--zen-test-mod-b"),
    '"b"',
    "The other mods keep applying"
  );
  ok(gBrowser.selectedBrowser, "The window keeps working");

  await gZenModsManager.uninstallMod(modId);
  await gZenModsManager.uninstallMod(MOD_B);
});

add_task(async function test_scripts_without_uninit_need_a_restart() {
  await SpecialPowers.pushPrefEnv({ set: [[SCRIPTS_PREF, true]] });

  const folder = await makeLocalMod({
    script: markerScript({ withUninit: false }),
  });
  const modId = await gZenModsManager.installLocalMod(folder, {
    scriptsApproved: true,
  });

  await waitForMarker("m1", "The script runs");
  await gZenModsManager.setModEnabled(modId, false);

  await TestUtils.waitForCondition(
    () => gZenModsManager.getScriptsState(modId) === "needs-restart",
    "A script that can't be undone asks for a restart"
  );

  await gZenModsManager.uninstallMod(modId);
  window.document.documentElement.removeAttribute("zen-test-script");
});

add_task(async function test_store_mods_never_run_scripts() {
  await SpecialPowers.pushPrefEnv({ set: [[SCRIPTS_PREF, true]] });
  await useStore("store");

  const mod = await gZenModsManager.fetchStoreMod(MOD_B);

  mod.scripts = ["main.mjs"];
  await gZenModsManager.installMod(mod);

  is(
    gZenModsManager.getScriptsState(MOD_B),
    "none",
    "Scripts in a store entry are ignored"
  );
  await Assert.rejects(
    gZenModsManager.approveScripts(MOD_B),
    /not a local mod/,
    "And can't be allowed"
  );

  await gZenModsManager.uninstallMod(MOD_B);
});

add_task(async function test_invalid_local_mods_are_refused() {
  const cases = [
    [{ scripts: ["../outside.mjs"] }, /Invalid script path/],
    [{ scripts: ["/absolute.mjs"] }, /Invalid script path/],
    [{ scripts: ["main.js"] }, /Invalid script path/],
    [{ scripts: ["missing.mjs"] }, /is missing/],
    [{ name: "" }, /no valid "name"/],
  ];

  for (const [manifest, error] of cases) {
    const folder = await makeLocalMod({ manifest });

    await Assert.rejects(
      gZenModsManager.installLocalMod(folder),
      error,
      `${JSON.stringify(manifest)} is refused`
    );
  }
});

/**
 * Writes a mod in the format other mod managers use: `style` as an object
 * and `scripts` as a map, folders nested as keys.
 *
 * @returns {Promise<string>} The folder
 */
async function makeUserChromeMod() {
  const folder = await IOUtils.createUniqueDirectory(
    PathUtils.tempDir,
    "zen-uc-mod"
  );
  const files = {
    "userChrome.css": ':root { --zen-test-uc: "uc" !important; }',
    "late.uc.js":
      'window.zenTestOrder = [...(window.zenTestOrder ?? []), "late"];',
    "broken.uc.js": 'throw new Error("This script fails on purpose");',
    "elsewhere.uc.js": "window.zenTestElsewhere = true;",
    "background.sys.mjs":
      'Services.prefs.setBoolPref("zen.test.mods.background", true);',
    "js/early.uc.js":
      'window.zenTestOrder = [...(window.zenTestOrder ?? []), "early"];',
    "js/module.uc.mjs": `
      import { label } from "./helper.mjs";
      window.zenTestOrder = [...(window.zenTestOrder ?? []), label];
    `,
    "js/helper.mjs": 'export const label = "module";',
    "prefs/settings.json": JSON.stringify([
      {
        type: "string",
        property: "zen.test.mods.uc.text",
        label: "Text",
        defaultValue: "hi",
      },
    ]),
  };

  for (const [path, content] of Object.entries(files)) {
    const file = PathUtils.join(folder, ...path.split("/"));

    await IOUtils.makeDirectory(PathUtils.parent(file), {
      ignoreExisting: true,
    });
    await IOUtils.writeUTF8(file, content);
  }

  await IOUtils.writeJSON(PathUtils.join(folder, "theme.json"), {
    name: "userChrome Mod",
    version: "1.0.0",
    style: { chrome: "userChrome.css", content: "userContent.css" },
    preferences: "prefs/settings.json",
    scripts: {
      "late.uc.js": { loadOrder: 20 },
      "broken.uc.js": { loadOrder: 15 },
      "js/": {
        "early.uc.js": { loadOrder: 1 },
        "module.uc.mjs": {},
      },
      "background.sys.mjs": {},
      "elsewhere.uc.js": { include: ["chrome://nowhere/*"] },
      "../outside.uc.js": {},
      "readme.md": {},
    },
  });
  registerCleanupFunction(() => {
    Services.prefs.clearUserPref("zen.test.mods.background");
    return IOUtils.remove(folder, { recursive: true, ignoreAbsent: true });
  });

  return folder;
}

add_task(async function test_userchrome_scripts() {
  await SpecialPowers.pushPrefEnv({
    set: [
      [SCRIPTS_PREF, true],
      ["zen.window-sync.enabled", false],
    ],
  });

  const folder = await makeUserChromeMod();
  const modId = await gZenModsManager.installLocalMod(folder, {
    scriptsApproved: true,
  });
  const expectedOrder = ["early", "module", "late"];

  await waitForRootValue(
    window,
    "--zen-test-uc",
    '"uc"',
    "The style named by style.chrome applies"
  );
  is(
    Services.prefs.getStringPref("zen.test.mods.uc.text"),
    "hi",
    "The preferences file theme.json names is read"
  );
  await TestUtils.waitForCondition(
    () => window.zenTestOrder?.length === expectedOrder.length,
    "The scripts run in the open window"
  );
  Assert.deepEqual(
    window.zenTestOrder,
    expectedOrder,
    "Classic scripts and modules run in their load order, modules import"
  );
  ok(
    Services.prefs.getBoolPref("zen.test.mods.background", false),
    "A .sys.mjs runs once"
  );
  ok(!window.zenTestElsewhere, "A script for other documents doesn't run");
  is(
    gZenModsManager.getModError(modId)?.type,
    "script-failed",
    "A script that throws marks its mod, without stopping the rest"
  );

  const otherWindow = await BrowserTestUtils.openNewBrowserWindow();

  await TestUtils.waitForCondition(
    () => otherWindow.zenTestOrder?.length === expectedOrder.length,
    "The scripts run in new windows"
  );
  Assert.deepEqual(otherWindow.zenTestOrder, expectedOrder, "In order too");

  await BrowserTestUtils.closeWindow(otherWindow);
  await gZenModsManager.setModEnabled(modId, false);

  is(
    gZenModsManager.getScriptsState(modId),
    "needs-restart",
    "Scripts that ran in a document need a restart to go"
  );

  await gZenModsManager.uninstallMod(modId);
  delete window.zenTestOrder;
});
