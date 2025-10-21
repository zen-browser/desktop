/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test case ensures that the SelectTranslationsPanel done button can be invoked with the Enter key
 * from the primary-UI panel view.
 */
add_task(
  async function test_select_translations_panel_invoke_primary_done_button_with_enter_key() {
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

    focusElementAndSynthesizeKey(
      SelectTranslationsPanel.elements.doneButtonPrimary,
      "KEY_Enter"
    );

    await closeAllOpenPanelsAndMenus();

    await TestTranslationsTelemetry.assertEvent(
      Glean.translationsSelectTranslationsPanel.doneButton,
      {
        expectedEventCount: 1,
      }
    );

    await TestTranslationsTelemetry.assertTranslationsEnginePerformance({
      expectedEventCount: 1,
    });

    await cleanup();
  }
);

/**
 * This test case ensures that the SelectTranslationsPanel done button can be invoked with the space bar
 * from the primary-UI panel view.
 */
add_task(
  async function test_select_translations_panel_invoke_primary_done_button_with_space_bar() {
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

    focusElementAndSynthesizeKey(
      SelectTranslationsPanel.elements.doneButtonPrimary,
      " "
    );

    await closeAllOpenPanelsAndMenus();

    await TestTranslationsTelemetry.assertEvent(
      Glean.translationsSelectTranslationsPanel.doneButton,
      {
        expectedEventCount: 1,
      }
    );

    await TestTranslationsTelemetry.assertTranslationsEnginePerformance({
      expectedEventCount: 1,
    });

    await cleanup();
  }
);

/**
 * This test case ensures that the SelectTranslationsPanel done button can be invoked with the Enter key
 * from the unsupported-language panel view.
 */
add_task(
  async function test_select_translations_panel_invoke_secondary_done_button_with_enter_key() {
    const { cleanup, runInPage } = await loadTestPage({
      page: SELECT_TEST_PAGE_URL,
      languagePairs: [
        // Do not include French.
        { fromLang: "uk", toLang: "en" },
        { fromLang: "en", toLang: "uk" },
      ],
      prefs: [["browser.translations.select.enable", true]],
    });

    await SelectTranslationsTestUtils.openPanel(runInPage, {
      selectFrenchSection: true,
      openAtFrenchSection: true,
      onOpenPanel:
        SelectTranslationsTestUtils.assertPanelViewUnsupportedLanguage,
    });

    focusElementAndSynthesizeKey(
      SelectTranslationsPanel.elements.doneButtonSecondary,
      "KEY_Enter"
    );

    await closeAllOpenPanelsAndMenus();

    await TestTranslationsTelemetry.assertEvent(
      Glean.translationsSelectTranslationsPanel.doneButton,
      {
        expectedEventCount: 1,
      }
    );

    await TestTranslationsTelemetry.assertTranslationsEnginePerformance({
      expectedEventCount: 0,
    });

    await cleanup();
  }
);

/**
 * This test case ensures that the SelectTranslationsPanel done button can be invoked with the space bar
 * from the unsupported-language panel view.
 */
add_task(
  async function test_select_translations_panel_invoke_secondary_done_button_with_space_bar() {
    const { cleanup, runInPage } = await loadTestPage({
      page: SELECT_TEST_PAGE_URL,
      languagePairs: [
        // Do not include Spanish.
        { fromLang: "fr", toLang: "en" },
        { fromLang: "en", toLang: "fr" },
      ],
      prefs: [["browser.translations.select.enable", true]],
    });

    await SelectTranslationsTestUtils.openPanel(runInPage, {
      selectSpanishSection: true,
      openAtSpanishSection: true,
      onOpenPanel:
        SelectTranslationsTestUtils.assertPanelViewUnsupportedLanguage,
    });

    focusElementAndSynthesizeKey(
      SelectTranslationsPanel.elements.doneButtonSecondary,
      " "
    );

    await closeAllOpenPanelsAndMenus();

    await TestTranslationsTelemetry.assertEvent(
      Glean.translationsSelectTranslationsPanel.doneButton,
      {
        expectedEventCount: 1,
      }
    );

    await TestTranslationsTelemetry.assertTranslationsEnginePerformance({
      expectedEventCount: 0,
    });

    await cleanup();
  }
);
