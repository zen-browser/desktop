/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test case ensures that the SelectTranslationsPanel copy button can be invoked with the Enter key.
 */
add_task(
  async function test_select_translations_panel_invoke_copy_button_with_enter_key() {
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
      SelectTranslationsPanel.elements.copyButton,
      "KEY_Enter"
    );

    await closeAllOpenPanelsAndMenus();

    await TestTranslationsTelemetry.assertEvent(
      Glean.translationsSelectTranslationsPanel.copyButton,
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
 * This test case ensures that the SelectTranslationsPanel copy button can be invoked with the space bar.
 */
add_task(
  async function test_select_translations_panel_invoke_copy_button_with_space_bar() {
    const { cleanup, runInPage, resolveDownloads } = await loadTestPage({
      page: SELECT_TEST_PAGE_URL,
      languagePairs: LANGUAGE_PAIRS,
      prefs: [["browser.translations.select.enable", true]],
    });

    await SelectTranslationsTestUtils.openPanel(runInPage, {
      selectFrenchSection: true,
      openAtFrenchSection: true,
      expectedFromLanguage: "fr",
      expectedToLanguage: "en",
      downloadHandler: resolveDownloads,
      onOpenPanel: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    focusElementAndSynthesizeKey(
      SelectTranslationsPanel.elements.copyButton,
      " "
    );

    await closeAllOpenPanelsAndMenus();

    await TestTranslationsTelemetry.assertEvent(
      Glean.translationsSelectTranslationsPanel.copyButton,
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
