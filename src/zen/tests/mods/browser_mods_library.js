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

  // Filters stay between visits; leave the section as it was.
  section.querySelector(".zen-library-filter-button").click();
  await section.updateComplete;
  section
    .querySelector('[data-l10n-id="library-mods-filter-error"]')
    .closest(".zen-library-filter-chip")
    .click();
  section.querySelector(".zen-library-filter-done").click();
  await waitForRows(section, [MOD_A, MOD_B], "Without the filter both show");

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
  registerCleanupFunction(() =>
    IOUtils.remove(file.path, { ignoreAbsent: true })
  );

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

  MockFilePicker.cleanup();
  await gZenModsManager.uninstallMod(MOD_A);
  await gZenModsManager.uninstallMod(MOD_B);
});

add_task(async function test_adding_a_folder_with_scripts_asks_first() {
  const folder = await IOUtils.createUniqueDirectory(
    PathUtils.tempDir,
    "zen-folder-mod"
  );

  await IOUtils.writeJSON(PathUtils.join(folder, "theme.json"), {
    name: "Folder Mod",
    version: "1.0.0",
    scripts: ["main.mjs"],
  });
  await IOUtils.writeUTF8(
    PathUtils.join(folder, "main.mjs"),
    "export function init() {}"
  );
  registerCleanupFunction(() =>
    IOUtils.remove(folder, { recursive: true, ignoreAbsent: true })
  );

  const directory = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
  const { MockFilePicker } = SpecialPowers;

  directory.initWithPath(folder);
  MockFilePicker.init(window.browsingContext);
  MockFilePicker.setFiles([directory]);
  MockFilePicker.returnValue = MockFilePicker.returnOK;

  const addFromFolder = customElements
    .get("zen-library-mods-section")
    .tabMenu.find(
      item => item.l10nId === "library-mods-install-folder"
    ).command;
  const installed = async () =>
    Object.values(await gZenModsManager.getMods()).find(
      mod => mod.path === folder
    );

  let answered = handleNextConfirm(1);

  await Promise.all([addFromFolder(), answered]);

  ok(!(await installed()), "Declining the scripts adds nothing");

  answered = handleNextConfirm(0);
  await Promise.all([addFromFolder(), answered]);

  const mod = await installed();

  ok(mod?.scriptsApproved, "Accepting adds the mod with its scripts allowed");

  const section = await openModsSection();

  await waitForRows(section, [mod.id], "The local mod is listed");

  const row = rowFor(section, mod.id);

  ok(
    row.querySelector('[data-l10n-id="library-mods-badge-local"]'),
    "It's marked as local"
  );
  is(
    row.querySelector("[scripts]")?.getAttribute("scripts"),
    "off",
    "Its scripts show as off while scripts are off"
  );

  MockFilePicker.cleanup();
  await closeLibrary();
  await gZenModsManager.uninstallMod(mod.id);
});

