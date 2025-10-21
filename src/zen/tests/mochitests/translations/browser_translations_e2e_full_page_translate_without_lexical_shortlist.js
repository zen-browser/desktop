/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests that Lazy Full Page Translations work from Spanish to English work when
 * loading pre-downloaded model and WASM artifacts from the file system with
 * the useLexicalShortlist pref turned off.
 */
add_task(
  async function test_lazy_full_page_translate_end_to_end_with_lexical_shortlist() {
    const { cleanup, runInPage } = await loadTestPage({
      endToEndTest: true,
      page: SPANISH_PAGE_URL,
      languagePairs: LANGUAGE_PAIRS,
      prefs: [["browser.translations.useLexicalShortlist", false]],
    });

    await FullPageTranslationsTestUtils.assertTranslationsButton(
      { button: true, circleArrows: false, locale: false, icon: true },
      "The button is available."
    );

    await FullPageTranslationsTestUtils.assertPageIsNotTranslated(runInPage);

    await FullPageTranslationsTestUtils.openPanel({
      expectedFromLanguage: "es",
      expectedToLanguage: "en",
      onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewIntro,
    });

    await FullPageTranslationsTestUtils.clickTranslateButton();
    await FullPageTranslationsTestUtils.assertOnlyIntersectingNodesAreTranslated(
      {
        endToEndTest: true,
        fromLanguage: "es",
        toLanguage: "en",
        runInPage,
      }
    );

    await cleanup();
  }
);

/**
 * Tests that Content-Eager Full Page Translations work from Spanish to English work
 * when loading pre-downloaded model and WASM artifacts from the file system with
 * the useLexicalShortlist pref turned off.
 */
add_task(
  async function test_content_eager_full_page_translate_end_to_end_with_lexical_shortlist() {
    const { cleanup, runInPage } = await loadTestPage({
      endToEndTest: true,
      page: SPANISH_PAGE_URL,
      languagePairs: LANGUAGE_PAIRS,
      contentEagerMode: true,
      prefs: [["browser.translations.useLexicalShortlist", false]],
    });

    await FullPageTranslationsTestUtils.assertTranslationsButton(
      { button: true, circleArrows: false, locale: false, icon: true },
      "The button is available."
    );

    await FullPageTranslationsTestUtils.assertPageIsNotTranslated(runInPage);

    await FullPageTranslationsTestUtils.openPanel({
      expectedFromLanguage: "es",
      expectedToLanguage: "en",
      onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewIntro,
    });

    await FullPageTranslationsTestUtils.clickTranslateButton();
    await FullPageTranslationsTestUtils.assertAllPageContentIsTranslated({
      endToEndTest: true,
      fromLanguage: "es",
      toLanguage: "en",
      runInPage,
    });
    await FullPageTranslationsTestUtils.assertPageH1TitleIsTranslated({
      endToEndTest: true,
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
