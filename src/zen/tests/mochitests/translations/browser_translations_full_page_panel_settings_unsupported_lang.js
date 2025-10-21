/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This tests a specific defect where the language checkbox states were not being
 * updated correctly when visiting a web page in an unsupported language after
 * previously enabling always-translate-language or never-translate-language
 * on a site with a supported language.
 *
 * See https://bugzilla.mozilla.org/show_bug.cgi?id=1845611 for more information.
 */
add_task(async function test_unsupported_language_settings_menu_checkboxes() {
  const { cleanup, resolveDownloads, runInPage } = await loadTestPage({
    page: SPANISH_PAGE_URL,
    languagePairs: [
      // Do not include French.
      { fromLang: "en", toLang: "es" },
      { fromLang: "es", toLang: "en" },
    ],
  });

  await FullPageTranslationsTestUtils.assertTranslationsButton(
    { button: true, circleArrows: false, locale: false, icon: true },
    "The translations button is visible."
  );

  await FullPageTranslationsTestUtils.openPanel({
    expectedFromLanguage: "es",
    expectedToLanguage: "en",
    onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewIntro,
  });
  await FullPageTranslationsTestUtils.openTranslationsSettingsMenu();

  await FullPageTranslationsTestUtils.assertIsAlwaysTranslateLanguage("es", {
    checked: false,
  });
  await FullPageTranslationsTestUtils.clickAlwaysTranslateLanguage({
    downloadHandler: resolveDownloads,
  });
  await FullPageTranslationsTestUtils.assertIsAlwaysTranslateLanguage("es", {
    checked: true,
  });

  await FullPageTranslationsTestUtils.assertOnlyIntersectingNodesAreTranslated({
    fromLanguage: "es",
    toLanguage: "en",
    runInPage,
  });

  await navigate("Navigate to a page in an unsupported language.", {
    url: FRENCH_PAGE_URL,
  });

  await FullPageTranslationsTestUtils.assertTranslationsButton(
    { button: false },
    "The translations button should be unavailable."
  );

  await FullPageTranslationsTestUtils.openPanel({
    openFromAppMenu: true,
    onOpenPanel:
      FullPageTranslationsTestUtils.assertPanelViewUnsupportedLanguage,
  });
  await FullPageTranslationsTestUtils.assertIsAlwaysTranslateLanguage("fr", {
    checked: false,
    disabled: true,
  });
  await FullPageTranslationsTestUtils.assertIsNeverTranslateLanguage("fr", {
    checked: false,
    disabled: true,
  });

  await cleanup();
});
