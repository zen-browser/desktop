/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test case ensures that the SelectTranslationsPanel translate-full-page button can be invoked with the Enter key.
 */
add_task(
  async function test_select_translations_panel_invoke_translate_full_page_button_with_enter_key() {
    const { cleanup, runInPage, resolveDownloads } = await loadTestPage({
      page: SELECT_TEST_PAGE_URL,
      languagePairs: LANGUAGE_PAIRS,
      prefs: [["browser.translations.select.enable", true]],
    });

    await SelectTranslationsTestUtils.openPanel(runInPage, {
      selectSpanishSection: true,
      openAtSpanishSection: true,
      expectedFromLanguage: "es",
      expectedToLanguage: "en",
      downloadHandler: resolveDownloads,
      onOpenPanel: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    const fullPageTranslationCompletePromise =
      FullPageTranslationsTestUtils.assertTranslationsButton(
        { button: true, circleArrows: false, locale: true, icon: true },
        "The icon presents the locale."
      );

    focusElementAndSynthesizeKey(
      SelectTranslationsPanel.elements.translateFullPageButton,
      "KEY_Enter"
    );

    await fullPageTranslationCompletePromise;
    await FullPageTranslationsTestUtils.assertOnlyIntersectingNodesAreTranslated(
      {
        fromLanguage: "es",
        toLanguage: "en",
        runInPage,
      }
    );

    await closeAllOpenPanelsAndMenus();

    await TestTranslationsTelemetry.assertEvent(
      Glean.translationsSelectTranslationsPanel.translateFullPageButton,
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

/**
 * This test case ensures that the SelectTranslationsPanel translate-full-page button can be invoked with the space bar.
 */
add_task(
  async function test_select_translations_panel_invoke_translate_full_page_button_with_space_bar() {
    const { cleanup, runInPage, resolveDownloads } = await loadTestPage({
      page: SELECT_TEST_PAGE_URL,
      languagePairs: LANGUAGE_PAIRS,
      prefs: [["browser.translations.select.enable", true]],
    });

    await SelectTranslationsTestUtils.openPanel(runInPage, {
      selectFrenchSentence: true,
      openAtFrenchSentence: true,
      expectedFromLanguage: "fr",
      expectedToLanguage: "en",
      downloadHandler: resolveDownloads,
      onOpenPanel: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    const fullPageTranslationCompletePromise =
      FullPageTranslationsTestUtils.assertTranslationsButton(
        { button: true, circleArrows: false, locale: true, icon: true },
        "The icon presents the locale."
      );

    focusElementAndSynthesizeKey(
      SelectTranslationsPanel.elements.translateFullPageButton,
      " "
    );

    await fullPageTranslationCompletePromise;
    await FullPageTranslationsTestUtils.assertOnlyIntersectingNodesAreTranslated(
      {
        fromLanguage: "fr",
        toLanguage: "en",
        runInPage,
      }
    );

    await closeAllOpenPanelsAndMenus();

    await TestTranslationsTelemetry.assertEvent(
      Glean.translationsSelectTranslationsPanel.translateFullPageButton,
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
