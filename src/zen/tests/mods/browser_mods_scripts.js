/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const SCRIPTS_PREF = "zen.mods.scripts.enabled";

registerCleanupFunction(() => {
  delete window.zenTestInits;
});

/**
 * A script that marks the window's root, through a helper it imports, and
 * takes the mark away on uninit unless told not to.
 */
function markerScript({ withUninit = true, throws = false } = {}) {
  return `
    import { marker } from "./lib/marker.mjs";

    export function init(win) {
      win.zenTestInits = (win.zenTestInits ?? 0) + 1;
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
  delete window.zenTestInits;

  const folder = await makeLocalMod({
    script: markerScript({ withUninit: false }),
  });
  const modId = await gZenModsManager.installLocalMod(folder, {
    scriptsApproved: true,
  });

  await waitForMarker("m1", "The script runs");
  is(window.zenTestInits, 1, "It started once");
  await gZenModsManager.setModEnabled(modId, false);

  await TestUtils.waitForCondition(
    () => gZenModsManager.getScriptsState(modId) === "needs-restart",
    "A script that can't be undone asks for a restart"
  );

  await gZenModsManager.setModEnabled(modId, true);

  is(
    window.zenTestInits,
    1,
    "Turning it back on doesn't start it again over what's still running"
  );
  is(
    gZenModsManager.getScriptsState(modId),
    "running",
    "And it reads as running again"
  );

  await gZenModsManager.uninstallMod(modId);
  window.document.documentElement.removeAttribute("zen-test-script");
});

add_task(async function test_store_mods_never_run_scripts() {
  await SpecialPowers.pushPrefEnv({ set: [[SCRIPTS_PREF, true]] });
  await useStore("store");

  const folder = await makeLocalMod();
  const mod = await gZenModsManager.fetchStoreMod(MOD_B);

  // A store entry that claims to be a local mod with its scripts allowed.
  Object.assign(mod, {
    scripts: ["main.mjs"],
    source: "local",
    path: folder,
    scriptsApproved: true,
  });
  await gZenModsManager.installMod(mod);

  const installed = (await gZenModsManager.getMods())[MOD_B];

  ok(
    !installed.source && !installed.path && !installed.scriptsApproved,
    "The registry takes none of the fields the manager owns from the store"
  );
  is(
    gZenModsManager.getScriptsState(MOD_B),
    "none",
    "Scripts in a store entry are ignored"
  );
  is(marker(), null, "Nothing runs");
  await Assert.rejects(
    gZenModsManager.approveScripts(MOD_B),
    /can.t run scripts/,
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
    "late.uc.js": `
      window.zenTestOrder = [...(window.zenTestOrder ?? []), "late"];
      window.zenTestUcApi = { top: zen.mod.id, ownWindow: zen.window === window };
      setTimeout(() => (window.zenTestUcApi.later = zen.mod.id));
    `,
    "broken.uc.js": 'throw new Error("This script fails on purpose");',
    "elsewhere.uc.js": "window.zenTestElsewhere = true;",
    "background.sys.mjs":
      'Services.prefs.setBoolPref("zen.test.mods.background", true);',
    "js/early.uc.js":
      'window.zenTestOrder = [...(window.zenTestOrder ?? []), "early"];',
    "js/module.uc.mjs": `
      import { label } from "./helper.mjs";
      window.zenTestOrder = [...(window.zenTestOrder ?? []), label];
      window.zenTestUcModuleApi = zen.mod.name;
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
  await TestUtils.waitForCondition(
    () => window.zenTestUcApi?.later,
    "A .uc.js reads zen in a callback"
  );
  Assert.deepEqual(
    window.zenTestUcApi,
    { top: modId, ownWindow: true, later: modId },
    "A .uc.js gets its mod's API for its window as the global zen"
  );
  is(window.zenTestUcModuleApi, "userChrome Mod", "So does a .uc.mjs");
  is(window.zen, undefined, "Code that isn't a mod's gets nothing");
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
  delete window.zenTestUcApi;
  delete window.zenTestUcModuleApi;
});

