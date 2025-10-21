/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test case tests translations in the SelectTranslationsPanel with the
 * useLexicalShortlist pref initially set to false. It then toggles it to true,
 * and then back to false, ensuring that the correct models are downloaded, and
 * that the translations succeed with each flip of the pref.
 */
add_task(
  async function test_select_translations_panel_lexical_shortlist_starting_false() {
    const { cleanup, runInPage, resolveDownloads } = await loadTestPage({
      page: SELECT_TEST_PAGE_URL,
      languagePairs: LANGUAGE_PAIRS,
      prefs: [
        ["browser.translations.select.enable", true],
        ["browser.translations.useLexicalShortlist", false],
      ],
    });

    await SelectTranslationsTestUtils.openPanel(runInPage, {
      selectFrenchSentence: true,
      openAtFrenchSentence: true,
      expectedFromLanguage: "fr",
      expectedToLanguage: "en",
      downloadHandler: resolveDownloads,
      onOpenPanel: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    await SelectTranslationsTestUtils.clickDoneButton();

    await waitForTranslationModelRecordsChanged(() => {
      Services.prefs.setBoolPref(
        "browser.translations.useLexicalShortlist",
        true
      );
    });

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
 * This test case tests translations in the SelectTranslationsPanel with the
 * useLexicalShortlist pref initially set to true. It then toggles it to false,
 * and then back to true, ensuring that the correct models are downloaded, and
 * that the translations succeed with each flip of the pref.
 */
add_task(
  async function test_select_translations_panel_lexical_shortlist_starting_true() {
    const { cleanup, runInPage, resolveDownloads } = await loadTestPage({
      page: SELECT_TEST_PAGE_URL,
      languagePairs: LANGUAGE_PAIRS,
      prefs: [
        ["browser.translations.select.enable", true],
        ["browser.translations.useLexicalShortlist", true],
      ],
    });

    await SelectTranslationsTestUtils.openPanel(runInPage, {
      selectFrenchSentence: true,
      openAtFrenchSentence: true,
      expectedFromLanguage: "fr",
      expectedToLanguage: "en",
      downloadHandler: resolveDownloads,
      onOpenPanel: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    await SelectTranslationsTestUtils.clickDoneButton();

    await waitForTranslationModelRecordsChanged(() => {
      Services.prefs.setBoolPref(
        "browser.translations.useLexicalShortlist",
        false
      );
    });

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
