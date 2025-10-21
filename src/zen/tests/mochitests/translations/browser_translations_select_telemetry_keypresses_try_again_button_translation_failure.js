/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test case ensures that the SelectTranslationsPanel try-again button can be invoked with the Enter key.
 * from the translation-failure panel view.
 */
add_task(
  async function test_select_translations_panel_invoke_translation_failure_try_again_button_with_enter_key() {
    const { cleanup, runInPage, resolveDownloads, rejectDownloads } =
      await loadTestPage({
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

    const translatablePhasePromise =
      SelectTranslationsTestUtils.waitForPanelState("translatable");
    focusElementAndSynthesizeKey(
      SelectTranslationsPanel.elements.tryAgainButton,
      "KEY_Enter"
    );
    await translatablePhasePromise;

    await SelectTranslationsTestUtils.handleDownloads({
      downloadHandler: resolveDownloads,
    });
    await SelectTranslationsTestUtils.assertPanelViewTranslated();

    await closeAllOpenPanelsAndMenus();

    await TestTranslationsTelemetry.assertEvent(
      Glean.translationsSelectTranslationsPanel.tryAgainButton,
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
 * This test case ensures that the SelectTranslationsPanel try-again button can be invoked with the space bar.
 * from the translation-failure panel view.
 */
add_task(
  async function test_select_translations_panel_invoke_translation_failure_try_again_button_with_space_bar() {
    const { cleanup, runInPage, resolveDownloads, rejectDownloads } =
      await loadTestPage({
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

    const translatablePhasePromise =
      SelectTranslationsTestUtils.waitForPanelState("translatable");
    focusElementAndSynthesizeKey(
      SelectTranslationsPanel.elements.tryAgainButton,
      " "
    );
    await translatablePhasePromise;

    await SelectTranslationsTestUtils.handleDownloads({
      downloadHandler: resolveDownloads,
    });
    await SelectTranslationsTestUtils.assertPanelViewTranslated();

    await closeAllOpenPanelsAndMenus();

    await TestTranslationsTelemetry.assertEvent(
      Glean.translationsSelectTranslationsPanel.tryAgainButton,
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