add_task(async function test_mod_api() {
  await SpecialPowers.pushPrefEnv({ set: [[SCRIPTS_PREF, true]] });

  const testPref = "zen.test.mods.api.pref";
  const originalSpace = gZenWorkspaces.getActiveWorkspace();
  const otherSpace =
    await gZenWorkspaces.createAndSaveWorkspace("Mod API Test");

  await gZenWorkspaces.changeWorkspace(originalSpace);
  registerCleanupFunction(() =>
    gZenWorkspaces.removeWorkspace(otherSpace.uuid)
  );

  const folder = await makeLocalMod({
    script: `
      export async function init(win, zen) {
        const state = (win.zenTestApi = { events: 0, shortcuts: 0 });

        state.version = zen.version;
        state.mod = zen.mod.name;
        const box = zen.add(win.document.createXULElement("box"));

        box.id = "zen-test-api-box";
        win.document.documentElement.append(box);
        zen.listen(win, "zen-test-api-event", () => state.events++);
        zen.observePref("${testPref}", name => (state.pref = name));
        zen.addStyle(':root { --zen-test-api: "styled"; }');
        zen.on("compact-mode", ({ enabled }) => (state.compact = enabled));
        zen.on("split-view", detail => (state.split = detail));
        zen.on("workspace-change", () => {
          throw new Error("A callback that fails on purpose");
        });
        zen.shortcut({
          id: "test",
          key: "j",
          modifiers: ["accel", "alt", "shift"],
          command: () => state.shortcuts++,
        });

        try {
          zen.shortcut({
            id: "taken",
            key: "t",
            modifiers: ["accel"],
            command() {},
          });
        } catch (error) {
          state.taken = error.message;
        }

        zen.onCleanup(() => (state.cleanedUp = true));

        await zen.ready;
        state.workspace = zen.workspace?.id;
      }

      export function uninit() {}
    `,
  });
  const modId = await gZenModsManager.installLocalMod(folder, {
    scriptsApproved: true,
  });

  await TestUtils.waitForCondition(
    () => window.zenTestApi?.workspace,
    "The mod's init gets the API and waits for the window to be ready"
  );

  const state = window.zenTestApi;

  is(state.version, 1, "It knows the API's version");
  is(state.mod, "Local Mod", "And which mod it is");
  is(
    state.workspace,
    gZenWorkspaces.activeWorkspace,
    "It reads the space in sight"
  );
  ok(document.getElementById("zen-test-api-box"), "It adds elements");
  await waitForRootValue(window, "--zen-test-api", '"styled"', "And styles");

  window.dispatchEvent(new CustomEvent("zen-test-api-event"));
  is(state.events, 1, "It listens to events");

  Services.prefs.setStringPref(testPref, "changed");
  is(state.pref, testPref, "And to preferences");

  window.dispatchEvent(
    new CustomEvent("ZenCompactMode:Toggled", { detail: true })
  );
  is(state.compact, true, "And to Zen, through stable events");

  window.dispatchEvent(new CustomEvent("ZenViewSplitter:SplitViewActivated"));
  Assert.deepEqual(
    state.split,
    { active: true },
    "Which carry only what they say"
  );

  gURLBar.focus();
  EventUtils.synthesizeKey("j", {
    accelKey: true,
    altKey: true,
    shiftKey: true,
  });
  is(state.shortcuts, 1, "Its shortcut runs its command");
  ok(
    state.taken?.includes("is taken"),
    "A shortcut Zen or Firefox already uses is refused"
  );

  await gZenWorkspaces.changeWorkspace(otherSpace);
  is(
    gZenWorkspaces.activeWorkspace,
    otherSpace.uuid,
    "A mod callback that throws doesn't stop a space switch"
  );
  is(
    gZenModsManager.getModError(modId)?.type,
    "script-failed",
    "It's reported on the mod"
  );
  await gZenWorkspaces.changeWorkspace(originalSpace);

  await gZenModsManager.setModEnabled(modId, false);

  ok(!document.getElementById("zen-test-api-box"), "Its elements go");
  is(rootValue(window, "--zen-test-api"), "", "Its styles go");
  window.dispatchEvent(new CustomEvent("zen-test-api-event"));
  is(state.events, 1, "Its listeners go");
  gURLBar.focus();
  EventUtils.synthesizeKey("j", {
    accelKey: true,
    altKey: true,
    shiftKey: true,
  });
  is(state.shortcuts, 1, "Its shortcut goes");
  ok(state.cleanedUp, "Its own cleanup runs");
  isnot(
    gZenModsManager.getScriptsState(modId),
    "needs-restart",
    "So turning it off needs no restart"
  );

  Services.prefs.clearUserPref(testPref);
  await gZenModsManager.uninstallMod(modId);
  delete window.zenTestApi;
});
