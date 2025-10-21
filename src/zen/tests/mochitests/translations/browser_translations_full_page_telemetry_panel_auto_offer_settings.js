/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests that the automatic offering of the popup can be disabled.
 */
add_task(async function test_translations_panel_auto_offer_settings() {
  const { cleanup } = await loadTestPage({
    page: SPANISH_PAGE_URL,
    languagePairs: LANGUAGE_PAIRS,
    // Use the auto offer mechanics, but default the pref to the off position.
    autoOffer: true,
    prefs: [["browser.translations.automaticallyPopup", false]],
  });

  await FullPageTranslationsTestUtils.assertTranslationsButton(
    { button: true },
    "The translations button is shown."
  );

  await TestTranslationsTelemetry.assertEvent(Glean.translationsPanel.open, {
    expectedEventCount: 0,
  });

  await FullPageTranslationsTestUtils.openPanel({
    expectedFromLanguage: "es",
    expectedToLanguage: "en",
    onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewIntro,
  });
  await FullPageTranslationsTestUtils.openTranslationsSettingsMenu();
  await FullPageTranslationsTestUtils.assertIsAlwaysOfferTranslationsEnabled(
    false
  );

  await TestTranslationsTelemetry.assertEvent(Glean.translationsPanel.open, {
    expectedEventCount: 1,
    expectNewFlowId: true,
    assertForAllEvents: {
      auto_show: false,
      view_name: "defaultView",
      opened_from: "translationsButton",
      document_language: "es",
    },
  });

  await FullPageTranslationsTestUtils.clickAlwaysOfferTranslations();

  await TestTranslationsTelemetry.assertEvent(
    Glean.translationsPanel.alwaysOfferTranslations,
    {
      expectedEventCount: 1,
      expectNewFlowId: false,
      assertForAllEvents: {
        toggled_on: true,
      },
    }
  );

  await FullPageTranslationsTestUtils.openPanel({
    expectedFromLanguage: "es",
    expectedToLanguage: "en",
    onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewIntro,
  });
  await FullPageTranslationsTestUtils.assertIsAlwaysOfferTranslationsEnabled(
    true
  );

  await FullPageTranslationsTestUtils.clickCancelButton();

  await TestTranslationsTelemetry.assertEvent(Glean.translationsPanel.open, {
    expectedEventCount: 2,
    expectNewFlowId: true,
    assertForAllEvents: {
      auto_show: false,
      view_name: "defaultView",
      opened_from: "translationsButton",
      document_language: "es",
    },
  });

  await TestTranslationsTelemetry.assertEvent(
    Glean.translationsPanel.cancelButton,
    {
      expectedEventCount: 1,
      expectNewFlowId: false,
    }
  );

  await TestTranslationsTelemetry.assertEvent(Glean.translationsPanel.close, {
    expectedEventCount: 2,
    expectNewFlowId: false,
  });

  await navigate(
    "Wait for the popup to be shown when navigating to a different host.",
    {
      url: SPANISH_PAGE_URL_DOT_ORG,
      onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewIntro,
    }
  );

  await TestTranslationsTelemetry.assertEvent(Glean.translationsPanel.open, {
    expectedEventCount: 3,
    expectNewFlowId: true,
    assertForMostRecentEvent: {
      auto_show: true,
      view_name: "defaultView",
      opened_from: "translationsButton",
      document_language: "es",
    },
  });

  await TestTranslationsTelemetry.assertTranslationsEnginePerformance({
    expectedEventCount: 0,
  });

  await cleanup();
});
