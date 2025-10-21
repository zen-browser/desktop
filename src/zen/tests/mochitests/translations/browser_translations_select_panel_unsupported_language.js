/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test case verifies the behavior of opening the SelectTranslationsPanel to an unsupported language
 * and then clicking the done button to close the panel.
 */
add_task(
  async function test_select_translations_panel_unsupported_click_done_button() {
    const { cleanup, runInPage } = await loadTestPage({
      page: SELECT_TEST_PAGE_URL,
      languagePairs: [
        // Do not include Spanish.
        { fromLang: "fr", toLang: "en" },
        { fromLang: "en", toLang: "fr" },
      ],
      prefs: [["browser.translations.select.enable", true]],
    });

    await SelectTranslationsTestUtils.openPanel(runInPage, {
      selectSpanishSentence: true,
      openAtSpanishSentence: true,
      onOpenPanel:
        SelectTranslationsTestUtils.assertPanelViewUnsupportedLanguage,
    });

    await SelectTranslationsTestUtils.clickDoneButton();

    await cleanup();
  }
);

/**
 * This test case verifies the behavior of opening the SelectTranslationsPanel to an unsupported language
 * then changing the source language to the same language as the app locale, triggering a same-language
 * translation, then changing the from-language and to-language multiple times.
 */
add_task(
  async function test_select_translations_panel_unsupported_then_to_same_language_translation() {
    const { cleanup, runInPage, resolveDownloads } = await loadTestPage({
      page: SELECT_TEST_PAGE_URL,
      languagePairs: [
        // Do not include Spanish.
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
      onOpenPanel:
        SelectTranslationsTestUtils.assertPanelViewUnsupportedLanguage,
    });

    await SelectTranslationsTestUtils.changeSelectedTryAnotherSourceLanguage(
      "en"
    );

    await SelectTranslationsTestUtils.clickTranslateButton({
      viewAssertion: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    await SelectTranslationsTestUtils.changeSelectedToLanguage(["uk", "fi"], {
      openDropdownMenu: false,
      downloadHandler: resolveDownloads,
      onChangeLanguage: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    await SelectTranslationsTestUtils.changeSelectedFromLanguage(["sl", "fr"], {
      openDropdownMenu: true,
      downloadHandler: resolveDownloads,
      pivotTranslation: true,
      onChangeLanguage: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    await SelectTranslationsTestUtils.changeSelectedToLanguage(["fr"], {
      openDropdownMenu: true,
      onChangeLanguage: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    await SelectTranslationsTestUtils.clickDoneButton();

    await cleanup();
  }
);

/**
 * This test case verifies the behavior of opening the SelectTranslationsPanel to an unsupported language
 * then changing the source language to a valid language, followed by changing the from-language and to-language
 * multiple times.
 */
add_task(
  async function test_select_translations_panel_unsupported_into_different_language_translation() {
    const { cleanup, runInPage, resolveDownloads } = await loadTestPage({
      page: SELECT_TEST_PAGE_URL,
      languagePairs: [
        // Do not include Spanish.
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
      onOpenPanel:
        SelectTranslationsTestUtils.assertPanelViewUnsupportedLanguage,
    });

    await SelectTranslationsTestUtils.changeSelectedTryAnotherSourceLanguage(
      "fr"
    );

    await SelectTranslationsTestUtils.clickTranslateButton({
      downloadHandler: resolveDownloads,
      viewAssertion: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    await SelectTranslationsTestUtils.changeSelectedFromLanguage(["uk", "fi"], {
      openDropdownMenu: false,
      downloadHandler: resolveDownloads,
      pivotTranslation: true,
      onChangeLanguage: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    await SelectTranslationsTestUtils.changeSelectedToLanguage(["sl", "uk"], {
      openDropdownMenu: true,
      downloadHandler: resolveDownloads,
      pivotTranslation: true,
      onChangeLanguage: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    await SelectTranslationsTestUtils.changeSelectedFromLanguage(["uk"], {
      openDropdownMenu: false,
      onChangeLanguage: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    await SelectTranslationsTestUtils.clickDoneButton();

    await cleanup();
  }
);