add_task(async function test_preferences_v2() {
  const prefix = "zen.test.mods.v2";
  const mode = `${prefix}.mode`;
  const folder = await IOUtils.createUniqueDirectory(
    PathUtils.tempDir,
    "zen-prefs-mod"
  );

  await IOUtils.writeJSON(PathUtils.join(folder, "theme.json"), {
    name: "Preferences Mod",
    version: "1.0.0",
  });
  await IOUtils.writeUTF8(PathUtils.join(folder, "chrome.css"), "");
  await IOUtils.writeJSON(PathUtils.join(folder, "preferences.json"), [
    { type: "separator", label: "**Look**" },
    { type: "text", label: "Pick *how* it ~looks~, \\*really\\*" },
    {
      type: "color",
      property: `${prefix}.accent`,
      label: "Accent",
      defaultValue: "#ff0000",
    },
    {
      type: "number",
      property: `${prefix}.radius`,
      label: "Radius",
      defaultValue: 4,
    },
    {
      type: "separator",
      property: `${prefix}.extras`,
      label: "Extras",
      defaultValue: false,
    },
    {
      type: "string",
      property: `${prefix}.extra-text`,
      label: "Extra text",
      operator: "AND",
      conditions: [
        { if: { property: `${prefix}.extras`, value: true } },
        {
          conditions: [
            { if: { property: mode, value: "wide" } },
            { if: { property: mode, value: "narrow" } },
          ],
        },
      ],
    },
    {
      type: "checkbox",
      property: `${prefix}.not-narrow`,
      label: "Not narrow",
      conditions: [{ not: { property: mode, value: "narrow" } }],
    },
    {
      type: "checkbox",
      property: `${prefix}.heavy`,
      label: "Heavy",
      restart: true,
    },
  ]);
  registerCleanupFunction(() => {
    Services.prefs.clearUserPref(mode);
    return IOUtils.remove(folder, { recursive: true, ignoreAbsent: true });
  });

  const modId = await gZenModsManager.installLocalMod(folder);

  is(
    Services.prefs.getBoolPref(`${prefix}.extras`),
    false,
    "A separator with a property is a toggle, off by default"
  );
  await waitForRootValue(
    window,
    "--zen-test-mods-v2-accent",
    "#ff0000",
    "A color applies as a custom property"
  );
  is(rootValue(window, "--zen-test-mods-v2-radius"), "4", "So does a number");

  const section = await openModsSection();

  await waitForRows(section, [modId], "The mod is listed");
  rowFor(section, modId).click();
  await section.updateComplete;

  const panel = section.querySelector(".zen-library-mod-preferences");

  await TestUtils.waitForCondition(
    () => window.getComputedStyle(panel).opacity === "1",
    "The panel finished fading in"
  );

  const slots = [...panel.querySelectorAll(".zen-library-mod-preference-slot")];
  const slotFor = label =>
    slots.find(slot => slot.textContent.trim().startsWith(label));
  const isShown = label => !slotFor(label).hasAttribute("collapsed");
  const settle = async () => {
    section.requestUpdate();
    await section.updateComplete;
  };
  const flip = async label => {
    const toggle = slotFor(label).querySelector("moz-toggle");
    const toggled = BrowserTestUtils.waitForEvent(toggle, "toggle");

    toggle.click();
    await toggled;
    await section.updateComplete;
  };

  ok(slotFor("Look"), "Formatting markers are taken out of labels");
  ok(
    slotFor("Pick how it looks, *really*"),
    "And escaped ones stay as they are"
  );
  ok(isShown("Not narrow"), "A not condition holds on a preference never set");
  ok(!isShown("Extra text"), "AND needs every condition");

  await flip("Extras");

  ok(
    Services.prefs.getBoolPref(`${prefix}.extras`),
    "The separator's toggle changes its preference"
  );
  ok(!isShown("Extra text"), "Still hidden while the nested group fails");

  Services.prefs.setStringPref(mode, "narrow");
  await settle();

  ok(isShown("Extra text"), "Any condition of a nested group is enough");
  ok(!isShown("Not narrow"), "A not condition hides on its value");
  ok(
    slotFor("Not narrow").inert,
    "A hidden preference can't be reached with the keyboard"
  );

  Services.prefs.setStringPref(mode, "wide");
  await settle();

  ok(isShown("Extra text"), "The other value of the group holds too");
  ok(isShown("Not narrow"), "And the not condition holds again");

  const color = slotFor("Accent").querySelector("input");
  const number = slotFor("Radius").querySelector("input");

  color.value = "#00ff00";
  color.dispatchEvent(new Event("input", { bubbles: true }));
  number.value = "12";
  number.dispatchEvent(new Event("input", { bubbles: true }));

  await waitForRootValue(
    window,
    "--zen-test-mods-v2-accent",
    "#00ff00",
    "Picking a color applies it"
  );
  await waitForRootValue(
    window,
    "--zen-test-mods-v2-radius",
    "12",
    "Typing a number applies it"
  );

  const restart = panel.querySelector(".zen-library-mod-restart");

  ok(restart.hasAttribute("collapsed"), "Nothing asks for a restart yet");

  await flip("Heavy");

  ok(
    !restart.hasAttribute("collapsed"),
    "Changing a preference that needs a restart asks for one"
  );
  ok(
    restart.querySelector("moz-message-bar moz-button"),
    "With a button to restart"
  );

  await closeLibrary();
  await gZenModsManager.uninstallMod(modId);

  ok(
    !Services.prefs.prefHasUserValue(`${prefix}.accent`),
    "Removing the mod clears its preferences"
  );
});

