/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests the telemetry events for switching the from-language.
 */
add_task(async function test_translations_telemetry_switch_from_language() {
  const { cleanup, runInPage } = await loadTestPage({
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

  await FullPageTranslationsTestUtils.changeSelectedFromLanguage({
    langTag: "en",
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
    Glean.translationsPanel.changeFromLanguage,
    {
      expectedEventCount: 1,
      expectNewFlowId: false,
      assertForMostRecentEvent: {
        language: "en",
      },
    }
  );

  await FullPageTranslationsTestUtils.changeSelectedFromLanguage({
    langTag: "es",
  });

  await TestTranslationsTelemetry.assertEvent(
    Glean.translationsPanel.changeFromLanguage,
    {
      expectedEventCount: 2,
      expectNewFlowId: false,
      assertForMostRecentEvent: {
        language: "es",
      },
    }
  );

  await FullPageTranslationsTestUtils.changeSelectedFromLanguage({
    langTag: "",
  });

  await TestTranslationsTelemetry.assertEvent(
    Glean.translationsPanel.changeFromLanguage,
    {
      expectedEventCount: 2,
    }
  );

  await FullPageTranslationsTestUtils.changeSelectedFromLanguage({
    langTag: "en",
  });

  await TestTranslationsTelemetry.assertEvent(
    Glean.translationsPanel.changeFromLanguage,
    {
      expectedEventCount: 3,
      expectNewFlowId: false,
      assertForMostRecentEvent: {
        language: "en",
      },
    }
  );

  await TestTranslationsTelemetry.assertTranslationsEnginePerformance({
    expectedEventCount: 0,
  });

  await cleanup();
});

/**
 * Tests the telemetry events for switching the to-language.
 */
add_task(async function test_translations_telemetry_switch_to_language() {
  const { cleanup, runInPage } = await loadTestPage({
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

  await FullPageTranslationsTestUtils.changeSelectedToLanguage({
    langTag: "fr",
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
    Glean.translationsPanel.changeToLanguage,
    {
      expectedEventCount: 1,
      expectNewFlowId: false,
      assertForMostRecentEvent: {
        language: "fr",
      },
    }
  );

  await FullPageTranslationsTestUtils.changeSelectedToLanguage({
    langTag: "en",
  });

  await TestTranslationsTelemetry.assertEvent(
    Glean.translationsPanel.changeToLanguage,
    {
      expectedEventCount: 2,
      expectNewFlowId: false,
      assertForMostRecentEvent: {
        language: "en",
      },
    }
  );

  await FullPageTranslationsTestUtils.changeSelectedToLanguage({ langTag: "" });

  await TestTranslationsTelemetry.assertEvent(
    Glean.translationsPanel.changeToLanguage,
    {
      expectedEventCount: 2,
    }
  );

  await FullPageTranslationsTestUtils.changeSelectedToLanguage({
    langTag: "en",
  });

  await TestTranslationsTelemetry.assertEvent(
    Glean.translationsPanel.changeToLanguage,
    {
      expectedEventCount: 3,
      expectNewFlowId: false,
      assertForMostRecentEvent: {
        language: "en",
      },
    }
  );

  await TestTranslationsTelemetry.assertTranslationsEnginePerformance({
    expectedEventCount: 0,
  });

  await cleanup();
});
