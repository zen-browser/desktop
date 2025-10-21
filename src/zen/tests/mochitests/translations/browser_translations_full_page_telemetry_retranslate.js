/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests the telemetry events for retranslating a page from the revisit view.
 */
add_task(async function test_translations_telemetry_retranslate() {
  const { cleanup, resolveDownloads, runInPage } = await loadTestPage({
    page: SPANISH_PAGE_URL,
    languagePairs: LANGUAGE_PAIRS,
  });

  await FullPageTranslationsTestUtils.assertTranslationsButton(
    { button: true, circleArrows: false, locale: false, icon: true },
    "The button is available."
  );

  await FullPageTranslationsTestUtils.assertPageIsNotTranslated(runInPage);

  await FullPageTranslationsTestUtils.openPanel({
    onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewIntro,
  });

  await FullPageTranslationsTestUtils.changeSelectedFromLanguage({
    langTag: "fr",
  });

  await FullPageTranslationsTestUtils.clickTranslateButton({
    downloadHandler: resolveDownloads,
  });

  await FullPageTranslationsTestUtils.assertOnlyIntersectingNodesAreTranslated({
    fromLanguage: "fr",
    toLanguage: "en",
    runInPage,
  });

  await TestTranslationsTelemetry.assertLabeledCounter(
    Glean.translations.requestCount,
    [
      ["full_page", 1],
      ["select", 0],
    ]
  );
  await TestTranslationsTelemetry.assertEvent(Glean.translationsPanel.open, {
    expectNewFlowId: true,
    expectedEventCount: 1,
    assertForMostRecentEvent: {
      auto_show: false,
      view_name: "defaultView",
      opened_from: "translationsButton",
      document_language: "es",
    },
  });
  await TestTranslationsTelemetry.assertEvent(
    Glean.translationsPanel.changeFromLanguage,
    {
      expectedEventCount: 1,
      assertForMostRecentEvent: {
        language: "fr",
      },
    }
  );
  await TestTranslationsTelemetry.assertEvent(
    Glean.translationsPanel.translateButton,
    {
      expectedEventCount: 1,
    }
  );
  await TestTranslationsTelemetry.assertEvent(Glean.translationsPanel.close, {
    expectedEventCount: 1,
  });
  await TestTranslationsTelemetry.assertEvent(
    Glean.translations.translationRequest,
    {
      expectedEventCount: 1,
      assertForMostRecentEvent: {
        from_language: "fr",
        to_language: "en",
        auto_translate: false,
        document_language: "es",
        top_preferred_language: "en-US",
        request_target: "full_page",
      },
    }
  );

  await FullPageTranslationsTestUtils.openPanel({
    onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewRevisit,
  });

  await FullPageTranslationsTestUtils.changeSelectedToLanguage({
    langTag: "uk",
  });

  await FullPageTranslationsTestUtils.clickTranslateButton({
    pivotTranslation: true,
    downloadHandler: resolveDownloads,
  });

  await FullPageTranslationsTestUtils.assertOnlyIntersectingNodesAreTranslated({
    fromLanguage: "fr",
    toLanguage: "uk",
    runInPage,
  });

  await TestTranslationsTelemetry.assertLabeledCounter(
    Glean.translations.requestCount,
    [
      ["full_page", 2],
      ["select", 0],
    ]
  );
  await TestTranslationsTelemetry.assertEvent(Glean.translationsPanel.open, {
    expectNewFlowId: true,
    expectedEventCount: 2,
    assertForMostRecentEvent: {
      auto_show: false,
      view_name: "revisitView",
      opened_from: "translationsButton",
      document_language: "es",
    },
  });
  await TestTranslationsTelemetry.assertEvent(
    Glean.translationsPanel.changeToLanguage,
    {
      expectedEventCount: 1,
      assertForMostRecentEvent: {
        language: "uk",
      },
    }
  );
  await TestTranslationsTelemetry.assertEvent(
    Glean.translationsPanel.translateButton,
    {
      expectedEventCount: 2,
    }
  );
  await TestTranslationsTelemetry.assertEvent(Glean.translationsPanel.close, {
    expectedEventCount: 2,
  });
  await TestTranslationsTelemetry.assertEvent(
    Glean.translations.translationRequest,
    {
      expectedEventCount: 2,
      assertForMostRecentEvent: {
        from_language: "fr",
        to_language: "uk",
        auto_translate: false,
        document_language: "es",
        top_preferred_language: "en",
        request_target: "full_page",
      },
    }
  );

  await TestTranslationsTelemetry.assertTranslationsEnginePerformance({
    expectedEventCount: 2,
  });

  await cleanup();
});
