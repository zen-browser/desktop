/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test case tests the edge-case scenario where, through keyboard navigation, a user is technically
 * able to change both the from-language and the to-language value before triggering a re-translation.
 * We want to make sure in this situation that both telemetry events for a changed from-language and
 * for a changed to-language fire.
 *
 * The test covers all three methods of triggering the translation:
 *  - Pressing the Enter key with the from-menulist focused.
 *  - Pressing the Enter key with the to-menulist focused.
 *  - Tabbing to focus the textarea after a language has been changed.
 */
add_task(
  async function test_select_translations_panel_change_from_and_to_languages_before_retranslation() {
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

    const { fromMenuList, toMenuList } = SelectTranslationsPanel.elements;

    info(
      "Changing both the from-language and to-language before triggering translation."
    );
    fromMenuList.value = "fr";
    toMenuList.value = "uk";
    await TestTranslationsTelemetry.assertEvent(
      Glean.translationsSelectTranslationsPanel.changeFromLanguage,
      {
        expectedEventCount: 0,
      }
    );
    await TestTranslationsTelemetry.assertEvent(
      Glean.translationsSelectTranslationsPanel.changeToLanguage,
      {
        expectedEventCount: 0,
      }
    );

    {
      info(
        "Triggering a single translation with both updated languages via Enter key on from-menulist."
      );
      const translatablePhasePromise =
        SelectTranslationsTestUtils.waitForPanelState("translatable");
      focusElementAndSynthesizeKey(fromMenuList, "KEY_Enter");
      await translatablePhasePromise;

      await SelectTranslationsTestUtils.handleDownloads({
        pivotTranslation: true,
        downloadHandler: resolveDownloads,
      });
      await SelectTranslationsTestUtils.assertPanelViewTranslated();

      await TestTranslationsTelemetry.assertEvent(
        Glean.translationsSelectTranslationsPanel.changeFromLanguage,
        {
          expectedEventCount: 1,
          assertForMostRecentEvent: {
            language: "fr",
            previous_language: "es",
            document_language: "es",
          },
        }
      );
      await TestTranslationsTelemetry.assertEvent(
        Glean.translationsSelectTranslationsPanel.changeToLanguage,
        {
          expectedEventCount: 1,
          assertForMostRecentEvent: {
            language: "uk",
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
            from_language: "fr",
            to_language: "uk",
            top_preferred_language: "en-US",
            request_target: "select",
            auto_translate: false,
          },
        }
      );
    }

    {
      info(
        "Changing both the from-language and to-language before triggering translation."
      );
      fromMenuList.value = "fa";
      toMenuList.value = "en";
      await TestTranslationsTelemetry.assertEvent(
        Glean.translationsSelectTranslationsPanel.changeFromLanguage,
        {
          expectedEventCount: 1,
        }
      );
      await TestTranslationsTelemetry.assertEvent(
        Glean.translationsSelectTranslationsPanel.changeToLanguage,
        {
          expectedEventCount: 1,
        }
      );

      info(
        "Triggering a single translation with both updated languages via Enter key on to-menulist."
      );
      const translatablePhasePromise =
        SelectTranslationsTestUtils.waitForPanelState("translatable");
      focusElementAndSynthesizeKey(toMenuList, "KEY_Enter");
      await translatablePhasePromise;

      await SelectTranslationsTestUtils.handleDownloads({
        downloadHandler: resolveDownloads,
      });
      await SelectTranslationsTestUtils.assertPanelViewTranslated();

      await TestTranslationsTelemetry.assertEvent(
        Glean.translationsSelectTranslationsPanel.changeFromLanguage,
        {
          expectedEventCount: 2,
          assertForMostRecentEvent: {
            language: "fa",
            previous_language: "fr",
            document_language: "es",
          },
        }
      );
      await TestTranslationsTelemetry.assertEvent(
        Glean.translationsSelectTranslationsPanel.changeToLanguage,
        {
          expectedEventCount: 2,
          assertForMostRecentEvent: {
            language: "en",
          },
        }
      );
      await TestTranslationsTelemetry.assertLabeledCounter(
        Glean.translations.requestCount,
        [
          ["full_page", 0],
          ["select", 3],
        ]
      );
      await TestTranslationsTelemetry.assertEvent(
        Glean.translations.translationRequest,
        {
          expectedEventCount: 3,
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
    }

    {
      info(
        "Changing both the from-language and to-language before triggering translation."
      );
      fromMenuList.value = "sl";
      toMenuList.value = "fi";
      await TestTranslationsTelemetry.assertEvent(
        Glean.translationsSelectTranslationsPanel.changeFromLanguage,
        {
          expectedEventCount: 2,
        }
      );
      await TestTranslationsTelemetry.assertEvent(
        Glean.translationsSelectTranslationsPanel.changeToLanguage,
        {
          expectedEventCount: 2,
        }
      );

      info(
        "Triggering a single translation with both updated languages via Tab key on to-menulist."
      );
      const translatablePhasePromise =
        SelectTranslationsTestUtils.waitForPanelState("translatable");
      focusElementAndSynthesizeKey(toMenuList, "KEY_Tab");
      await translatablePhasePromise;

      await SelectTranslationsTestUtils.handleDownloads({
        pivotTranslation: true,
        downloadHandler: resolveDownloads,
      });
      await SelectTranslationsTestUtils.assertPanelViewTranslated();

      await TestTranslationsTelemetry.assertEvent(
        Glean.translationsSelectTranslationsPanel.changeFromLanguage,
        {
          expectedEventCount: 3,
          assertForMostRecentEvent: {
            language: "sl",
            previous_language: "fa",
            document_language: "es",
          },
        }
      );
      await TestTranslationsTelemetry.assertEvent(
        Glean.translationsSelectTranslationsPanel.changeToLanguage,
        {
          expectedEventCount: 3,
          assertForMostRecentEvent: {
            language: "fi",
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
            from_language: "sl",
            to_language: "fi",
            top_preferred_language: "en-US",
            request_target: "select",
            auto_translate: false,
          },
        }
      );
    }

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
