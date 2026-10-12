/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const PAGE_URL = "http://mochi.test:8888/";

function labelContainer(tab) {
  return tab.querySelector(".tab-label-container");
}

function renameInput() {
  return document.getElementById("tab-label-input");
}

function startRenaming(tab) {
  gZenTabRenamer.start({ target: labelContainer(tab), type: "dblclick" });
  const input = renameInput();
  ok(input, "The rename input is shown");
  ok(
    document.documentElement.hasAttribute("zen-renaming-tab"),
    "The window is marked as renaming"
  );
  is(document.activeElement, input, "The input is focused");
  return input;
}

function waitForRenameEnd(tab) {
  return TestUtils.waitForCondition(
    () =>
      !renameInput() &&
      !document.documentElement.hasAttribute("zen-renaming-tab") &&
      !tab.querySelector(".tab-editor-container") &&
      !tab.querySelector(".tab-label-container-editing"),
    "Renaming UI is torn down"
  );
}

add_task(async function test_rename_with_enter() {
  const tab = await BrowserTestUtils.openNewForegroundTab(gBrowser, PAGE_URL);
  const originalLabel = tab.label;

  const input = startRenaming(tab);
  is(input.value, originalLabel, "The input starts with the current label");
  input.value = "Renamed tab";
  EventUtils.synthesizeKey("KEY_Enter");
  await waitForRenameEnd(tab);

  is(tab.zenStaticLabel, "Renamed tab", "The static label is stored");
  is(tab.label, "Renamed tab", "The tab shows the new label");

  // An empty name removes the static label and restores the page title.
  startRenaming(tab).value = "   ";
  EventUtils.synthesizeKey("KEY_Enter");
  await waitForRenameEnd(tab);
  ok(!("zenStaticLabel" in tab), "The static label is cleared");
  is(tab.label, originalLabel, "The page title is back");

  BrowserTestUtils.removeTab(tab);
});

add_task(async function test_escape_cancels() {
  const tab = await BrowserTestUtils.openNewForegroundTab(gBrowser, PAGE_URL);
  const originalLabel = tab.label;

  const input = startRenaming(tab);
  input.value = "Not applied";
  EventUtils.synthesizeKey("KEY_Escape");
  await waitForRenameEnd(tab);

  ok(!("zenStaticLabel" in tab), "Escape does not store a label");
  is(tab.label, originalLabel, "The label is unchanged");

  BrowserTestUtils.removeTab(tab);
});

add_task(async function test_blur_cancels() {
  const tab = await BrowserTestUtils.openNewForegroundTab(gBrowser, PAGE_URL);
  const originalLabel = tab.label;

  const input = startRenaming(tab);
  input.value = "Not applied";
  gURLBar.focus();
  await waitForRenameEnd(tab);

  is(tab.label, originalLabel, "Losing focus cancels the rename");

  BrowserTestUtils.removeTab(tab);
});

add_task(async function test_double_click_starts_renaming() {
  const tab = await BrowserTestUtils.openNewForegroundTab(gBrowser, PAGE_URL);

  EventUtils.synthesizeMouseAtCenter(labelContainer(tab), { clickCount: 2 });
  await TestUtils.waitForCondition(renameInput, "Double click opens the input");
  EventUtils.synthesizeKey("KEY_Escape");
  await waitForRenameEnd(tab);

  BrowserTestUtils.removeTab(tab);
});

add_task(async function test_one_rename_at_a_time_and_disabled_pref() {
  const tab = await BrowserTestUtils.openNewForegroundTab(gBrowser, PAGE_URL);
  const other = await BrowserTestUtils.openNewForegroundTab(gBrowser, PAGE_URL);

  const input = startRenaming(tab);
  gZenTabRenamer.start({ target: labelContainer(other), type: "dblclick" });
  is(renameInput(), input, "A second rename does not start while one is open");
  EventUtils.synthesizeKey("KEY_Escape");
  await waitForRenameEnd(tab);

  await SpecialPowers.pushPrefEnv({ set: [["zen.tabs.rename-tabs", false]] });
  gZenTabRenamer.start({ target: labelContainer(tab), type: "dblclick" });
  ok(!renameInput(), "Renaming is off when the preference is disabled");
  await SpecialPowers.popPrefEnv();

  BrowserTestUtils.removeTab(other);
  BrowserTestUtils.removeTab(tab);
});
