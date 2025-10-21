/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test case verifies the scenario of clicking the cancel button to close
 * the SelectTranslationsPanel after the language lists fail to initialize upon
 * opening the panel, and the proper error message is displayed.
 */
add_task(async function test_select_translations_panel_init_failure_cancel() {
  const { cleanup, runInPage } = await loadTestPage({
    page: SELECT_TEST_PAGE_URL,
    languagePairs: LANGUAGE_PAIRS,
    prefs: [["browser.translations.select.enable", true]],
  });

  TranslationsPanelShared.simulateLangListError();
  await SelectTranslationsTestUtils.openPanel(runInPage, {
    selectFrenchSentence: true,
    openAtFrenchSentence: true,
    onOpenPanel: SelectTranslationsTestUtils.assertPanelViewInitFailure,
  });

  await SelectTranslationsTestUtils.clickCancelButton();

  await cleanup();
});

/**
 * This test case verifies the scenario of opening the SelectTranslationsPanel to a valid
 * language pair, but having the language lists fail to initialize, then clicking the try-again
 * button multiple times until both initialization and translation succeed.
 */
add_task(
  async function test_select_translations_panel_init_failure_try_again_into_translation() {
    const { cleanup, runInPage, resolveDownloads, rejectDownloads } =
      await loadTestPage({
        page: SELECT_TEST_PAGE_URL,
        languagePairs: LANGUAGE_PAIRS,
        prefs: [["browser.translations.select.enable", true]],
      });

    TranslationsPanelShared.simulateLangListError();
    await SelectTranslationsTestUtils.openPanel(runInPage, {
      selectFrenchSentence: true,
      openAtFrenchSentence: true,
      onOpenPanel: SelectTranslationsTestUtils.assertPanelViewInitFailure,
    });

    TranslationsPanelShared.simulateLangListError();
    await SelectTranslationsTestUtils.waitForPanelPopupEvent(
      "popupshown",
      SelectTranslationsTestUtils.clickTryAgainButton,
      SelectTranslationsTestUtils.assertPanelViewInitFailure
    );

    await SelectTranslationsTestUtils.waitForPanelPopupEvent(
      "popupshown",
      async () =>
        SelectTranslationsTestUtils.clickTryAgainButton({
          downloadHandler: rejectDownloads,
        }),
      SelectTranslationsTestUtils.assertPanelViewTranslationFailure
    );

    await SelectTranslationsTestUtils.clickTryAgainButton({
      downloadHandler: resolveDownloads,
      viewAssertion: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    await SelectTranslationsTestUtils.clickDoneButton();

    await cleanup();
  }
);

/**
 * This test case verifies the scenario of opening the SelectTranslationsPanel to an unsupported
 * language, but having the language lists fail to initialize, then clicking the try-again
 * button multiple times until the unsupported-language view is shown.
 */
add_task(
  async function test_select_translations_panel_init_failure_try_again_into_unsupported() {
    const { cleanup, runInPage } = await loadTestPage({
      page: SELECT_TEST_PAGE_URL,
      languagePairs: [
        // Do not include Spanish.
        { fromLang: "fr", toLang: "en" },
        { fromLang: "en", toLang: "fr" },
      ],
      prefs: [["browser.translations.select.enable", true]],
    });

    TranslationsPanelShared.simulateLangListError();
    await SelectTranslationsTestUtils.openPanel(runInPage, {
      selectSpanishSection: true,
      openAtSpanishSection: true,
      onOpenPanel: SelectTranslationsTestUtils.assertPanelViewInitFailure,
    });

    TranslationsPanelShared.simulateLangListError();
    await SelectTranslationsTestUtils.waitForPanelPopupEvent(
      "popupshown",
      SelectTranslationsTestUtils.clickTryAgainButton,
      SelectTranslationsTestUtils.assertPanelViewInitFailure
    );

    await SelectTranslationsTestUtils.waitForPanelPopupEvent(
      "popupshown",
      SelectTranslationsTestUtils.clickTryAgainButton,
      SelectTranslationsTestUtils.assertPanelViewUnsupportedLanguage
    );

    await SelectTranslationsTestUtils.clickDoneButton();

    await cleanup();
  }
);
