/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test case verifies the data associated the change-from-language and change-to-language
 * telemetry events when changing selected the from-language menu item multiple times in different ways.
 */
add_task(
  async function test_select_translations_panel_change_from_language_multiple_times() {
    const { cleanup, runInPage, resolveDownloads } = await loadTestPage({
      page: SELECT_TEST_PAGE_URL,
      languagePairs: [
        { fromLang: "es", toLang: "en" },
        { fromLang: "en", toLang: "es" },
        { fromLang: "fa", toLang: "en" },
        { fromLang: "en", toLang: "fa" },
        { fromLang: "fi", toLang: "en" },
        { fromLang: "en", toLang: "fi" },
        { fromLang: "fr", toLang: "en" },
        { fromLang: "en", toLang: "fr" },
        { fromLang: "sl", toLang: "en" },
        { fromLang: "en", toLang: "sl" },
        { fromLang: "uk", toLang: "en" },
        { fromLang: "en", toLang: "uk" },
      ],
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
          source_text_code_units: 165,
          source_text_word_count: 28,
        },
      }
    );

    await SelectTranslationsTestUtils.changeSelectedFromLanguage(
      ["fi", "fr", "sl"],
      {
        openDropdownMenu: false,
        downloadHandler: resolveDownloads,
        onChangeLanguage: SelectTranslationsTestUtils.assertPanelViewTranslated,
      }
    );
    await TestTranslationsTelemetry.assertEvent(
      Glean.translationsSelectTranslationsPanel.changeFromLanguage,
      {
        expectedEventCount: 1,
        assertForMostRecentEvent: {
          language: "sl",
          previous_language: "es",
          document_language: "es",
        },
      }
    );
    await TestTranslationsTelemetry.assertEvent(
      Glean.translationsSelectTranslationsPanel.changeToLanguage,
      {
        expectedEventCount: 0,
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
          from_language: "sl",
          to_language: "en",
          top_preferred_language: "en-US",
          request_target: "select",
          auto_translate: false,
        },
      }
    );

    await SelectTranslationsTestUtils.changeSelectedFromLanguage(["uk", "fa"], {
      openDropdownMenu: true,
      downloadHandler: resolveDownloads,
      onChangeLanguage: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });
    await TestTranslationsTelemetry.assertEvent(
      Glean.translationsSelectTranslationsPanel.changeFromLanguage,
      {
        expectedEventCount: 3,
        assertForMostRecentEvent: {
          language: "fa",
          previous_language: "uk",
          document_language: "es",
        },
      }
    );
    await TestTranslationsTelemetry.assertEvent(
      Glean.translationsSelectTranslationsPanel.changeToLanguage,
      {
        expectedEventCount: 0,
      }
    );
    await TestTranslationsTelemetry.assertLabeledCounter(
      Glean.translations.requestCount,
      [
        ["full_page", 0],
        ["select", 4],
      ]
    );
    await TestTranslationsTelemetry.assertEvent(
      Glean.translations.translationRequest,
      {
        expectedEventCount: 4,
        assertForMostRecentEvent: {
          document_language: "es",
          from_language: "fa",
          to_language: "en",
          top_preferred_language: "en-US",
          request_target: "select",
          auto_translate: false,
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
        expectedEventCount: 1,
      }
    );

    await TestTranslationsTelemetry.assertTranslationsEnginePerformance({
      expectedEventCount: 4,
    });

    await cleanup();
  }
);

/**
 * This test case verifies the data associated the change-from-language and change-to-language
 * telemetry events when changing the selected to-language menu item multiple times in different ways.
 */
add_task(
  async function test_select_translations_panel_change_to_language_multiple_times() {
    const { cleanup, runInPage, resolveDownloads } = await loadTestPage({
      page: SELECT_TEST_PAGE_URL,
      languagePairs: [
        { fromLang: "es", toLang: "en" },
        { fromLang: "en", toLang: "es" },
        { fromLang: "fa", toLang: "en" },
        { fromLang: "en", toLang: "fa" },
        { fromLang: "fi", toLang: "en" },
        { fromLang: "en", toLang: "fi" },
        { fromLang: "fr", toLang: "en" },
        { fromLang: "en", toLang: "fr" },
        { fromLang: "sl", toLang: "en" },
        { fromLang: "en", toLang: "sl" },
        { fromLang: "uk", toLang: "en" },
        { fromLang: "en", toLang: "uk" },
      ],
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
          source_text_code_units: 165,
          source_text_word_count: 28,
        },
      }
    );

    await SelectTranslationsTestUtils.changeSelectedToLanguage(
      ["sl", "fi", "fa"],
      {
        openDropdownMenu: false,
        pivotTranslation: true,
        downloadHandler: resolveDownloads,
        onChangeLanguage: SelectTranslationsTestUtils.assertPanelViewTranslated,
      }
    );
    await TestTranslationsTelemetry.assertEvent(
      Glean.translationsSelectTranslationsPanel.changeFromLanguage,
      {
        expectedEventCount: 0,
      }
    );
    await TestTranslationsTelemetry.assertEvent(
      Glean.translationsSelectTranslationsPanel.changeToLanguage,
      {
        expectedEventCount: 1,
        assertForMostRecentEvent: {
          language: "fa",
        },
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
          from_language: "es",
          to_language: "fa",
          top_preferred_language: "en-US",
          request_target: "select",
          auto_translate: false,
          source_text_code_units: 165,
          source_text_word_count: 28,
        },
      }
    );

    await SelectTranslationsTestUtils.changeSelectedToLanguage(["fr", "uk"], {
      openDropdownMenu: true,
      pivotTranslation: true,
      downloadHandler: resolveDownloads,
      onChangeLanguage: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });
    await TestTranslationsTelemetry.assertEvent(
      Glean.translationsSelectTranslationsPanel.changeFromLanguage,
      {
        expectedEventCount: 0,
      }
    );
    await TestTranslationsTelemetry.assertEvent(
      Glean.translationsSelectTranslationsPanel.changeToLanguage,
      {
        expectedEventCount: 3,
        assertForMostRecentEvent: {
          language: "uk",
        },
      }
    );
    await TestTranslationsTelemetry.assertLabeledCounter(
      Glean.translations.requestCount,
      [
        ["full_page", 0],
        ["select", 4],
      ]
    );
    await TestTranslationsTelemetry.assertEvent(
      Glean.translations.translationRequest,
      {
        expectedEventCount: 4,
        assertForMostRecentEvent: {
          document_language: "es",
          from_language: "es",
          to_language: "uk",
          top_preferred_language: "en-US",
          request_target: "select",
          auto_translate: false,
          source_text_code_units: 165,
          source_text_word_count: 28,
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
        expectedEventCount: 1,
      }
    );

    await TestTranslationsTelemetry.assertTranslationsEnginePerformance({
      expectedEventCount: 4,
    });

    await cleanup();
  }
);
