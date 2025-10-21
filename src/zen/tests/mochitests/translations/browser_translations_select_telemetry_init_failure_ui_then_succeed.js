/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test case verifies the counts and extra data sent from telemetry events when interacting
 * with the SelectTranslationsPanel's initialization-failure UI and retrying is successful.
 */
add_task(
  async function test_select_translations_panel_telemetry_init_failure_then_succeed() {
    const { cleanup, runInPage, resolveDownloads } = await loadTestPage({
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
    await TestTranslationsTelemetry.assertEvent(
      Glean.translationsSelectTranslationsPanel.open,
      {
        expectedEventCount: 1,
        expectNewFlowId: true,
        assertForMostRecentEvent: {
          document_language: "es",
          from_language: "es",
          to_language: "en",
          top_preferred_language: "en-US",
          text_source: "selection",
        },
      }
    );
    await TestTranslationsTelemetry.assertEvent(
      Glean.translationsSelectTranslationsPanel.initializationFailureMessage,
      {
        expectedEventCount: 1,
      }
    );

    await SelectTranslationsTestUtils.clickTryAgainButton({
      downloadHandler: resolveDownloads,
      viewAssertion: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });
    await TestTranslationsTelemetry.assertEvent(
      Glean.translationsSelectTranslationsPanel.tryAgainButton,
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
    await TestTranslationsTelemetry.assertEvent(
      Glean.translationsSelectTranslationsPanel.open,
      {
        expectedEventCount: 2,
        expectNewFlowId: false,
        assertForMostRecentEvent: {
          document_language: "es",
          from_language: "es",
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
          from_language: "es",
          to_language: "en",
          top_preferred_language: "en-US",
          request_target: "select",
          auto_translate: false,
          source_text_code_units:
            AppConstants.platform === "win"
              ? 2064 // With carriage returns
              : 2041, // No carriage returns
          source_text_word_count: 358,
        },
      }
    );

    await SelectTranslationsTestUtils.clickDoneButton();
    await TestTranslationsTelemetry.assertEvent(
      Glean.translationsSelectTranslationsPanel.doneButton,
      {
        expectedEventCount: 1,
      }
    );
    await TestTranslationsTelemetry.assertEvent(
      Glean.translationsSelectTranslationsPanel.close,
      {
        expectedEventCount: 2,
      }
    );

    await TestTranslationsTelemetry.assertTranslationsEnginePerformance({
      expectedEventCount: 1,
    });

    await cleanup();
  }
);
