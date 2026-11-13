/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

async function openModsSettings() {
  const tab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "about:preferences#zenMarketplace"
  );
  const doc = tab.linkedBrowser.contentDocument;

  await TestUtils.waitForCondition(
    () => doc.querySelector("#zenMarketplaceHeader moz-toggle"),
    "The mods settings are ready"
  );

  return { tab, doc };
}

add_task(async function test_settings_only_keep_the_basics() {
  await SpecialPowers.pushPrefEnv({ set: [["zen.library.enabled", true]] });

  const { tab, doc } = await openModsSettings();
  const toggle = doc.querySelector("#zenMarketplaceHeader moz-toggle");

  ok(
    !doc.getElementById("zenThemeMarketplaceList"),
    "Installed mods are no longer listed in the settings"
  );
  ok(
    BrowserTestUtils.isVisible(doc.getElementById("zenModsManageInLibrary")),
    "The settings point to the Library"
  );

  toggle.click();
  await TestUtils.waitForCondition(
    () => Services.prefs.getBoolPref("zen.themes.disable-all", false),
    "The toggle turns every mod off"
  );
  toggle.click();
  await TestUtils.waitForCondition(
    () => !Services.prefs.getBoolPref("zen.themes.disable-all", false),
    "And back on"
  );

  const Library = customElements.get("zen-library");

  doc.getElementById("zenModsManageInLibrary").click();
  await TestUtils.waitForCondition(
    () =>
      Library.isLibraryOpen &&
      document.querySelector("zen-library").activeTab === "mods",
    "The button opens the Library on the mods"
  );

  Library.toggle();
  await TestUtils.waitForCondition(
    () => !Library.isLibraryOpen && Library.libraryProgress === 0,
    "The library closes"
  );
  BrowserTestUtils.removeTab(tab);
});

add_task(async function test_without_the_library_there_is_no_button() {
  await SpecialPowers.pushPrefEnv({ set: [["zen.library.enabled", false]] });

  const { tab, doc } = await openModsSettings();

  ok(
    !BrowserTestUtils.isVisible(doc.getElementById("zenModsManageInLibrary")),
    "Without the Library there is nowhere to send the user"
  );
  ok(
    doc.querySelector("#zenMarketplaceHeader moz-toggle"),
    "Turning every mod off still works"
  );

  BrowserTestUtils.removeTab(tab);
});
