/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test case verifies the behavior of directly changing the from-language in rapid succession,
 * ensuring that any triggered translations are resolved/dropped in order, and that the final translated
 * state matches the final selected language.
 */
add_task(
  async function test_select_translations_panel_translate_on_change_from_language_multiple_times_directly() {
    const { cleanup, runInPage, resolveDownloads } = await loadTestPage({
      page: SELECT_TEST_PAGE_URL,
      languagePairs: [
        { fromLang: "es", toLang: "en" },
        { fromLang: "en", toLang: "es" },
        { fromLang: "fa", toLang: "en" },
        { fromLang: "en", toLang: "fa" },
        { fromLang: "fi", toLang: "en" },
        { fromLang: "en", toLang: "fi" },
        { fromLang: "fr", toLang: "en" },
        { fromLang: "en", toLang: "fr" },
        { fromLang: "sl", toLang: "en" },
        { fromLang: "en", toLang: "sl" },
        { fromLang: "uk", toLang: "en" },
        { fromLang: "en", toLang: "uk" },
      ],
      prefs: [["browser.translations.select.enable", true]],
    });

    await SelectTranslationsTestUtils.openPanel(runInPage, {
      selectSpanishSentence: true,
      openAtSpanishSentence: true,
      expectedFromLanguage: "es",
      expectedToLanguage: "en",
      downloadHandler: resolveDownloads,
      onOpenPanel: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    await SelectTranslationsTestUtils.changeSelectedFromLanguage(
      ["fa", "fi", "fr", "sl", "uk"],
      {
        openDropdownMenu: false,
        downloadHandler: resolveDownloads,
        onChangeLanguage: SelectTranslationsTestUtils.assertPanelViewTranslated,
      }
    );

    await cleanup();
  }
);

/**
 * This test case verifies the behavior of directly changing the to-language in rapid succession,
 * ensuring that any triggered translations are resolved/dropped in order, and that the final translated
 * state matches the final selected language.
 */
add_task(
  async function test_select_translations_panel_translate_on_change_to_language_multiple_times_directly() {
    const { cleanup, runInPage, resolveDownloads } = await loadTestPage({
      page: SELECT_TEST_PAGE_URL,
      languagePairs: [
        { fromLang: "es", toLang: "en" },
        { fromLang: "en", toLang: "es" },
        { fromLang: "fa", toLang: "en" },
        { fromLang: "en", toLang: "fa" },
        { fromLang: "fi", toLang: "en" },
        { fromLang: "en", toLang: "fi" },
        { fromLang: "fr", toLang: "en" },
        { fromLang: "en", toLang: "fr" },
        { fromLang: "sl", toLang: "en" },
        { fromLang: "en", toLang: "sl" },
        { fromLang: "uk", toLang: "en" },
        { fromLang: "en", toLang: "uk" },
      ],
      prefs: [["browser.translations.select.enable", true]],
    });

    await SelectTranslationsTestUtils.openPanel(runInPage, {
      openAtEnglishHyperlink: true,
      expectedFromLanguage: "en",
      expectedToLanguage: "en",
      onOpenPanel: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    await SelectTranslationsTestUtils.changeSelectedToLanguage(
      ["es", "fa", "fi", "fr", "sl", "uk", "fa"],
      {
        openDropdownMenu: false,
        downloadHandler: resolveDownloads,
        onChangeLanguage: SelectTranslationsTestUtils.assertPanelViewTranslated,
      }
    );

    await cleanup();
  }
);
