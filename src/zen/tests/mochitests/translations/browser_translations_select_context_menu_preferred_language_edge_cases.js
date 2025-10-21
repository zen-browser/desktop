/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test case tests various fallback edge cases regarding which language to
 * offer for translations based on user settings and supported translations languages.
 */
add_task(
  async function test_translate_selection_menuitem_preferred_language_edge_cases() {
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
      systemLocales: [],
      appLocales: [],
      webLanguages: [],
      // No locales are specified, so fall back to "en".
      expectedTargetLanguage: "en",
    });

    await SelectTranslationsTestUtils.testContextMenuItemWithLocales({
      runInPage,
      appLocales: ["fi", "fr", "en-US"],
      webLanguages: ["zh"],
      expectedTargetLanguage: "fr",
    });

    await SelectTranslationsTestUtils.testContextMenuItemWithLocales({
      runInPage,
      appLocales: ["zh", "uk", "fr", "en-US"],
      webLanguages: ["fi"],
      // Fall back to the first to-language compatible tag.
      expectedTargetLanguage: "fr",
    });

    await SelectTranslationsTestUtils.testContextMenuItemWithLocales({
      runInPage,
      appLocales: ["zh", "fi", "sl", "fr", "en-US"],
      webLanguages: ["fi", "zh"],
      // Fall back to the first to-language compatible tag.
      expectedTargetLanguage: "sl",
    });

    await SelectTranslationsTestUtils.testContextMenuItemWithLocales({
      runInPage,
      systemLocales: ["zh-TW", "zh-CN", "de"],
      appLocales: ["pt-BR", "ja"],
      webLanguages: ["cs", "hu"],
      // None of these locales are supported, so default to "en".
      expectedTargetLanguage: "en",
    });

    await cleanup();
  }
);
