/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test case ensures that recently translated target languages are stored, filtered, and retrieved
 * properly when triggering multiple translations via auto translate.
 */
add_task(async function test_recent_language_memory_with_auto_translate() {
  const { cleanup, resolveDownloads, runInPage } = await loadTestPage({
    page: SELECT_TEST_PAGE_URL,
    languagePairs: LANGUAGE_PAIRS,
    prefs: [
      ["browser.translations.select.enable", true],
      ["browser.translations.alwaysTranslateLanguages", "fr"],
      ["browser.translations.mostRecentTargetLanguages", "uk"],
    ],
  });

  await SelectTranslationsTestUtils.openPanel(runInPage, {
    selectEnglishSection: true,
    openAtEnglishSection: true,
    expectedFromLanguage: "en",
    expectedToLanguage: "uk",
    downloadHandler: resolveDownloads,
    onOpenPanel: SelectTranslationsTestUtils.assertPanelViewTranslated,
  });

  await SelectTranslationsTestUtils.changeSelectedToLanguage(["es"], {
    openDropdownMenu: true,
    pivotTranslation: true,
    downloadHandler: resolveDownloads,
    onChangeLanguage: SelectTranslationsTestUtils.assertPanelViewTranslated,
  });

  await SelectTranslationsTestUtils.changeSelectedToLanguage(["fr"], {
    openDropdownMenu: true,
    pivotTranslation: true,
    downloadHandler: resolveDownloads,
    onChangeLanguage: SelectTranslationsTestUtils.assertPanelViewTranslated,
  });

  await SelectTranslationsTestUtils.clickTranslateFullPageButton();

  await FullPageTranslationsTestUtils.assertOnlyIntersectingNodesAreTranslated({
    fromLanguage: "en",
    toLanguage: "fr",
    runInPage,
  });

  await FullPageTranslationsTestUtils.openPanel({
    expectedToLanguage: "es",
    onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewRevisit,
  });
  await FullPageTranslationsTestUtils.openTranslationsSettingsMenu();

  await FullPageTranslationsTestUtils.assertIsAlwaysTranslateLanguage("es", {
    checked: false,
  });
  await FullPageTranslationsTestUtils.clickAlwaysTranslateLanguage();
  await FullPageTranslationsTestUtils.assertIsAlwaysTranslateLanguage("es", {
    checked: true,
  });

  await navigate("Navigate to a French page.", { url: FRENCH_PAGE_URL });
  await resolveDownloads(2);
  await FullPageTranslationsTestUtils.assertLangTagIsShownOnTranslationsButton(
    "fr",
    "es"
  );

  await navigate("Navigate to a Spanish page.", { url: SPANISH_PAGE_URL });
  await resolveDownloads(2);
  await FullPageTranslationsTestUtils.assertOnlyIntersectingNodesAreTranslated({
    fromLanguage: "es",
    toLanguage: "fr",
    runInPage,
  });

  await cleanup();
});
