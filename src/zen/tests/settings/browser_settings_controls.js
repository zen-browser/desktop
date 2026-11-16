/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_every_control_has_a_real_pref_and_label() {
  const win = await openSettingsWindow();
  const doc = win.document;
  await doc.l10n.translateElements([doc.documentElement]);

  for (const control of doc.querySelectorAll("[data-pref]")) {
    const pref = control.dataset.pref;
    isnot(
      Services.prefs.getPrefType(pref),
      Services.prefs.PREF_INVALID,
      `${pref} exists`
    );
    const row = control.closest(".zen-settings-row");
    const label = row.querySelector(".zen-settings-row-text");
    ok(label.textContent.trim(), `The row for ${pref} has a label`);
  }
  for (const toggle of doc.querySelectorAll("moz-toggle")) {
    const row = toggle.closest(".zen-settings-row");
    const text = row.querySelector(".zen-settings-row-text");
    const name = (text.firstElementChild ?? text).textContent.trim();
    is(toggle.ariaLabel, name, `The toggle for "${name}" is named after it`);
  }
  for (const list of doc.querySelectorAll("menulist[data-pref]")) {
    ok(
      list.selectedItem,
      `${list.dataset.pref} shows its value "${list.value}"`
    );
    ok(list.label, `${list.dataset.pref} has a visible label`);
  }

  await BrowserTestUtils.closeWindow(win);
});

add_task(async function test_toggles_follow_and_set_prefs() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.tabs.show-newtab-vertical", true],
      ["browser.startup.page", 1],
    ],
  });
  const win = await openSettingsWindow();

  const newTab = toggleFor(win, "zen.tabs.show-newtab-vertical");
  ok(newTab.pressed, "A boolean toggle shows its pref");
  await clickToggle(newTab);
  ok(
    !Services.prefs.getBoolPref("zen.tabs.show-newtab-vertical"),
    "Clicking a toggle writes the pref"
  );
  Services.prefs.setBoolPref("zen.tabs.show-newtab-vertical", true);
  ok(newTab.pressed, "A toggle follows changes made elsewhere");

  const newTabToggled = BrowserTestUtils.waitForEvent(newTab, "toggle");
  newTab
    .closest(".zen-settings-row")
    .querySelector(".zen-settings-row-text")
    .click();
  await newTabToggled;
  ok(
    !Services.prefs.getBoolPref("zen.tabs.show-newtab-vertical"),
    "Clicking the text of a row flips its toggle"
  );
  Services.prefs.setBoolPref("zen.tabs.show-newtab-vertical", true);

  const restore = toggleFor(win, "browser.startup.page");
  ok(!restore.pressed, "An integer toggle is off for its off value");
  await clickToggle(restore);
  is(
    Services.prefs.getIntPref("browser.startup.page"),
    3,
    "An integer toggle writes its on value"
  );
  await clickToggle(restore);
  is(
    Services.prefs.getIntPref("browser.startup.page"),
    1,
    "An integer toggle writes its off value"
  );

  await BrowserTestUtils.closeWindow(win);
  await SpecialPowers.popPrefEnv();
});

add_task(async function test_dependent_rows() {
  await SpecialPowers.pushPrefEnv({ set: [["zen.glance.enabled", true]] });
  const win = await openSettingsWindow();
  const row = win.document.querySelector(
    '[data-depends-on="zen.glance.enabled"]'
  );
  ok(!row.inert, "A dependent row is usable while its setting is on");
  Services.prefs.setBoolPref("zen.glance.enabled", false);
  ok(row.inert, "A dependent row is inert while its setting is off");
  await BrowserTestUtils.closeWindow(win);
  await SpecialPowers.popPrefEnv();
});

add_task(async function test_menulists() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.view.window.scheme", 2],
      ["zen.glance.activation-method", "alt"],
      ["zen.view.use-single-toolbar", true],
      ["zen.view.sidebar-expanded", true],
    ],
  });
  const win = await openSettingsWindow();
  const doc = win.document;

  const trigger = doc.querySelector(
    'menulist[data-pref="zen.glance.activation-method"]'
  );
  is(trigger.value, "alt", "A list shows its pref");
  Services.prefs.setStringPref("zen.glance.activation-method", "shift");
  is(trigger.value, "shift", "A list follows changes made elsewhere");
  trigger.value = "ctrl";
  trigger.dispatchEvent(new win.Event("command", { bubbles: true }));
  is(
    Services.prefs.getStringPref("zen.glance.activation-method"),
    "ctrl",
    "Choosing an item writes the pref"
  );

  Services.prefs.setIntPref("zen.view.window.scheme", 0);
  is(
    doc.documentElement.style.colorScheme,
    "dark",
    "The window follows the browser's forced color scheme"
  );

  const layout = doc.getElementById("zen-settings-layout");
  const layoutOption = name => layout.querySelector(`[data-layout="${name}"]`);
  is(
    layoutOption("single").getAttribute("aria-checked"),
    "true",
    "The layout picker reads both layout prefs"
  );
  layoutOption("collapsed").click();
  ok(
    !Services.prefs.getBoolPref("zen.view.sidebar-expanded"),
    "The collapsed layout collapses the sidebar"
  );
  ok(
    !Services.prefs.getBoolPref("zen.view.use-single-toolbar"),
    "The collapsed layout leaves the single toolbar"
  );
  Services.prefs.setBoolPref("zen.view.sidebar-expanded", true);
  is(
    layoutOption("multiple").getAttribute("aria-checked"),
    "true",
    "The layout picker follows the prefs"
  );
  is(
    layout.querySelectorAll('[aria-checked="true"]').length,
    1,
    "Only one layout is selected"
  );

  const engines = doc.getElementById("zen-settings-search-engine");
  const defaultEngine = await SearchService.getDefault();
  await TestUtils.waitForCondition(
    () => engines.itemCount > 0,
    "The search engines are listed"
  );
  is(engines.value, defaultEngine.id, "The default engine is selected");
  is(engines.label, defaultEngine.name, "The default engine is named");

  await BrowserTestUtils.closeWindow(win);
  await SpecialPowers.popPrefEnv();
});
