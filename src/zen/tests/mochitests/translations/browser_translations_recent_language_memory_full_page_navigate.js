/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test case ensures that recently translated target languages are stored, filtered, and retrieved
 * properly when triggering multiple translations from the Full-Page Translations panel when navigating
 * between different pages in the same window.
 */
add_task(
  async function test_full_page_translations_panel_recent_language_memory_when_navigating() {
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

    await navigate("Navigate to a French page.", { url: FRENCH_PAGE_URL });

    await FullPageTranslationsTestUtils.openPanel({
      expectedFromLanguage: "fr",
      expectedToLanguage: "en",
      onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewDefault,
    });

    await FullPageTranslationsTestUtils.changeSelectedToLanguage({
      langTag: "es",
    });
    await FullPageTranslationsTestUtils.clickTranslateButton({
      pivotTranslation: true,
      downloadHandler: resolveDownloads,
    });

    await FullPageTranslationsTestUtils.assertLangTagIsShownOnTranslationsButton(
      "fr",
      "es"
    );

    await navigate("Navigate to a Spanish page.", { url: SPANISH_PAGE_URL });

    await FullPageTranslationsTestUtils.openPanel({
      expectedFromLanguage: "es",
      expectedToLanguage: "fr",
      onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewDefault,
    });

    await FullPageTranslationsTestUtils.clickCancelButton();

    await navigate("Navigate to an English page.", { url: ENGLISH_PAGE_URL });

    await FullPageTranslationsTestUtils.assertTranslationsButton(
      { button: false },
      "The button is not available."
    );

    await FullPageTranslationsTestUtils.openPanel({
      openFromAppMenu: true,
      expectedFromLanguage: "en",
      expectedToLanguage: "es",
      onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewDefault,
    });

    await FullPageTranslationsTestUtils.clickTranslateButton({
      downloadHandler: resolveDownloads,
    });

    await FullPageTranslationsTestUtils.assertLangTagIsShownOnTranslationsButton(
      "en",
      "es"
    );

    await cleanup();
  }
);
