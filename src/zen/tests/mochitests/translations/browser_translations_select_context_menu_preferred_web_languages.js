/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test case tests various fallback edge cases regarding which language to
 * offer for translations based on the user's web content language settings.
 */
add_task(
  async function test_translate_selection_menuitem_preferred_web_languages() {
    const { cleanup, runInPage } = await loadTestPage({
      page: SELECT_TEST_PAGE_URL,
      languagePairs: [
        { fromLang: "en", toLang: "es" },
        { fromLang: "es", toLang: "en" },
        { fromLang: "en", toLang: "fr" },
        { fromLang: "fr", toLang: "en" },
        { fromLang: "en", toLang: "pl" },
        { fromLang: "pl", toLang: "en" },
        // Only supported as a source language
        { fromLang: "fi", toLang: "en" },
        // Only supported as a target language
        { fromLang: "en", toLang: "sl" },
      ],
      prefs: [["browser.translations.select.enable", true]],
    });

    await FullPageTranslationsTestUtils.assertPageIsNotTranslated(runInPage);

    await SelectTranslationsTestUtils.testContextMenuItemWithLocales({
      runInPage,
      webLanguages: ["es", "fr", "fi", "zh", "sl"],
      // The page language tag is "es", so expect the next language in the list.
      expectedTargetLanguage: "fr",
    });

    await SelectTranslationsTestUtils.testContextMenuItemWithLocales({
      runInPage,
      webLanguages: ["fr", "fi", "zh", "sl", "es"],
      expectedTargetLanguage: "fr",
    });

    await SelectTranslationsTestUtils.testContextMenuItemWithLocales({
      runInPage,
      webLanguages: ["fi", "zh", "sl", "es", "fr"],
      // "fi" is not supported as a target language, so fall back
      expectedTargetLanguage: "sl",
    });

    await SelectTranslationsTestUtils.testContextMenuItemWithLocales({
      runInPage,
      webLanguages: ["zh", "sl", "es", "fr", "fi"],
      expectedTargetLanguage: "sl",
    });

    await SelectTranslationsTestUtils.testContextMenuItemWithLocales({
      runInPage,
      webLanguages: ["sl", "es", "fr", "fi", "zh"],
      expectedTargetLanguage: "sl",
    });

    await cleanup();
  }
);
