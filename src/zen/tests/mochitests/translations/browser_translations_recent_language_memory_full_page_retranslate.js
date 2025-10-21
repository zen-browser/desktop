/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test case ensures that recently translated target languages are stored, filtered, and retrieved
 * properly when triggering multiple translations from the Full-Page Translations panel on the same page.
 */
add_task(
  async function test_full_page_translations_panel_recent_language_memory_on_retranslate() {
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
      langTag: "uk",
    });

    await FullPageTranslationsTestUtils.clickTranslateButton({
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
      expectedToLanguage: "en",
      onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewRevisit,
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
      expectedToLanguage: "uk",
      onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewRevisit,
    });

    await FullPageTranslationsTestUtils.clickRestoreButton();
    await FullPageTranslationsTestUtils.assertPageIsNotTranslated(runInPage);

    await FullPageTranslationsTestUtils.openPanel({
      expectedFromLanguage: "es",
      expectedToLanguage: "fr",
      onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewDefault,
    });
    await FullPageTranslationsTestUtils.clickCancelButton();

    await cleanup();
  }
);
