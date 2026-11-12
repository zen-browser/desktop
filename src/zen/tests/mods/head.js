/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { gZenModsManager } = ChromeUtils.importESModule(
  "resource:///modules/zen/mods/ZenModsManager.sys.mjs"
);

const MODS_ROOT = getRootDirectory(gTestPath).replace(
  "chrome://mochitests/content/",
  "https://example.com/"
);

const MOD_A = "zen-test-mod-a";
const MOD_B = "zen-test-mod-b";

/**
 * Points the mods store at one of the fake stores next to the tests.
 *
 * @param {string} name - The store folder
 */
async function useStore(name) {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.mods.store-url", `${MODS_ROOT}${name}/`],
      ["zen.mods.store-assets-url", MODS_ROOT],
    ],
  });
}

async function installFromStore(modId) {
  await gZenModsManager.installMod(await gZenModsManager.fetchStoreMod(modId));
}

function rootValue(win, property) {
  return win
    .getComputedStyle(win.document.documentElement)
    .getPropertyValue(property)
    .trim();
}

function waitForRootValue(win, property, expected, message) {
  return TestUtils.waitForCondition(
    () => rootValue(win, property) === expected,
    message
  );
}

add_setup(async function () {
  // The startup update check waits for an idle moment; let it run and finish
  // before the tests point the store at the fake ones.
  await new Promise(resolve =>
    ChromeUtils.idleDispatch(resolve, { timeout: 2000 })
  );
  await gZenModsManager.checkForUpdates();

  registerCleanupFunction(async () => {
    for (const modId of Object.keys(await gZenModsManager.getMods())) {
      await gZenModsManager.uninstallMod(modId);
    }
  });
});
