/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test case ensures that elements with translatable content and attributes are
 * picked up and translated once they enter viewport proximity in lazy translations mode.
 */
add_task(
  async function test_nodes_entering_proximity_are_translated_in_lazy_mode() {
    const { cleanup, resolveDownloads, runInPage } = await loadTestPage({
      page: SPANISH_PAGE_URL,
      languagePairs: LANGUAGE_PAIRS,
    });

    await FullPageTranslationsTestUtils.assertTranslationsButton(
      { button: true },
      "The translations button is visible."
    );

    await FullPageTranslationsTestUtils.assertPageIsNotTranslated(runInPage);

    await FullPageTranslationsTestUtils.openPanel({
      expectedFromLanguage: "es",
      expectedToLanguage: "en",
      onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewIntro,
    });

    await FullPageTranslationsTestUtils.clickTranslateButton({
      downloadHandler: resolveDownloads,
    });

    await FullPageTranslationsTestUtils.assertOnlyIntersectingNodesAreTranslated(
      {
        fromLanguage: "es",
        toLanguage: "en",
        runInPage,
      }
    );

    await scrollToBottomOfPage(runInPage);

    await FullPageTranslationsTestUtils.assertPageFinalParagraphContentIsTranslated(
      {
        fromLanguage: "es",
        toLanguage: "en",
        runInPage,
      }
    );

    await FullPageTranslationsTestUtils.assertPageFinalParagraphTitleIsTranslated(
      {
        fromLanguage: "es",
        toLanguage: "en",
        runInPage,
      }
    );

    await cleanup();
  }
);

/**
 * This test case ensures that elements with translatable content and attributes that
 * exit viewport proximity are prevented from translating in lazy translations mode.
 */
add_task(
  async function test_nodes_exiting_proximity_before_translation_are_cancelled_in_lazy_mode() {
    const { cleanup, resolveDownloads, runInPage } = await loadTestPage({
      page: SPANISH_PAGE_URL,
      languagePairs: LANGUAGE_PAIRS,
    });

    await FullPageTranslationsTestUtils.assertTranslationsButton(
      { button: true },
      "The translations button is visible."
    );

    await FullPageTranslationsTestUtils.assertPageIsNotTranslated(runInPage);

    await FullPageTranslationsTestUtils.openPanel({
      expectedFromLanguage: "es",
      expectedToLanguage: "en",
      onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewIntro,
    });

    await FullPageTranslationsTestUtils.clickTranslateButton();

    await FullPageTranslationsTestUtils.waitForAnyRequestToInitialize(
      runInPage
    );

    await scrollToBottomOfPage(runInPage);

    await FullPageTranslationsTestUtils.assertPageH1ContentIsNotTranslated({
      runInPage,
    });
    await FullPageTranslationsTestUtils.assertPageH1TitleIsNotTranslated({
      runInPage,
    });
    await FullPageTranslationsTestUtils.assertPageFinalParagraphContentIsNotTranslated(
      {
        runInPage,
      }
    );
    await FullPageTranslationsTestUtils.assertPageFinalParagraphTitleIsNotTranslated(
      {
        runInPage,
      }
    );

    info("Resolving downloads after scrolling to the bottom of the page.");
    await resolveDownloads(1);

    await FullPageTranslationsTestUtils.assertPageFinalParagraphContentIsTranslated(
      {
        fromLanguage: "es",
        toLanguage: "en",
        runInPage,
      }
    );

    await FullPageTranslationsTestUtils.assertPageFinalParagraphTitleIsTranslated(
      {
        fromLanguage: "es",
        toLanguage: "en",
        runInPage,
      }
    );

    await FullPageTranslationsTestUtils.waitForAllPendingTranslationsToComplete(
      runInPage
    );

    await FullPageTranslationsTestUtils.assertPageH1ContentIsNotTranslated({
      runInPage,
      message: "The h1 left viewport proximity before its requests completed.",
    });
    await FullPageTranslationsTestUtils.assertPageH1TitleIsNotTranslated({
      runInPage,
      message: "The h1 left viewport proximity before its requests completed.",
    });

    await scrollToTopOfPage(runInPage);

    await FullPageTranslationsTestUtils.assertPageH1ContentIsTranslated({
      fromLanguage: "es",
      toLanguage: "en",
      runInPage,
    });

    await FullPageTranslationsTestUtils.assertPageH1TitleIsTranslated({
      fromLanguage: "es",
      toLanguage: "en",
      runInPage,
    });

    await cleanup();
  }
);
