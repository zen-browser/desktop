/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test case verifies the counts and extra data sent from telemetry events when interacting
 * with the SelectTranslationsPanel's settings menu.
 */
add_task(
  async function test_select_translations_panel_telemetry_settings_menu() {
    const { cleanup, runInPage, resolveDownloads } = await loadTestPage({
      page: SELECT_TEST_PAGE_URL,
      languagePairs: LANGUAGE_PAIRS,
      prefs: [["browser.translations.select.enable", true]],
    });

    await SelectTranslationsTestUtils.openPanel(runInPage, {
      openAtFrenchHyperlink: true,
      expectedFromLanguage: "fr",
      expectedToLanguage: "en",
      downloadHandler: resolveDownloads,
      onOpenPanel: SelectTranslationsTestUtils.assertPanelViewTranslated,
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
          text_source: "hyperlink",
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
          source_text_code_units: 27,
          source_text_word_count: 5,
        },
      }
    );

    await SelectTranslationsTestUtils.openPanelSettingsMenu();
    await TestTranslationsTelemetry.assertEvent(
      Glean.translationsSelectTranslationsPanel.openSettingsMenu,
      {
        expectedEventCount: 1,
      }
    );

    SelectTranslationsTestUtils.clickTranslationsSettingsPageMenuItem();
    await waitForCondition(
      () => gBrowser.currentURI.spec === "about:preferences#general",
      "Waiting for about:preferences to be opened."
    );
    info("Remove the about:preferences tab");
    gBrowser.removeCurrentTab();

    await TestTranslationsTelemetry.assertEvent(
      Glean.translationsSelectTranslationsPanel.translationSettings,
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
      expectedEventCount: 1,
    });

    await cleanup();
  }
);
