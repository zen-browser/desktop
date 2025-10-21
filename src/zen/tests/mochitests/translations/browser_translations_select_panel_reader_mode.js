/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test case verifies that the Select Translations Panel functionality
 * is available and works within reader mode.
 */
add_task(async function test_the_select_translations_panel_in_reader_mode() {
  const { cleanup, runInPage, resolveDownloads } = await loadTestPage({
    page: SELECT_TEST_PAGE_URL,
    languagePairs: LANGUAGE_PAIRS,
    prefs: [["browser.translations.select.enable", true]],
  });

  await toggleReaderMode();

  await SelectTranslationsTestUtils.openPanel(runInPage, {
    selectH1: true,
    openAtH1: true,
    expectedFromLanguage: "en",
    expectedToLanguage: "en",
    onOpenPanel: SelectTranslationsTestUtils.assertPanelViewTranslated,
  });

  await SelectTranslationsTestUtils.changeSelectedFromLanguage(["es"], {
    openDropdownMenu: true,
    pivotTranslation: false,
    downloadHandler: resolveDownloads,
    onChangeLanguage: SelectTranslationsTestUtils.assertPanelViewTranslated,
  });

  await SelectTranslationsTestUtils.changeSelectedToLanguage(["fr"], {
    openDropdownMenu: false,
    pivotTranslation: true,
    downloadHandler: resolveDownloads,
    onChangeLanguage: SelectTranslationsTestUtils.assertPanelViewTranslated,
  });

  await SelectTranslationsTestUtils.clickDoneButton();

  await cleanup();
});
