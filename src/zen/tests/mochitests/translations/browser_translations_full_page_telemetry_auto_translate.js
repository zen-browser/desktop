/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests the entire flow of opening the translation settings menu and initiating
 * an auto-translate requests.
 */
add_task(async function test_translations_telemetry_auto_translate() {
  const { cleanup, resolveDownloads, runInPage } = await loadTestPage({
    page: SPANISH_PAGE_URL,
    languagePairs: LANGUAGE_PAIRS,
  });

  await FullPageTranslationsTestUtils.assertTranslationsButton(
    { button: true },
    "The button is available."
  );

  await FullPageTranslationsTestUtils.assertPageIsNotTranslated(runInPage);

  await FullPageTranslationsTestUtils.openPanel({
    expectedFromLanguage: "es",
    expectedToLanguage: "en",
    onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewIntro,
  });
  await FullPageTranslationsTestUtils.openTranslationsSettingsMenu();
  await FullPageTranslationsTestUtils.clickAlwaysTranslateLanguage({
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
    Glean.translationsPanel.alwaysTranslateLanguage,
    {
      expectedEventCount: 1,
      expectNewFlowId: false,
      assertForMostRecentEvent: {
        language: "es",
      },
    }
  );
  await TestTranslationsTelemetry.assertEvent(Glean.translationsPanel.close, {
    expectedEventCount: 1,
    expectNewFlowId: false,
  });
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
        request_target: "full_page",
      },
    }
  );

  await FullPageTranslationsTestUtils.openPanel({
    expectedToLanguage: "en",
    onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewRevisit,
  });

  await FullPageTranslationsTestUtils.clickRestoreButton();

  await TestTranslationsTelemetry.assertEvent(Glean.translationsPanel.open, {
    expectedEventCount: 2,
    expectNewFlowId: true,
    assertForMostRecentEvent: {
      auto_show: false,
      view_name: "revisitView",
      opened_from: "translationsButton",
      document_language: "es",
    },
  });

  await TestTranslationsTelemetry.assertEvent(
    Glean.translationsPanel.restorePageButton,
    {
      expectedEventCount: 1,
      expectNewFlowId: false,
    }
  );

  await TestTranslationsTelemetry.assertEvent(Glean.translationsPanel.close, {
    expectedEventCount: 2,
    expectNewFlowId: false,
  });

  await FullPageTranslationsTestUtils.assertTranslationsButton(
    { button: true },
    "The button is available."
  );
  await FullPageTranslationsTestUtils.assertPageIsNotTranslated(runInPage);

  await TestTranslationsTelemetry.assertTranslationsEnginePerformance({
    expectedEventCount: 1,
  });

  await cleanup();
});
