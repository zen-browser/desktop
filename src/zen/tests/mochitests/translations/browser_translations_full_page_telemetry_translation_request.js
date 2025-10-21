/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests the telemetry event for a manual translation request.
 */
add_task(async function test_translations_telemetry_manual_translation() {
  const { cleanup, resolveDownloads, runInPage } = await loadTestPage({
    page: SPANISH_PAGE_URL,
    languagePairs: LANGUAGE_PAIRS,
  });

  await FullPageTranslationsTestUtils.assertTranslationsButton(
    { button: true, circleArrows: false, locale: false, icon: true },
    "The button is available."
  );

  await FullPageTranslationsTestUtils.assertPageIsNotTranslated(runInPage);

  await TestTranslationsTelemetry.assertEvent(
    Glean.translations.translationRequest,
    {
      expectedEventCount: 0,
    }
  );

  await FullPageTranslationsTestUtils.openPanel({
    expectedFromLanguage: "es",
    expectedToLanguage: "en",
    onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewIntro,
  });

  await FullPageTranslationsTestUtils.clickTranslateButton({
    downloadHandler: resolveDownloads,
  });

  await FullPageTranslationsTestUtils.assertOnlyIntersectingNodesAreTranslated({
    fromLanguage: "es",
    toLanguage: "en",
    runInPage,
  });

  await TestTranslationsTelemetry.assertEvent(Glean.translationsPanel.open, {
    expectedEventCount: 1,
    expectNewFlowId: true,
    assertForMostRecentEvent: {
      auto_show: false,
      view_name: "defaultView",
      opened_from: "translationsButton",
      document_language: "es",
    },
  });
  await TestTranslationsTelemetry.assertEvent(
    Glean.translationsPanel.translateButton,
    {
      expectedEventCount: 1,
      expectNewFlowId: false,
    }
  );
  await TestTranslationsTelemetry.assertEvent(Glean.translationsPanel.close, {
    expectedEventCount: 1,
    expectNewFlowId: false,
  });
  await TestTranslationsTelemetry.assertLabeledCounter(
    Glean.translations.requestCount,
    [
      ["full_page", 1],
      ["select", 0],
    ]
  );
  await TestTranslationsTelemetry.assertEvent(
    Glean.translations.translationRequest,
    {
      expectedEventCount: 1,
      expectNewFlowId: false,
      assertForMostRecentEvent: {
        from_language: "es",
        to_language: "en",
        auto_translate: false,
        document_language: "es",
        top_preferred_language: "en-US",
        request_target: "full_page",
      },
    }
  );

  await TestTranslationsTelemetry.assertTranslationsEnginePerformance({
    expectedEventCount: 1,
  });

  await cleanup();
});

/**
 * Tests the telemetry event for an automatic translation request.
 */
add_task(async function test_translations_telemetry_auto_translation() {
  const { cleanup, resolveDownloads, runInPage } = await loadTestPage({
    page: BLANK_PAGE,
    languagePairs: LANGUAGE_PAIRS,
    prefs: [["browser.translations.alwaysTranslateLanguages", "es"]],
  });

  await navigate("Navigate to a Spanish page", {
    url: SPANISH_PAGE_URL,
    downloadHandler: resolveDownloads,
  });

  await FullPageTranslationsTestUtils.assertOnlyIntersectingNodesAreTranslated({
    fromLanguage: "es",
    toLanguage: "en",
    runInPage,
  });

  await TestTranslationsTelemetry.assertEvent(Glean.translationsPanel.open, {
    expectedEventCount: 0,
  });
  await TestTranslationsTelemetry.assertEvent(
    Glean.translationsPanel.translateButton,
    {
      expectedEventCount: 0,
    }
  );
  await TestTranslationsTelemetry.assertEvent(Glean.translationsPanel.close, {
    expectedEventCount: 0,
  });
  await TestTranslationsTelemetry.assertLabeledCounter(
    Glean.translations.requestCount,
    [
      ["full_page", 1],
      ["select", 0],
    ]
  );
  await TestTranslationsTelemetry.assertEvent(
    Glean.translations.translationRequest,
    {
      expectedEventCount: 1,
      expectNewFlowId: true,
      assertForMostRecentEvent: {
        from_language: "es",
        to_language: "en",
        auto_translate: true,
        document_language: "es",
        top_preferred_language: "en-US",
        request_target: "full_page",
      },
    }
  );

  await TestTranslationsTelemetry.assertTranslationsEnginePerformance({
    expectedEventCount: 1,
  });

  await cleanup();
});
