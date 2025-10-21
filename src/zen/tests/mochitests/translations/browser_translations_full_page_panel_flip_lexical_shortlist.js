/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test case tests translations in the FullPageTranslationsPanel with the
 * useLexicalShortlist pref initially set to false. It then toggles it to true,
 * and then back to false, ensuring that the correct models are downloaded, and
 * that the translations succeed with each flip of the pref.
 */
add_task(
  async function test_full_page_translations_panel_lexical_shortlist_starting_false() {
    const { tab, cleanup, resolveDownloads, runInPage } = await loadTestPage({
      page: SPANISH_PAGE_URL,
      languagePairs: LANGUAGE_PAIRS,
      prefs: [["browser.translations.useLexicalShortlist", false]],
    });

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

    await waitForTranslationModelRecordsChanged(() => {
      Services.prefs.setBoolPref(
        "browser.translations.useLexicalShortlist",
        true
      );
    });

    await openFindBar(tab);

    info(
      "Awaiting new downloads since the active TranslationsEngine will be rebuilt."
    );
    await resolveDownloads(1);

    await FullPageTranslationsTestUtils.assertAllPageContentIsTranslated({
      fromLanguage: "es",
      toLanguage: "en",
      runInPage,
    });
    await FullPageTranslationsTestUtils.assertPageH1TitleIsTranslated({
      fromLanguage: "es",
      toLanguage: "en",
      runInPage,
      message:
        "The page's H1's title should be translated because it intersects with the viewport.",
    });
    await FullPageTranslationsTestUtils.assertPageFinalParagraphTitleIsNotTranslated(
      {
        runInPage,
        message:
          "Attribute translations are always lazy based on intersection, so the final paragraph's title should remain untranslated.",
      }
    );

    await cleanup();
  }
);

/**
 * This test case tests translations in the FullPageTranslationsPanel with the
 * useLexicalShortlist pref initially set to true. It then toggles it to false,
 * and then back to true, ensuring that the correct models are downloaded, and
 * that the translations succeed with each flip of the pref.
 */
add_task(
  async function test_full_page_translations_panel_lexical_shortlist_starting_true() {
    const { tab, cleanup, resolveDownloads, runInPage } = await loadTestPage({
      page: SPANISH_PAGE_URL,
      languagePairs: LANGUAGE_PAIRS,
      prefs: [["browser.translations.useLexicalShortlist", true]],
    });

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

    await waitForTranslationModelRecordsChanged(() => {
      Services.prefs.setBoolPref(
        "browser.translations.useLexicalShortlist",
        false
      );
    });

    await openFindBar(tab);

    info(
      "Awaiting new downloads since the active TranslationsEngine will be rebuilt."
    );
    await resolveDownloads(1);

    await FullPageTranslationsTestUtils.assertAllPageContentIsTranslated({
      fromLanguage: "es",
      toLanguage: "en",
      runInPage,
    });
    await FullPageTranslationsTestUtils.assertPageH1TitleIsTranslated({
      fromLanguage: "es",
      toLanguage: "en",
      runInPage,
      message:
        "The page's H1's title should be translated because it intersects with the viewport.",
    });
    await FullPageTranslationsTestUtils.assertPageFinalParagraphTitleIsNotTranslated(
      {
        runInPage,
        message:
          "Attribute translations are always lazy based on intersection, so the final paragraph's title should remain untranslated.",
      }
    );

    await cleanup();
  }
);
