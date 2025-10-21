/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test case ensures that the SelectTranslationsPanel translate button can be invoked with the Enter key.
 */
add_task(
  async function test_select_translations_panel_invoke_translate_button_with_enter_key() {
    const { cleanup, runInPage, resolveDownloads } = await loadTestPage({
      page: SELECT_TEST_PAGE_URL,
      languagePairs: [
        // Do not include French.
        { fromLang: "uk", toLang: "en" },
        { fromLang: "en", toLang: "uk" },
      ],
      prefs: [["browser.translations.select.enable", true]],
    });

    await SelectTranslationsTestUtils.openPanel(runInPage, {
      selectFrenchSection: true,
      openAtFrenchSection: true,
      onOpenPanel:
        SelectTranslationsTestUtils.assertPanelViewUnsupportedLanguage,
    });

    await SelectTranslationsTestUtils.changeSelectedTryAnotherSourceLanguage(
      "uk"
    );

    const translatablePhasePromise =
      SelectTranslationsTestUtils.waitForPanelState("translatable");
    focusElementAndSynthesizeKey(
      SelectTranslationsPanel.elements.translateButton,
      "KEY_Enter"
    );
    await translatablePhasePromise;

    await SelectTranslationsTestUtils.handleDownloads({
      downloadHandler: resolveDownloads,
    });
    await SelectTranslationsTestUtils.assertPanelViewTranslated();

    await closeAllOpenPanelsAndMenus();

    await TestTranslationsTelemetry.assertEvent(
      Glean.translationsSelectTranslationsPanel.translateButton,
      {
        expectedEventCount: 1,
        assertForMostRecentEvent: {
          detected_language: "fr",
          from_language: "uk",
          to_language: "en",
        },
      }
    );

    await TestTranslationsTelemetry.assertTranslationsEnginePerformance({
      expectedEventCount: 1,
    });

    await cleanup();
  }
);

/**
 * This test case ensures that the SelectTranslationsPanel translate button can be invoked with the space bar.
 */
add_task(
  async function test_select_translations_panel_invoke_translate_button_with_space_bar() {
    const { cleanup, runInPage, resolveDownloads } = await loadTestPage({
      page: SELECT_TEST_PAGE_URL,
      languagePairs: [
        // Do not include Spanish.
        { fromLang: "fr", toLang: "en" },
        { fromLang: "en", toLang: "fr" },
      ],
      prefs: [["browser.translations.select.enable", true]],
    });

    await SelectTranslationsTestUtils.openPanel(runInPage, {
      selectSpanishSection: true,
      openAtSpanishSection: true,
      onOpenPanel:
        SelectTranslationsTestUtils.assertPanelViewUnsupportedLanguage,
    });

    await SelectTranslationsTestUtils.changeSelectedTryAnotherSourceLanguage(
      "fr"
    );

    const translatablePhasePromise =
      SelectTranslationsTestUtils.waitForPanelState("translatable");
    focusElementAndSynthesizeKey(
      SelectTranslationsPanel.elements.translateButton,
      " "
    );
    await translatablePhasePromise;

    await SelectTranslationsTestUtils.handleDownloads({
      downloadHandler: resolveDownloads,
    });
    await SelectTranslationsTestUtils.assertPanelViewTranslated();

    await closeAllOpenPanelsAndMenus();

    await TestTranslationsTelemetry.assertEvent(
      Glean.translationsSelectTranslationsPanel.translateButton,
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