add_task(async function test_local_mods_reload_on_save() {
  const folder = await IOUtils.createUniqueDirectory(
    PathUtils.tempDir,
    "zen-live-mod"
  );
  const stylePath = PathUtils.join(folder, "chrome.css");
  const writeStyle = value =>
    IOUtils.writeUTF8(
      stylePath,
      `:root { --zen-test-live: "${value}" !important; }`
    );

  await IOUtils.writeJSON(PathUtils.join(folder, "theme.json"), {
    name: "Live Mod",
    version: "1.0.0",
  });
  await writeStyle("v1");
  registerCleanupFunction(() =>
    IOUtils.remove(folder, { recursive: true, ignoreAbsent: true })
  );

  const modId = await gZenModsManager.installLocalMod(folder);

  await waitForRootValue(window, "--zen-test-live", '"v1"', "The mod applies");

  const section = await openModsSection();

  await waitForRows(section, [modId], "The mod is listed");
  await writeStyle("v2");
  await waitForRootValue(
    window,
    "--zen-test-live",
    '"v2"',
    "Saving the mod while the Library shows it reloads it"
  );

  await closeLibrary();
  await writeStyle("v3");

  // Long enough for a few checks, if anything still checked.
  // eslint-disable-next-line mozilla/no-arbitrary-setTimeout
  await new Promise(resolve => setTimeout(resolve, 2500));

  is(
    rootValue(window, "--zen-test-live"),
    '"v2"',
    "Nothing watches the folder once the Library is closed"
  );

  await gZenModsManager.uninstallMod(modId);
});

add_task(async function test_install_from_github() {
  const setHead = sha => fetch(`${MODS_ROOT}github_api.sjs?head=${sha}`);
  const answerTextPrompt = async value => {
    const [prompt] = await TestUtils.topicObserved("common-dialog-loaded");

    is(prompt.Dialog.args.promptType, "prompt", "The repository is asked for");

    await PromptTestUtils.handlePrompt(prompt.Dialog, {
      loginInput: value,
      buttonNumClick: 0,
    });
  };
  const installFromGitHub = customElements
    .get("zen-library-mods-section")
    .tabMenu.find(
      item => item.l10nId === "library-mods-install-github"
    ).command;
  const installed = async () =>
    Object.values(await gZenModsManager.getMods()).find(
      mod => mod.repo === "zen-tests/sample"
    );

  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.mods.github.api-url", `${MODS_ROOT}github_api.sjs?`],
      ["zen.mods.github.raw-url", `${MODS_ROOT}github/`],
    ],
  });
  await setHead("a".repeat(40));
  registerCleanupFunction(() => setHead("a".repeat(40)));

  let answered = (async () => {
    await answerTextPrompt("zen-tests/sample");
    await handleNextConfirm(1);
  })();

  await Promise.all([installFromGitHub(), answered]);
  ok(!(await installed()), "Declining installs nothing");

  answered = (async () => {
    await answerTextPrompt("https://github.com/zen-tests/sample");
    await handleNextConfirm(0);
  })();
  await Promise.all([installFromGitHub(), answered]);

  let mod = await installed();

  ok(mod, "Accepting installs the mod");
  is(
    mod.approvedScriptsHash,
    mod.scriptsHash,
    "The prompt said it has scripts, so they're allowed"
  );

  const section = await openModsSection();

  await waitForRows(section, [mod.id], "The mod is listed");
  ok(
    rowFor(section, mod.id).querySelector(
      '[data-l10n-id="library-mods-badge-github"]'
    ),
    "It's marked as unverified"
  );

  await setHead("c".repeat(40));
  await gZenModsManager.checkForUpdates();
  await TestUtils.waitForCondition(
    () => rowFor(section, mod.id)?.querySelector("[update]"),
    "An update that changes the scripts shows it waits"
  );

  const menu = await openRowMenu(rowFor(section, mod.id));

  answered = handleNextConfirm(0);
  await chooseFromMenu(menu, "review-update");
  await answered;
  await TestUtils.waitForCondition(
    async () => (await installed()).sha === "c".repeat(40),
    "Reviewing the update installs it"
  );
  await TestUtils.waitForCondition(
    () => !rowFor(section, mod.id)?.querySelector("[update]"),
    "And nothing waits anymore"
  );

  mod = await installed();
  await closeLibrary();
  await gZenModsManager.uninstallMod(mod.id);
});

