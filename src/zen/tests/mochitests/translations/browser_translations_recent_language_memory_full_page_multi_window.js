/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test case ensures that recently translated target languages are stored, filtered, and retrieved
 * properly when triggering multiple translations from the Full-Page Translations panel in different windows.
 */
add_task(
  async function test_full_page_translations_panel_recent_language_memory_with_multiple_windows() {
    const window1 = window;
    const { runInPage, resolveDownloads, cleanup } = await loadTestPage({
      page: SPANISH_PAGE_URL,
      languagePairs: LANGUAGE_PAIRS,
    });

    const window2 = await BrowserTestUtils.openNewBrowserWindow();

    const testPage2 = await loadTestPage({
      win: window2,
      page: SPANISH_PAGE_URL,
      languagePairs: LANGUAGE_PAIRS,
    });

    await focusWindow(window1);

    await FullPageTranslationsTestUtils.assertTranslationsButton(
      { button: true },
      "The button is available."
    );

    await FullPageTranslationsTestUtils.assertPageIsNotTranslated(runInPage);

    await FullPageTranslationsTestUtils.openPanel({
      win: window1,
      expectedFromLanguage: "es",
      expectedToLanguage: "en",
      onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewIntro,
    });

    await FullPageTranslationsTestUtils.changeSelectedToLanguage({
      langTag: "uk",
      win: window1,
    });

    await FullPageTranslationsTestUtils.clickTranslateButton({
      win: window1,
      pivotTranslation: true,
      downloadHandler: resolveDownloads,
    });

    await FullPageTranslationsTestUtils.assertOnlyIntersectingNodesAreTranslated(
      {
        fromLanguage: "es",
        toLanguage: "uk",
        runInPage,
      }
    );

    await FullPageTranslationsTestUtils.openPanel({
      win: window1,
      expectedToLanguage: "en",
    });

    await focusWindow(window2);

    await FullPageTranslationsTestUtils.assertPageIsNotTranslated(
      testPage2.runInPage
    );

    await FullPageTranslationsTestUtils.openPanel({
      win: window2,
      expectedFromLanguage: "es",
      expectedToLanguage: "uk",
    });

    await FullPageTranslationsTestUtils.changeSelectedToLanguage({
      langTag: "fr",
      win: window2,
    });

    await FullPageTranslationsTestUtils.clickTranslateButton({
      win: window2,
      pivotTranslation: true,
      downloadHandler: resolveDownloads,
    });

    await FullPageTranslationsTestUtils.assertLangTagIsShownOnTranslationsButton(
      "es",
      "fr",
      window2
    );

    await focusWindow(window1);

    await FullPageTranslationsTestUtils.assertOnlyIntersectingNodesAreTranslated(
      {
        fromLanguage: "es",
        toLanguage: "uk",
        runInPage,
      }
    );

    await FullPageTranslationsTestUtils.openPanel({
      win: window1,
      expectedToLanguage: "fr",
      onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewRevisit,
    });

    await FullPageTranslationsTestUtils.clickTranslateButton({
      win: window1,
    });

    await FullPageTranslationsTestUtils.assertOnlyIntersectingNodesAreTranslated(
      {
        fromLanguage: "es",
        toLanguage: "fr",
        runInPage,
      }
    );

    await testPage2.cleanup();
    await BrowserTestUtils.closeWindow(window2);
    await cleanup();
  }
);
