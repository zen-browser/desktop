/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test case ensures that recently translated target languages are stored, filtered, and retrieved
 * properly when triggering multiple translations between the Full-Page Translations panel and the Select
 * Translations Panel in various combinations.
 */
add_task(
  async function test_recent_language_memory_with_full_page_and_select_translations() {
    const { cleanup, resolveDownloads, runInPage } = await loadTestPage({
      page: SELECT_TEST_PAGE_URL,
      languagePairs: LANGUAGE_PAIRS,
      prefs: [["browser.translations.select.enable", true]],
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

    await FullPageTranslationsTestUtils.clickTranslateButton({
      pivotTranslation: true,
      downloadHandler: resolveDownloads,
    });

    await FullPageTranslationsTestUtils.assertOnlyIntersectingNodesAreTranslated(
      {
        fromLanguage: "es",
        toLanguage: "fr",
        runInPage,
      }
    );

    await FullPageTranslationsTestUtils.openPanel({
      expectedToLanguage: "en",
      onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewRevisit,
    });

    await FullPageTranslationsTestUtils.clickRestoreButton();
    await FullPageTranslationsTestUtils.assertPageIsNotTranslated(runInPage);

    await SelectTranslationsTestUtils.openPanel(runInPage, {
      selectSpanishSentence: true,
      openAtSpanishSentence: true,
      expectedFromLanguage: "es",
      expectedToLanguage: "fr",
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
      onChangeLanguage: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    await SelectTranslationsTestUtils.clickTranslateFullPageButton();

    await FullPageTranslationsTestUtils.assertOnlyIntersectingNodesAreTranslated(
      {
        fromLanguage: "es",
        toLanguage: "fr",
        runInPage,
      }
    );

    await navigate("Navigate to a French page.", { url: FRENCH_PAGE_URL });

    await SelectTranslationsTestUtils.openPanel(runInPage, {
      selectH1: true,
      openAtH1: true,
      expectedFromLanguage: "fr",
      expectedToLanguage: "uk",
      pivotTranslation: true,
      downloadHandler: resolveDownloads,
      onOpenPanel: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    await SelectTranslationsTestUtils.clickDoneButton();

    await cleanup();
  }
);
