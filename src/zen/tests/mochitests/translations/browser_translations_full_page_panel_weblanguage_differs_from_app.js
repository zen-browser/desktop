/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests what happens when the web languages differ from the app language.
 */
add_task(async function test_weblanguage_differs_app_locale() {
  const { cleanup } = await loadTestPage({
    page: ENGLISH_PAGE_URL,
    languagePairs: LANGUAGE_PAIRS,
    systemLocales: ["en"],
    appLocales: ["en"],
    webLanguages: ["fr"],
  });

  await FullPageTranslationsTestUtils.assertTranslationsButton(
    { button: true, circleArrows: false, locale: false, icon: true },
    "The translations button is available"
  );

  await FullPageTranslationsTestUtils.openPanel({
    expectedFromLanguage: "en",
    expectedToLanguage: "fr",
    onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewIntro,
  });

  await FullPageTranslationsTestUtils.openTranslationsSettingsMenu();

  await FullPageTranslationsTestUtils.assertIsNeverTranslateLanguage("en", {
    checked: false,
    disabled: false,
  });
  await FullPageTranslationsTestUtils.assertIsAlwaysTranslateLanguage("en", {
    checked: false,
    disabled: false,
  });

  await closeAllOpenPanelsAndMenus();
  await cleanup();
});
