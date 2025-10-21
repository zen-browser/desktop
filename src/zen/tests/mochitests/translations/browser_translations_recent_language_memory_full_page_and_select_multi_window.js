/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test case ensures that recently translated target languages are stored, filtered, and retrieved
 * properly when triggering multiple translations from the Full-Page Translations panel and the Select
 * Translations panel in different windows.
 */
add_task(
  async function test_recent_language_memory_with_full_page_and_select_translations_multi_window() {
    const window1 = window;
    const { runInPage, resolveDownloads, cleanup } = await loadTestPage({
      page: SELECT_TEST_PAGE_URL,
      languagePairs: LANGUAGE_PAIRS,
      prefs: [["browser.translations.select.enable", true]],
    });

    const window2 = await BrowserTestUtils.openNewBrowserWindow();

    const testPage2 = await loadTestPage({
      win: window2,
      page: FRENCH_PAGE_URL,
      languagePairs: LANGUAGE_PAIRS,
    });

    await focusWindow(window1);

    await SelectTranslationsTestUtils.openPanel(runInPage, {
      selectSpanishSentence: true,
      openAtSpanishSentence: true,
      expectedFromLanguage: "es",
      expectedToLanguage: "en",
      downloadHandler: resolveDownloads,
      onOpenPanel: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    await SelectTranslationsTestUtils.changeSelectedToLanguage(["uk"], {
      openDropdownMenu: true,
      pivotTranslation: true,
      downloadHandler: resolveDownloads,
      onChangeLanguage: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    await SelectTranslationsTestUtils.changeSelectedToLanguage(["fr"], {
      openDropdownMenu: true,
      pivotTranslation: true,
      downloadHandler: resolveDownloads,
      onChangeLanguage: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    await SelectTranslationsTestUtils.clickDoneButton();

    await focusWindow(window2);

    await FullPageTranslationsTestUtils.openPanel({
      expectedFromLanguage: "fr",
      expectedToLanguage: "uk",
      win: window2,
    });

    await FullPageTranslationsTestUtils.changeSelectedToLanguage({
      langTag: "es",
      win: window2,
    });

    await FullPageTranslationsTestUtils.clickTranslateButton({
      win: window2,
      pivotTranslation: true,
      downloadHandler: resolveDownloads,
    });

    await FullPageTranslationsTestUtils.assertLangTagIsShownOnTranslationsButton(
      "fr",
      "es",
      window2
    );

    await focusWindow(window1);

    await SelectTranslationsTestUtils.openPanel(runInPage, {
      selectSpanishSection: true,
      openAtSpanishSection: true,
      expectedFromLanguage: "es",
      expectedToLanguage: "fr",
      onOpenPanel: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    await SelectTranslationsTestUtils.clickDoneButton();

    await SelectTranslationsTestUtils.openPanel(runInPage, {
      selectFrenchSentence: true,
      openAtFrenchSentence: true,
      expectedFromLanguage: "fr",
      expectedToLanguage: "es",
      onOpenPanel: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    await SelectTranslationsTestUtils.changeSelectedToLanguage(["en"], {
      openDropdownMenu: true,
      downloadHandler: resolveDownloads,
      onChangeLanguage: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    await SelectTranslationsTestUtils.clickDoneButton();

    await focusWindow(window2);

    await FullPageTranslationsTestUtils.assertLangTagIsShownOnTranslationsButton(
      "fr",
      "es",
      window2
    );

    await FullPageTranslationsTestUtils.openPanel({
      expectedToLanguage: "en",
      win: window2,
    });

    await FullPageTranslationsTestUtils.clickTranslateButton({
      win: window2,
    });

    await FullPageTranslationsTestUtils.assertLangTagIsShownOnTranslationsButton(
      "fr",
      "en",
      window2
    );

    await testPage2.cleanup();
    await BrowserTestUtils.closeWindow(window2);
    await cleanup();
  }
);
