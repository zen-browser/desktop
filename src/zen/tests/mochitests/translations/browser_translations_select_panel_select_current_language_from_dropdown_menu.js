/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test case verifies the behavior of directly switching the from-language to the same
 * from-language that is already selected by opening the language dropdown menu,
 * ensuring no change occurs to the translation state, and that no re-translation is triggered.
 */
add_task(
  async function test_select_translations_panel_select_current_from_language_directly() {
    const { cleanup, runInPage, resolveDownloads } = await loadTestPage({
      page: SELECT_TEST_PAGE_URL,
      languagePairs: LANGUAGE_PAIRS,
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

    await SelectTranslationsTestUtils.changeSelectedFromLanguage(["es"], {
      openDropdownMenu: true,
      // No downloads are resolved, because no re-translation is triggered.
      onChangeLanguage: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    await SelectTranslationsTestUtils.clickDoneButton();

    await cleanup();
  }
);

/**
 * This test case verifies the behavior of directly switching the to-language to the same
 * to-language that is already selected by opening the language dropdown menu,
 * ensuring no change occurs to the translation state, and that no re-translation is triggered.
 */
add_task(
  async function test_select_translations_panel_select_current_from_language_directly() {
    const { cleanup, runInPage, resolveDownloads } = await loadTestPage({
      page: SELECT_TEST_PAGE_URL,
      languagePairs: LANGUAGE_PAIRS,
      prefs: [["browser.translations.select.enable", true]],
    });

    await SelectTranslationsTestUtils.openPanel(runInPage, {
      openAtFrenchHyperlink: true,
      expectedFromLanguage: "fr",
      expectedToLanguage: "en",
      downloadHandler: resolveDownloads,
      onOpenPanel: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    await SelectTranslationsTestUtils.changeSelectedToLanguage(["en"], {
      openDropdownMenu: true,
      // No downloads are resolved, because no re-translation is triggered.
      onChangeLanguage: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    await SelectTranslationsTestUtils.clickDoneButton();

    await cleanup();
  }
);
