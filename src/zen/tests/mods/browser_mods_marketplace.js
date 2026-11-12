/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const ACTOR = "ZenModsMarketplace";
const STORE_PAGE = `${MODS_ROOT}store_page.html`;

/**
 * Registers the marketplace actor the way ZenActorsManager does, matching
 * the given pages instead of the store's.
 *
 * @param {string[]} matches
 */
function registerMarketplace(matches) {
  ChromeUtils.unregisterWindowActor(ACTOR);
  ChromeUtils.registerWindowActor(ACTOR, {
    parent: {
      esModuleURI: "resource:///actors/ZenModsMarketplaceParent.sys.mjs",
    },
    child: {
      esModuleURI: "resource:///actors/ZenModsMarketplaceChild.sys.mjs",
      events: { DOMContentLoaded: {} },
    },
    safeForUntrustedWebProcess: true,
    matches,
  });
}

async function openStorePage() {
  const tab = await BrowserTestUtils.openNewForegroundTab(gBrowser, STORE_PAGE);

  await SpecialPowers.spawn(tab.linkedBrowser, [], () =>
    ContentTaskUtils.waitForCondition(
      () =>
        !content.document
          .getElementById("install-theme")
          .classList.contains("hidden"),
      "The marketplace actor set up the install button"
    )
  );

  return tab;
}

add_setup(async function () {
  registerMarketplace([`${MODS_ROOT}*`]);

  registerCleanupFunction(() =>
    registerMarketplace(
      Services.prefs.getStringPref("zen.injections.match-urls").split(",")
    )
  );
});

add_task(async function test_pages_cannot_install_without_a_gesture() {
  await useStore("store");

  const tab = await openStorePage();

  await SpecialPowers.spawn(tab.linkedBrowser, [], () => {
    content.wrappedJSObject.ZenInstallMod({ modId: "zen-test-mod-b" });
  });
  // A round trip to the page, so a request it sent would have reached us.
  await SpecialPowers.spawn(tab.linkedBrowser, [], () => {});

  ok(
    !(await gZenModsManager.isModInstalled(MOD_B)),
    "A script can't install a mod on its own"
  );

  BrowserTestUtils.removeTab(tab);
});

add_task(async function test_installing_from_a_page_asks_first() {
  await useStore("store");

  const tab = await openStorePage();
  const declined = handleNextConfirm(1);

  await BrowserTestUtils.synthesizeMouseAtCenter(
    "#install-theme",
    {},
    tab.linkedBrowser
  );
  await declined;
  await SpecialPowers.spawn(tab.linkedBrowser, [], () =>
    ContentTaskUtils.waitForCondition(
      () => !content.document.getElementById("install-theme").disabled,
      "The page can try again after the user declined"
    )
  );

  ok(
    !(await gZenModsManager.isModInstalled(MOD_B)),
    "Declining the prompt installs nothing"
  );

  const accepted = handleNextConfirm(0);

  await BrowserTestUtils.synthesizeMouseAtCenter(
    "#install-theme",
    {},
    tab.linkedBrowser
  );
  await accepted;
  await TestUtils.waitForCondition(
    () => gZenModsManager.isModInstalled(MOD_B),
    "Accepting the prompt installs the mod"
  );
  await waitForRootValue(
    window,
    "--zen-test-mod-b",
    '"b"',
    "The mod installed from the page applies"
  );

  BrowserTestUtils.removeTab(tab);
  await gZenModsManager.uninstallMod(MOD_B);
});
