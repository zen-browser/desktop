/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test case tests the case of opening the SelectTranslationsPanel when the
 * detected language is unsupported, but the page language is known to be a supported
 * language. The panel should automatically fall back to the page language in an
 * effort to combat falsely identified selections.
 */
add_task(
  async function test_select_translations_panel_translate_sentence_on_open() {
    const { cleanup, runInPage, resolveDownloads } = await loadTestPage({
      page: SELECT_TEST_PAGE_URL,
      languagePairs: [
        // Do not include French.
        { fromLang: "es", toLang: "en" },
        { fromLang: "en", toLang: "es" },
      ],
      prefs: [["browser.translations.select.enable", true]],
    });

    await SelectTranslationsTestUtils.openPanel(runInPage, {
      selectFrenchSentence: true,
      openAtFrenchSentence: true,
      // French is not supported, but the page is in Spanish, so expect Spanish.
      expectedFromLanguage: "es",
      expectedToLanguage: "en",
      downloadHandler: resolveDownloads,
      onOpenPanel: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    await SelectTranslationsTestUtils.clickDoneButton();

    await cleanup();
  }
);

/**
 * Bug 1899354
 *
 * This test case tests a specific defect in which the languageInfo cache within the
 * SelectTranslationsPanel was not properly cleared between panel opens on different
 * pages, causing the panel to think that the page's document language tag is that of
 * the previously opened page, rather than the currently opened page.
 */
add_task(
  async function test_select_translations_panel_translate_sentence_on_open() {
    const { cleanup, runInPage, resolveDownloads } = await loadTestPage({
      page: FRENCH_PAGE_URL,
      languagePairs: [
        // Do not include Spanish.
        { fromLang: "fr", toLang: "en" },
        { fromLang: "en", toLang: "fr" },
      ],
      prefs: [["browser.translations.select.enable", true]],
    });

    await SelectTranslationsTestUtils.openPanel(runInPage, {
      selectH1: true,
      openAtH1: true,
      expectedFromLanguage: "fr",
      expectedToLanguage: "en",
      downloadHandler: resolveDownloads,
      onOpenPanel: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    await SelectTranslationsTestUtils.clickDoneButton();

    await navigate("Navigate to the Select Translations test page.", {
      url: SELECT_TEST_PAGE_URL,
    });

    // With the defect described by Bug 1899354 this would incorrectly translate to French,
    // because it would fall back to the previously loaded page's language tag.
    //
    // However, since the SELECT_TEST_PAGE_URL is in Spanish, and the detected text is Spanish,
    // we should have nothing to fall back to, and it should show the unsupported language view.
    await SelectTranslationsTestUtils.openPanel(runInPage, {
      selectSpanishSection: true,
      openAtSpanishSection: true,
      onOpenPanel:
        SelectTranslationsTestUtils.assertPanelViewUnsupportedLanguage,
    });

    await cleanup();
  }
);
