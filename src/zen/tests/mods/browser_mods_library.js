/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const Library = customElements.get("zen-library");

async function closeLibrary() {
  if (!Library.isLibraryOpen) {
    return;
  }

  Library.toggle();
  await TestUtils.waitForCondition(
    () => !Library.isLibraryOpen && Library.libraryProgress === 0,
    "The library settles closed"
  );
}

async function openModsSection() {
  await closeLibrary();
  Library.toggle("mods");

  const library = document.querySelector("zen-library");

  await TestUtils.waitForCondition(
    () =>
      Library.libraryProgress === 1 && !library.hasAttribute("transitioning"),
    "The library settles open"
  );

  const section = document.querySelector("zen-library-mods-section");

  await section.updateComplete;

  return section;
}

function rows(section) {
  return [...section.querySelectorAll(".zen-library-mod-row")];
}

function rowFor(section, modId) {
  return section.querySelector(`.zen-library-mod-row[data-mod-id="${modId}"]`);
}

async function waitForRows(section, modIds, message) {
  await TestUtils.waitForCondition(
    () =>
      rows(section)
        .map(row => row.dataset.modId)
        .join() === modIds.join(),
    message
  );
}

async function openRowMenu(row) {
  const shown = BrowserTestUtils.waitForEvent(
    document.getElementById("mainPopupSet"),
    "popupshown",
    true
  );

  row.dispatchEvent(
    new MouseEvent("contextmenu", { bubbles: true, cancelable: true })
  );

  return (await shown).target;
}

async function chooseFromMenu(menu, action) {
  const hidden = BrowserTestUtils.waitForEvent(menu, "popuphidden");

  menu.activateItem(menu.querySelector(`[data-action="${action}"]`));
  await hidden;
}

async function search(section, query) {
  const input = section.querySelector(".zen-library-search-box input");

  input.value = query;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await TestUtils.waitForCondition(
    () => section.searchQuery === query.trim(),
    "The search went through"
  );
  await section.updateComplete;
}

add_setup(async function () {
  await SpecialPowers.pushPrefEnv({ set: [["zen.library.enabled", true]] });
  registerCleanupFunction(closeLibrary);
});

add_task(async function test_lists_and_toggles_mods() {
  await useStore("store");
  await installFromStore(MOD_A);
  await installFromStore(MOD_B);

  const section = await openModsSection();

  await waitForRows(section, [MOD_A, MOD_B], "Mods are listed in load order");

  // The toggle shows up while the row is hovered.
  EventUtils.synthesizeMouseAtCenter(rowFor(section, MOD_B), {
    type: "mousemove",
  });
  await TestUtils.waitForCondition(
    () =>
      BrowserTestUtils.isVisible(
        rowFor(section, MOD_B).querySelector("moz-toggle")
      ),
    "Hovering the row shows its toggle"
  );
  rowFor(section, MOD_B).querySelector("moz-toggle").click();

  await TestUtils.waitForCondition(
    async () => (await gZenModsManager.getMods())[MOD_B].enabled === false,
    "The toggle turns the mod off"
  );
  await TestUtils.waitForCondition(
    () => rowFor(section, MOD_B)?.hasAttribute("disabled"),
    "The row shows it's off"
  );
  is(rootValue(window, "--zen-test-mod-b"), "", "The mod no longer applies");

  await closeLibrary();
  await gZenModsManager.uninstallMod(MOD_A);
  await gZenModsManager.uninstallMod(MOD_B);
});

add_task(async function test_keyboard_reorders_mods() {
  await useStore("store");
  await installFromStore(MOD_A);
  await installFromStore(MOD_B);

  const section = await openModsSection();

  await waitForRows(section, [MOD_A, MOD_B], "Mods are listed in load order");
  is(rootValue(window, "--zen-test-shared"), '"b"', "The last mod wins");

  rowFor(section, MOD_B).focus();
  EventUtils.synthesizeKey("KEY_ArrowUp", { ctrlKey: true, shiftKey: true });

  await waitForRows(section, [MOD_B, MOD_A], "The mod moves up");
  await TestUtils.waitForCondition(
    () => rootValue(window, "--zen-test-shared") === '"a"',
    "The mod that is now last wins"
  );
  Assert.deepEqual(
    (await gZenModsManager.getOrderedMods()).map(mod => mod.id),
    [MOD_B, MOD_A],
    "The new order is saved"
  );

  await closeLibrary();
  await gZenModsManager.uninstallMod(MOD_A);
  await gZenModsManager.uninstallMod(MOD_B);
});

add_task(async function test_removing_asks_first() {
  await useStore("store");
  await installFromStore(MOD_B);

  const section = await openModsSection();

  await waitForRows(section, [MOD_B], "The mod is listed");

  let answered = handleNextConfirm(1);

  await chooseFromMenu(await openRowMenu(rowFor(section, MOD_B)), "remove");
  await answered;

  ok(await gZenModsManager.isModInstalled(MOD_B), "Cancelling keeps the mod");

  answered = handleNextConfirm(0);
  await chooseFromMenu(await openRowMenu(rowFor(section, MOD_B)), "remove");
  await answered;

  await waitForRows(section, [], "Removing takes it out of the list");
  ok(!(await gZenModsManager.isModInstalled(MOD_B)), "The mod is removed");
  ok(
    section.querySelector(".zen-library-mods-empty"),
    "With no mods left, the section points to the store"
  );

  await closeLibrary();
});

