/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test case verifies the counts and extra data sent from telemetry events when interacting
 * with the SelectTranslationsPanel's translation-failure UI and the user cancels after retrying.
 */
add_task(
  async function test_select_translations_panel_telemetry_translation_failure_then_cancel() {
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
    await TestTranslationsTelemetry.assertEvent(
      Glean.translationsSelectTranslationsPanel.open,
      {
        expectedEventCount: 1,
        expectNewFlowId: true,
        assertForMostRecentEvent: {
          document_language: "es",
          from_language: "fr",
          to_language: "en",
          top_preferred_language: "en-US",
          text_source: "selection",
        },
      }
    );
    await TestTranslationsTelemetry.assertLabeledCounter(
      Glean.translations.requestCount,
      [
        ["full_page", 0],
        ["select", 1],
      ]
    );
    await TestTranslationsTelemetry.assertEvent(
      Glean.translations.translationRequest,
      {
        expectedEventCount: 1,
        assertForMostRecentEvent: {
          document_language: "es",
          from_language: "fr",
          to_language: "en",
          top_preferred_language: "en-US",
          request_target: "select",
          auto_translate: false,
          source_text_code_units:
            AppConstants.platform === "win"
              ? 1616 // With carriage returns
              : 1607, // No carriage returns
          source_text_word_count: 257,
        },
      }
    );
    await TestTranslationsTelemetry.assertEvent(
      Glean.translationsSelectTranslationsPanel.translationFailureMessage,
      {
        expectedEventCount: 1,
        assertForMostRecentEvent: {
          from_language: "fr",
          to_language: "en",
        },
      }
    );

    await SelectTranslationsTestUtils.clickTryAgainButton({
      downloadHandler: rejectDownloads,
      viewAssertion:
        SelectTranslationsTestUtils.assertPanelViewTranslationFailure,
    });
    await TestTranslationsTelemetry.assertEvent(
      Glean.translationsSelectTranslationsPanel.tryAgainButton,
      {
        expectedEventCount: 1,
      }
    );
    await TestTranslationsTelemetry.assertLabeledCounter(
      Glean.translations.requestCount,
      [
        ["full_page", 0],
        ["select", 2],
      ]
    );
    await TestTranslationsTelemetry.assertEvent(
      Glean.translations.translationRequest,
      {
        expectedEventCount: 2,
        assertForMostRecentEvent: {
          document_language: "es",
          from_language: "fr",
          to_language: "en",
          top_preferred_language: "en-US",
          request_target: "select",
          auto_translate: false,
          source_text_code_units:
            AppConstants.platform === "win"
              ? 1616 // With carriage returns
              : 1607, // No carriage returns
          source_text_word_count: 257,
        },
      }
    );
    await TestTranslationsTelemetry.assertEvent(
      Glean.translationsSelectTranslationsPanel.translationFailureMessage,
      {
        expectedEventCount: 2,
        assertForMostRecentEvent: {
          from_language: "fr",
          to_language: "en",
        },
      }
    );

    await SelectTranslationsTestUtils.clickCancelButton();
    await TestTranslationsTelemetry.assertEvent(
      Glean.translationsSelectTranslationsPanel.cancelButton,
      {
        expectedEventCount: 1,
      }
    );
    await TestTranslationsTelemetry.assertEvent(
      Glean.translationsSelectTranslationsPanel.close,
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
