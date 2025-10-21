/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test case tests the scenario of encountering the translation failure message
 * as a result of changing the selected from-language, along with moving from the failure
 * state to a successful translation also by changing the selected from-language.
 */
add_task(
  async function test_select_translations_panel_translation_failure_on_change_from_language() {
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
      downloadHandler: resolveDownloads,
      onOpenPanel: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    await SelectTranslationsTestUtils.changeSelectedFromLanguage(["es"], {
      openDropdownMenu: false,
      downloadHandler: rejectDownloads,
      onChangeLanguage:
        SelectTranslationsTestUtils.assertPanelViewTranslationFailure,
    });

    await SelectTranslationsTestUtils.changeSelectedFromLanguage(["uk"], {
      openDropdownMenu: true,
      downloadHandler: rejectDownloads,
      onChangeLanguage:
        SelectTranslationsTestUtils.assertPanelViewTranslationFailure,
    });

    await SelectTranslationsTestUtils.changeSelectedFromLanguage(["es"], {
      openDropdownMenu: true,
      downloadHandler: resolveDownloads,
      onChangeLanguage: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    await SelectTranslationsTestUtils.changeSelectedFromLanguage(["uk"], {
      openDropdownMenu: false,
      downloadHandler: rejectDownloads,
      onChangeLanguage:
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

/**
 * This test case tests the scenario of encountering the translation failure message
 * as a result of changing the selected to-language, along with moving from the failure
 * state to a successful translation also by changing the selected to-language.
 */
add_task(
  async function test_select_translations_panel_translation_failure_on_change_to_language() {
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
      downloadHandler: resolveDownloads,
      onOpenPanel: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    await SelectTranslationsTestUtils.changeSelectedToLanguage(["es"], {
      openDropdownMenu: false,
      downloadHandler: rejectDownloads,
      onChangeLanguage:
        SelectTranslationsTestUtils.assertPanelViewTranslationFailure,
    });

    await SelectTranslationsTestUtils.changeSelectedToLanguage(["uk"], {
      openDropdownMenu: true,
      downloadHandler: rejectDownloads,
      onChangeLanguage:
        SelectTranslationsTestUtils.assertPanelViewTranslationFailure,
    });

    await SelectTranslationsTestUtils.changeSelectedToLanguage(["es"], {
      openDropdownMenu: true,
      downloadHandler: resolveDownloads,
      pivotTranslation: true,
      onChangeLanguage: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    await SelectTranslationsTestUtils.changeSelectedToLanguage(["uk"], {
      openDropdownMenu: false,
      downloadHandler: rejectDownloads,
      onChangeLanguage:
        SelectTranslationsTestUtils.assertPanelViewTranslationFailure,
    });

    await SelectTranslationsTestUtils.clickTryAgainButton({
      downloadHandler: resolveDownloads,
      pivotTranslation: true,
      viewAssertion: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    await SelectTranslationsTestUtils.clickDoneButton();

    await cleanup();
  }
);
