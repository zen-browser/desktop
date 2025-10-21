/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test case tests various fallback edge cases regarding which language to
 * offer for translations based on the user's application locale settings.
 */
add_task(
  async function test_translate_selection_menuitem_preferred_app_locales() {
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
        // Languages with script tags
        { fromLang: "zh-Hans", toLang: "en" },
        { fromLang: "en", toLang: "zh-Hans" },
        { fromLang: "zh-Hant", toLang: "en" },
        { fromLang: "en", toLang: "zh-Hant" },
      ],
      prefs: [["browser.translations.select.enable", true]],
    });

    await FullPageTranslationsTestUtils.assertPageIsNotTranslated(runInPage);

    await SelectTranslationsTestUtils.testContextMenuItemWithLocales({
      runInPage,
      appLocales: ["es", "fr", "fi", "ja", "sl"],
      // The page language tag is "es", so expect the next language in the list.
      expectedTargetLanguage: "fr",
    });

    await SelectTranslationsTestUtils.testContextMenuItemWithLocales({
      runInPage,
      appLocales: ["fr", "fi", "ja", "sl", "es"],
      expectedTargetLanguage: "fr",
    });

    await SelectTranslationsTestUtils.testContextMenuItemWithLocales({
      runInPage,
      appLocales: ["fi", "ja", "sl", "es", "fr"],
      // "fi" is not supported as a target language, so fall back
      expectedTargetLanguage: "sl",
    });

    await SelectTranslationsTestUtils.testContextMenuItemWithLocales({
      runInPage,
      appLocales: ["ja", "sl", "es", "fr", "fi"],
      expectedTargetLanguage: "sl",
    });

    await SelectTranslationsTestUtils.testContextMenuItemWithLocales({
      runInPage,
      appLocales: ["sl", "es", "fr", "fi", "ja"],
      expectedTargetLanguage: "sl",
    });

    await SelectTranslationsTestUtils.testContextMenuItemWithLocales({
      runInPage,
      appLocales: ["zh-CN", "zh", "es", "fr", "fi", "ja"],
      expectedTargetLanguage: "zh-Hans",
    });

    await SelectTranslationsTestUtils.testContextMenuItemWithLocales({
      runInPage,
      appLocales: ["zh-SG", "zh", "es", "fr", "fi", "ja"],
      expectedTargetLanguage: "zh-Hans",
    });

    await SelectTranslationsTestUtils.testContextMenuItemWithLocales({
      runInPage,
      appLocales: ["zh-MY", "zh", "es", "fr", "fi", "ja"],
      expectedTargetLanguage: "zh-Hans",
    });

    await SelectTranslationsTestUtils.testContextMenuItemWithLocales({
      runInPage,
      appLocales: ["zh-HK", "zh", "es", "fr", "fi", "ja"],
      expectedTargetLanguage: "zh-Hant",
    });

    await SelectTranslationsTestUtils.testContextMenuItemWithLocales({
      runInPage,
      appLocales: ["zh-MO", "zh", "es", "fr", "fi", "ja"],
      expectedTargetLanguage: "zh-Hant",
    });

    await SelectTranslationsTestUtils.testContextMenuItemWithLocales({
      runInPage,
      appLocales: ["zh-TW", "zh", "es", "fr", "fi", "ja"],
      expectedTargetLanguage: "zh-Hant",
    });

    await cleanup();
  }
);
