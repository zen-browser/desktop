/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test case ensures that the SelectTranslationsPanel cancel button can be invoked with the Enter key
 * from the initialization-failure panel view.
 */
add_task(
  async function test_select_translations_panel_invoke_init_failure_cancel_button_with_enter_key() {
    const { cleanup, runInPage } = await loadTestPage({
      page: SELECT_TEST_PAGE_URL,
      LANGUAGE_PAIRS,
      prefs: [["browser.translations.select.enable", true]],
    });

    TranslationsPanelShared.simulateLangListError();
    await SelectTranslationsTestUtils.openPanel(runInPage, {
      selectSpanishSection: true,
      openAtSpanishSection: true,
      onOpenPanel: SelectTranslationsTestUtils.assertPanelViewInitFailure,
    });

    focusElementAndSynthesizeKey(
      SelectTranslationsPanel.elements.cancelButton,
      "KEY_Enter"
    );

    await closeAllOpenPanelsAndMenus();

    await TestTranslationsTelemetry.assertEvent(
      Glean.translationsSelectTranslationsPanel.cancelButton,
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
 * This test case ensures that the SelectTranslationsPanel cancel button can be invoked with the space bar
 * from the initialization-failure panel view.
 */
add_task(
  async function test_select_translations_panel_invoke_init_failure_cancel_button_with_space_bar() {
    const { cleanup, runInPage } = await loadTestPage({
      page: SELECT_TEST_PAGE_URL,
      LANGUAGE_PAIRS,
      prefs: [["browser.translations.select.enable", true]],
    });

    TranslationsPanelShared.simulateLangListError();
    await SelectTranslationsTestUtils.openPanel(runInPage, {
      selectSpanishSection: true,
      openAtSpanishSection: true,
      onOpenPanel: SelectTranslationsTestUtils.assertPanelViewInitFailure,
    });

    focusElementAndSynthesizeKey(
      SelectTranslationsPanel.elements.cancelButton,
      " "
    );

    await closeAllOpenPanelsAndMenus();

    await TestTranslationsTelemetry.assertEvent(
      Glean.translationsSelectTranslationsPanel.cancelButton,
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
 * This test case ensures that the SelectTranslationsPanel cancel button can be invoked with the Enter key
 * from the translation-failure panel view.
 */
add_task(
  async function test_select_translations_panel_invoke_translation_failure_cancel_button_with_enter_key() {
    const { cleanup, runInPage, rejectDownloads } = await loadTestPage({
      page: SELECT_TEST_PAGE_URL,
      languagePairs: LANGUAGE_PAIRS,
      prefs: [["browser.translations.select.enable", true]],
    });

    await SelectTranslationsTestUtils.openPanel(runInPage, {
      selectSpanishSection: true,
      openAtSpanishSection: true,
      expectedFromLanguage: "es",
      expectedToLanguage: "en",
      downloadHandler: rejectDownloads,
      onOpenPanel:
        SelectTranslationsTestUtils.assertPanelViewTranslationFailure,
    });

    focusElementAndSynthesizeKey(
      SelectTranslationsPanel.elements.cancelButton,
      "KEY_Enter"
    );

    await closeAllOpenPanelsAndMenus();

    await TestTranslationsTelemetry.assertEvent(
      Glean.translationsSelectTranslationsPanel.cancelButton,
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
 * This test case ensures that the SelectTranslationsPanel cancel button can be invoked with the space bar
 * from the translation-failure panel view.
 */
add_task(
  async function test_select_translations_panel_invoke_translation_failure_cancel_button_with_space_bar() {
    const { cleanup, runInPage, rejectDownloads } = await loadTestPage({
      page: SELECT_TEST_PAGE_URL,
      languagePairs: LANGUAGE_PAIRS,
      prefs: [["browser.translations.select.enable", true]],
    });

    await SelectTranslationsTestUtils.openPanel(runInPage, {
      selectFrenchSection: true,
      openAtFrenchSection: true,
      expectedFromLanguage: "fr",
      expectedToLanguage: "en",
      downloadHandler: rejectDownloads,
      onOpenPanel:
        SelectTranslationsTestUtils.assertPanelViewTranslationFailure,
    });

    focusElementAndSynthesizeKey(
      SelectTranslationsPanel.elements.cancelButton,
      " "
    );

    await closeAllOpenPanelsAndMenus();

    await TestTranslationsTelemetry.assertEvent(
      Glean.translationsSelectTranslationsPanel.cancelButton,
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
