/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_IndiaThemePickerBasics() {
  const panel = document.getElementById("PanelUI-zen-gradient-generator");
  ok(panel, "Theme picker panel should be present.");

  registerCleanupFunction(() => {
    Services.prefs.clearUserPref("zen.theme.india-packs.stage");
    Services.prefs.clearUserPref("zen.theme.picker.preview");
    Services.prefs.clearUserPref("zen.theme.picker.favorites");
    Services.prefs.clearUserPref("zen.theme.picker.recents");
  });

  const waitShown = BrowserTestUtils.waitForEvent(panel, "popupshown");
  document.getElementById("cmd_zenOpenZenThemePicker").doCommand();
  await waitShown;

  const allButton = document.getElementById(
    "PanelUI-zen-gradient-generator-pack-all"
  );
  const minimalButton = document.getElementById(
    "PanelUI-zen-gradient-generator-pack-minimal"
  );
  const festiveButton = document.getElementById(
    "PanelUI-zen-gradient-generator-pack-festive"
  );
  const heritageButton = document.getElementById(
    "PanelUI-zen-gradient-generator-pack-heritage"
  );

  ok(allButton && minimalButton && festiveButton && heritageButton, "All pack selectors should exist.");

  // Switch to minimal stage and reopen to verify staged rollout gating.
  Services.prefs.setStringPref("zen.theme.india-packs.stage", "minimal");
  let waitHidden = BrowserTestUtils.waitForEvent(panel, "popuphidden");
  panel.hidePopup();
  await waitHidden;

  const waitShownAgain = BrowserTestUtils.waitForEvent(panel, "popupshown");
  document.getElementById("cmd_zenOpenZenThemePicker").doCommand();
  await waitShownAgain;

  ok(
    document.getElementById("PanelUI-zen-gradient-generator-pack-festive")
      .disabled,
    "Festive pack should be disabled when stage is minimal."
  );
  ok(
    document.getElementById("PanelUI-zen-gradient-generator-pack-heritage")
      .disabled,
    "Heritage pack should be disabled when stage is minimal."
  );

  const minimalPreset = panel.querySelector(
    "#PanelUI-zen-gradient-generator-color-pages box[data-pack='minimal']"
  );
  ok(minimalPreset, "At least one India minimal preset should exist.");
  EventUtils.synthesizeMouseAtCenter(minimalPreset, {}, window);

  await TestUtils.waitForCondition(() => {
    const recents = JSON.parse(
      Services.prefs.getStringPref("zen.theme.picker.recents", "[]")
    );
    return recents.length > 0;
  }, "Selecting a preset should store an entry in recents.");

  const favoriteButton = document.getElementById(
    "PanelUI-zen-gradient-generator-action-favorite"
  );
  EventUtils.synthesizeMouseAtCenter(favoriteButton, {}, window);

  await TestUtils.waitForCondition(() => {
    const favorites = JSON.parse(
      Services.prefs.getStringPref("zen.theme.picker.favorites", "[]")
    );
    return favorites.length > 0;
  }, "Saving favorite should store an entry in favorites.");

  const previewButton = document.getElementById(
    "PanelUI-zen-gradient-generator-action-preview"
  );
  const previousPreviewPref = Services.prefs.getBoolPref(
    "zen.theme.picker.preview",
    true
  );
  EventUtils.synthesizeMouseAtCenter(previewButton, {}, window);
  Assert.notEqual(
    Services.prefs.getBoolPref("zen.theme.picker.preview", true),
    previousPreviewPref,
    "Preview button should toggle preview preference."
  );

  waitHidden = BrowserTestUtils.waitForEvent(panel, "popuphidden");
  panel.hidePopup();
  await waitHidden;
});
