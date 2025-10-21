/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test case tests the scenario of encountering the translation failure message
 * as a result of changing the source language from the unsupported-language state.
 */
add_task(
  async function test_select_translations_panel_failure_after_unsupported_language() {
    const { cleanup, runInPage, resolveDownloads, rejectDownloads } =
      await loadTestPage({
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

    await SelectTranslationsTestUtils.changeSelectedTryAnotherSourceLanguage(
      "fr"
    );

    await SelectTranslationsTestUtils.clickTranslateButton({
      downloadHandler: rejectDownloads,
      viewAssertion:
        SelectTranslationsTestUtils.assertPanelViewTranslationFailure,
    });

    await SelectTranslationsTestUtils.clickTryAgainButton({
      downloadHandler: rejectDownloads,
      viewAssertion:
        SelectTranslationsTestUtils.assertPanelViewTranslationFailure,
    });

    await SelectTranslationsTestUtils.clickTryAgainButton({
      downloadHandler: resolveDownloads,
      viewAssertion: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    await SelectTranslationsTestUtils.clickDoneButton();

    await cleanup();
  }
);