add_task(async function test_browse_the_store() {
  await useStore("store");

  const section = await openModsSection();
  const storeRow = modId => section.querySelector(`[data-store-id="${modId}"]`);
  const storeRows = () =>
    [...section.querySelectorAll("[data-store-id]")].map(
      row => row.dataset.storeId
    );

  section.querySelector('.zen-library-mods-views [data-view="store"]').click();
  await TestUtils.waitForCondition(
    () => storeRows().length === 3,
    "The store's mods are listed"
  );
  Assert.deepEqual(
    storeRows(),
    [MOD_A, MOD_B, "zen-test-mod-broken"],
    "The most recently updated first"
  );
  ok(
    storeRow(MOD_A).querySelector("img.zen-library-store-thumbnail"),
    "A picture from the store shows"
  );
  ok(
    !storeRow(MOD_B).querySelector("img"),
    "One from anywhere else isn't loaded"
  );

  await search(section, "dark");
  await TestUtils.waitForCondition(
    () => storeRows().join() === MOD_A,
    "Searching filters the store, tags included"
  );
  await search(section, "");
  await TestUtils.waitForCondition(
    () => storeRows().length === 3,
    "Clearing the search shows them all"
  );

  storeRow(MOD_A)
    .querySelector('[data-l10n-id="library-mods-store-install"]')
    .click();
  await TestUtils.waitForCondition(
    () =>
      storeRow(MOD_A)?.querySelector(
        '[data-l10n-id="library-mods-store-installed"]'
      ),
    "Installing from the list marks the mod as installed"
  );
  ok(await gZenModsManager.isModInstalled(MOD_A), "And installs it");
  ok(!section.hasAttribute("configuring"), "Without opening its details");

  storeRow(MOD_B).click();
  await section.updateComplete;

  const detail = section.querySelector(".zen-library-store-detail");

  await TestUtils.waitForCondition(
    () => window.getComputedStyle(detail).opacity === "1",
    "The details fade in"
  );
  ok(section.hasAttribute("configuring"), "They take the list's place");

  detail.querySelector('[data-l10n-id="library-mods-store-install"]').click();
  await TestUtils.waitForCondition(
    () => detail.querySelector('[data-l10n-id="library-mods-store-remove"]'),
    "Installing from the details offers to remove it"
  );
  ok(await gZenModsManager.isModInstalled(MOD_B), "The mod is installed");

  const answered = handleNextConfirm(0);

  detail.querySelector('[data-l10n-id="library-mods-store-remove"]').click();
  await answered;
  await TestUtils.waitForCondition(
    async () => !(await gZenModsManager.isModInstalled(MOD_B)),
    "Removing from the details removes it"
  );

  section.querySelector(".zen-library-filter-done").click();
  section
    .querySelector('.zen-library-mods-views [data-view="installed"]')
    .click();
  await waitForRows(section, [MOD_A], "The installed view lists what's in");

  await closeLibrary();
  await gZenModsManager.uninstallMod(MOD_A);
});
