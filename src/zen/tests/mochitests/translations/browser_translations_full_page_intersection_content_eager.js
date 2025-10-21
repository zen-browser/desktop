/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test case ensures that elements with attribute translations are still picked
 * up and translated once they are observed for intersection, even in content-eager mode.
 */
add_task(
  async function test_nodes_entering_proximity_are_translated_in_content_eager_mode() {
    const { cleanup, resolveDownloads, runInPage } = await loadTestPage({
      page: SPANISH_PAGE_URL,
      languagePairs: LANGUAGE_PAIRS,
      contentEagerMode: true,
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

    await FullPageTranslationsTestUtils.assertAllPageContentIsTranslated({
      fromLanguage: "es",
      toLanguage: "en",
      runInPage,
    });
    await FullPageTranslationsTestUtils.assertPageFinalParagraphTitleIsNotTranslated(
      {
        runInPage,
        message:
          "Attribute translations are always lazy based on intersection, so the final paragraph's title should remain untranslated.",
      }
    );

    await scrollToBottomOfPage(runInPage);

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
 * This test case ensures that translation requests for attributes leaving the viewport proximity are
 * cancelled, but translation requests for content are retained in content-eager mode, even though the
 * elements they belong to have left viewport proximity.
 */
add_task(
  async function test_nodes_exiting_proximity_before_translation_are_cancelled_in_content_eager_mode() {
    const { cleanup, resolveDownloads, runInPage } = await loadTestPage({
      page: SPANISH_PAGE_URL,
      languagePairs: LANGUAGE_PAIRS,
      contentEagerMode: true,
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
    await FullPageTranslationsTestUtils.assertPageH1ContentIsTranslated({
      fromLanguage: "es",
      toLanguage: "en",
      runInPage,
    });

    await FullPageTranslationsTestUtils.waitForAllPendingTranslationsToComplete(
      runInPage
    );

    await FullPageTranslationsTestUtils.assertPageH1TitleIsNotTranslated({
      runInPage,
      message:
        "Attribute translations are always lazy based on intersection, so the page h1's title should remain untranslated.",
    });

    await scrollToTopOfPage(runInPage);

    await FullPageTranslationsTestUtils.assertPageH1TitleIsTranslated({
      fromLanguage: "es",
      toLanguage: "en",
      runInPage,
    });

    await cleanup();
  }
);
