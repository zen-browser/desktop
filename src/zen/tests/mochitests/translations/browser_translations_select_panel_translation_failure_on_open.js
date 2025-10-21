/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test case tests the scenario of opening the SelectTranslationsPanel to a translation
 * attempt that fails, followed by closing the panel via the cancel button, and then re-attempting
 * the translation by re-opening the panel and having it succeed.
 */
add_task(
  async function test_select_translations_panel_translation_failure_on_open_then_cancel_and_reopen() {
    const { cleanup, runInPage, rejectDownloads, resolveDownloads } =
      await loadTestPage({
        page: SELECT_TEST_PAGE_URL,
        languagePairs: LANGUAGE_PAIRS,
        prefs: [["browser.translations.select.enable", true]],
      });

    await SelectTranslationsTestUtils.openPanel(runInPage, {
      selectFrenchSentence: true,
      openAtFrenchSentence: true,
      expectedFromLanguage: "fr",
      expectedToLanguage: "en",
      downloadHandler: rejectDownloads,
      onOpenPanel:
        SelectTranslationsTestUtils.assertPanelViewTranslationFailure,
    });

    await SelectTranslationsTestUtils.clickCancelButton();

    await SelectTranslationsTestUtils.openPanel(runInPage, {
      selectFrenchSentence: true,
      openAtFrenchSentence: true,
      expectedFromLanguage: "fr",
      expectedToLanguage: "en",
      downloadHandler: resolveDownloads,
      onOpenPanel: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    await SelectTranslationsTestUtils.clickDoneButton();

    await cleanup();
  }
);

/**
 * This test case tests the scenario of opening the SelectTranslationsPanel to a translation
 * attempt that fails, followed by clicking the try-again button multiple times to retry the
 * translation until it finally succeeds.
 */
add_task(
  async function test_select_translations_panel_translation_failure_on_open_then_try_again() {
    const { cleanup, runInPage, rejectDownloads, resolveDownloads } =
      await loadTestPage({
        page: SELECT_TEST_PAGE_URL,
        languagePairs: LANGUAGE_PAIRS,
        prefs: [["browser.translations.select.enable", true]],
      });

    await SelectTranslationsTestUtils.openPanel(runInPage, {
      selectFrenchSentence: true,
      openAtFrenchSentence: true,
      expectedFromLanguage: "fr",
      expectedToLanguage: "en",
      downloadHandler: rejectDownloads,
      onOpenPanel:
        SelectTranslationsTestUtils.assertPanelViewTranslationFailure,
    });

    await SelectTranslationsTestUtils.clickTryAgainButton({
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
