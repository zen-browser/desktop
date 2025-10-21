/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test case verifies the behavior of switching the from-language to the same value
 * that is currently selected in the to-language, effectively stealing the to-language's
 * value, leaving it unselected and focused.
 */
add_task(
  async function test_select_translations_panel_select_same_from_language_directly() {
    const { cleanup, runInPage, resolveDownloads } = await loadTestPage({
      page: SELECT_TEST_PAGE_URL,
      languagePairs: LANGUAGE_PAIRS,
      prefs: [["browser.translations.select.enable", true]],
    });

    await SelectTranslationsTestUtils.openPanel(runInPage, {
      selectSpanishSection: true,
      openAtSpanishSection: true,
      expectedFromLanguage: "es",
      expectedToLanguage: "en",
      downloadHandler: resolveDownloads,
      onOpenPanel: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    await SelectTranslationsTestUtils.changeSelectedFromLanguage(["en"], {
      openDropdownMenu: false,
      onChangeLanguage: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    await cleanup();
  }
);

/**
 * This test case verifies the behavior of switching the to-language to the same value
 * that is currently selected in the from-language, creating a passthrough translation
 * of the source text directly into the text area.
 */
add_task(
  async function test_select_translations_panel_select_same_to_language_directly() {
    const { cleanup, runInPage, resolveDownloads } = await loadTestPage({
      page: SELECT_TEST_PAGE_URL,
      languagePairs: LANGUAGE_PAIRS,
      prefs: [["browser.translations.select.enable", true]],
    });

    await SelectTranslationsTestUtils.openPanel(runInPage, {
      selectFrenchSentence: true,
      openAtFrenchSentence: true,
      expectedFromLanguage: "fr",
      expectedToLanguage: "en",
      downloadHandler: resolveDownloads,
      onOpenPanel: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    await SelectTranslationsTestUtils.changeSelectedToLanguage(["fr"], {
      openDropdownMenu: false,
      onChangeLanguage: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    await cleanup();
  }
);
