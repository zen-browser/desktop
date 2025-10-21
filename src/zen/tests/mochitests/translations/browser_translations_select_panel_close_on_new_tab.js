/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test case tests the scenario where the SelectTranslationsPanel is open
 * and the user opens a new tab while the panel is still open. The panel should
 * close appropriately, as the content relevant to the selection is no longer
 * in the active tab.
 */
add_task(
  async function test_select_translations_panel_translate_sentence_on_open() {
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

    let tab;

    await SelectTranslationsTestUtils.waitForPanelPopupEvent(
      "popuphidden",
      async () => {
        tab = await BrowserTestUtils.openNewForegroundTab(
          gBrowser,
          SPANISH_PAGE_URL,
          true // waitForLoad
        );
      }
    );

    BrowserTestUtils.removeTab(tab);

    await cleanup();
  }
);