add_task(async function test_preferences_apply_right_away() {
  await useStore("store");
  await installFromStore(MOD_A);

  const section = await openModsSection();

  await waitForRows(section, [MOD_A], "The mod is listed");
  rowFor(section, MOD_A).click();
  await section.updateComplete;

  const panel = section.querySelector(".zen-library-mod-preferences");

  await TestUtils.waitForCondition(
    () => window.getComputedStyle(panel).opacity === "1",
    "The panel finished fading in"
  );
  ok(section.hasAttribute("configuring"), "Clicking a mod opens its panel");
  is(
    panel.querySelectorAll(".zen-library-mod-preference").length,
    3,
    "Every preference of the mod is there"
  );

  const input = panel.querySelector("input");

  input.value = "purple";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  panel.querySelector("moz-toggle").click();

  const shown = BrowserTestUtils.waitForEvent(
    document.getElementById("mainPopupSet"),
    "popupshown",
    true
  );

  panel.querySelector(".zen-library-routing-select").click();

  const picker = (await shown).target;
  const hidden = BrowserTestUtils.waitForEvent(picker, "popuphidden");

  picker.activateItem(picker.querySelector('[data-value="wide"]'));
  await hidden;

  section.querySelector(".zen-library-filter-done").click();
  await section.updateComplete;

  ok(
    !Services.prefs.getBoolPref("zen.test.mods.a.checkbox"),
    "The checkbox preference changed"
  );
  is(
    Services.prefs.getStringPref("zen.test.mods.a.mode"),
    "wide",
    "The dropdown preference changed"
  );
  await waitForRootValue(
    window,
    "--zen-test-mods-a-color",
    "purple",
    "Closing the panel saves the text the user typed, and it applies"
  );
  is(
    document
      .getElementById("theme-Test-Mod-A")
      .getAttribute("zen-test-mods-a-mode"),
    "wide",
    "The dropdown applies"
  );

  await closeLibrary();
  await gZenModsManager.uninstallMod(MOD_A);
});

add_task(async function test_search_and_problem_filter() {
  await useStore("store");
  await installFromStore(MOD_A);
  await installFromStore(MOD_B);

  const section = await openModsSection();

  await waitForRows(section, [MOD_A, MOD_B], "Both mods are listed");
  await search(section, "mode");
  await waitForRows(
    section,
    [MOD_A],
    "Searching finds a mod by its preferences"
  );
  await search(section, "");

  await IOUtils.remove(
    PathUtils.join(gZenModsManager.getModFolder(MOD_A), "chrome.css")
  );
  await gZenModsManager.setModEnabled(MOD_B, true);
  await TestUtils.waitForCondition(
    () => rowFor(section, MOD_A)?.hasAttribute("has-error"),
    "A mod with missing files shows it"
  );

  section.querySelector(".zen-library-filter-button").click();
  await section.updateComplete;
  section
    .querySelector('[data-l10n-id="library-mods-filter-error"]')
    .closest(".zen-library-filter-chip")
    .click();
  await waitForRows(section, [MOD_A], "The problem filter shows only it");
  section.querySelector(".zen-library-filter-done").click();

  await chooseFromMenu(await openRowMenu(rowFor(section, MOD_A)), "reinstall");
  await TestUtils.waitForCondition(
    () => !rowFor(section, MOD_A)?.hasAttribute("has-error"),
    "Reinstalling fixes it"
  );
  is(rootValue(window, "--zen-test-mod-a"), '"v1"', "The mod applies again");

  await closeLibrary();
  await gZenModsManager.uninstallMod(MOD_A);
  await gZenModsManager.uninstallMod(MOD_B);
});

add_task(async function test_import_lists_mods_before_installing() {
  await useStore("store");

  const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);

  file.initWithPath(
    PathUtils.join(PathUtils.tempDir, "zen-mods-import-test.json")
  );

  await IOUtils.writeJSON(file.path, {
    [MOD_A]: { id: MOD_A },
    [MOD_B]: { id: MOD_B, enabled: false },
    "not-in-the-store": { id: "not-in-the-store" },
  });

  const { MockFilePicker } = SpecialPowers;

  MockFilePicker.init(window.browsingContext);
  MockFilePicker.setFiles([file]);
  MockFilePicker.returnValue = MockFilePicker.returnOK;
  registerCleanupFunction(async () => {
    MockFilePicker.cleanup();
    await IOUtils.remove(file.path, { ignoreAbsent: true });
  });

  const importMods = customElements
    .get("zen-library-mods-section")
    .tabMenu.find(item => item.l10nId === "library-mods-import").command;

  let answered = handleNextConfirm(1);

  await Promise.all([importMods(), answered]);

  ok(
    !(await gZenModsManager.isModInstalled(MOD_A)),
    "Cancelling the list installs nothing"
  );

  answered = handleNextConfirm(0);
  await Promise.all([importMods(), answered]);

  const mods = await gZenModsManager.getMods();

  ok(mods[MOD_A] && mods[MOD_B], "Accepting installs the listed store mods");
  is(mods[MOD_B].enabled, false, "A mod exported turned off stays off");
  ok(!mods["not-in-the-store"], "Ids the store doesn't know are skipped");

  await gZenModsManager.uninstallMod(MOD_A);
  await gZenModsManager.uninstallMod(MOD_B);
});
