/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test case tests that the SelectTranslationsPanel successfully
 * caches the engine within the Translator for the given language pair,
 * and if that engine is destroyed, the Translator will correctly reinitialize
 * the engine, even for the same language pair.
 */
add_task(
  async function test_select_translations_panel_translate_sentence_on_open() {
    const { cleanup, runInPage, resolveDownloads } = await loadTestPage({
      page: SELECT_TEST_PAGE_URL,
      languagePairs: LANGUAGE_PAIRS,
      prefs: [["browser.translations.select.enable", true]],
    });

    await SelectTranslationsTestUtils.openPanel(runInPage, {
      selectFrenchSection: true,
      openAtFrenchSection: true,
      expectedFromLanguage: "fr",
      expectedToLanguage: "en",
      expectedDownloads: 1,
      downloadHandler: resolveDownloads,
      onOpenPanel: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    await SelectTranslationsTestUtils.clickDoneButton();

    await SelectTranslationsTestUtils.openPanel(runInPage, {
      selectFrenchSentence: true,
      openAtFrenchSentence: true,
      expectedFromLanguage: "fr",
      expectedToLanguage: "en",
      // No downloads because the engine is cached for this language pair.
      onOpenPanel: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    await SelectTranslationsTestUtils.clickDoneButton();

    info("Explicitly destroying the Translations Engine.");
    await destroyTranslationsEngine();

    await SelectTranslationsTestUtils.openPanel(runInPage, {
      openAtFrenchHyperlink: true,
      expectedFromLanguage: "fr",
      expectedToLanguage: "en",
      // Expect downloads again since the engine was destroyed.
      downloadHandler: resolveDownloads,
      onOpenPanel: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    await SelectTranslationsTestUtils.clickDoneButton();

    await cleanup();
  }
);
