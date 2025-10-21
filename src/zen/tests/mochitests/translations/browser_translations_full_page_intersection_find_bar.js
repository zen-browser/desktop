/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test case ensures that opening the FindBar on a page where Full-Page Translations
 * is already active will enter into content-eager translations mode, allowing all content
 * translations on the page to be fulfilled while attribute translations remain lazy based
 * on proximity with the viewport.
 */
add_task(
  async function test_findbar_open_switches_to_content_eager_mode_from_lazy_mode() {
    const { cleanup, resolveDownloads, runInPage, tab } = await loadTestPage({
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

    info(
      "Opening the find bar, which should switch us into content eager mode."
    );
    await openFindBar(tab);

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

    info("Mutating the H1 text content and title attribute.");
    await runInPage(async TranslationsTest => {
      const { getH1 } = TranslationsTest.getSelectors();
      const h1 = getH1();

      h1.innerText = "Este contenido de texto de h1 se modificó.";
      h1.setAttribute("title", "Este atributo de título de h1 se modificó.");
      h1.setAttribute(
        "aria-label",
        "Este atributo de etiqueta aria de h1 se añadió."
      );
    });

    info(
      "Ensuring mutated H1 content is translated, but the mutated attributes are not."
    );
    await runInPage(async TranslationsTest => {
      const { getH1, getH1Title, getH1AriaLabel } =
        TranslationsTest.getSelectors();

      await TranslationsTest.assertTranslationResult(
        "The re-mutated h1 text content is translated.",
        getH1,
        "ESTE CONTENIDO DE TEXTO DE H1 SE MODIFICÓ. [es to en]"
      );

      await TranslationsTest.assertTranslationResult(
        "The re-mutated h1 title attribute is not translated.",
        getH1Title,
        "Este atributo de título de h1 se modificó."
      );

      await TranslationsTest.assertTranslationResult(
        "The h1 aria-label attribute remains untranslated.",
        getH1AriaLabel,
        "Este atributo de etiqueta aria de h1 se añadió."
      );
    });

    info(
      "Scrolling back to the top of the page so the mutated H1 intersects the viewport."
    );
    await scrollToTopOfPage(runInPage);

    await FullPageTranslationsTestUtils.waitForAllPendingTranslationsToComplete(
      runInPage
    );

    info("Asserting the H1 is now fully translated (text and attributes).");
    await runInPage(async TranslationsTest => {
      const { getH1, getH1Title, getH1AriaLabel } =
        TranslationsTest.getSelectors();

      await TranslationsTest.assertTranslationResult(
        "The h1 text content remains translated.",
        getH1,
        "ESTE CONTENIDO DE TEXTO DE H1 SE MODIFICÓ. [es to en]"
      );

      await TranslationsTest.assertTranslationResult(
        "The h1 title attribute is now translated after intersecting.",
        getH1Title,
        "ESTE ATRIBUTO DE TÍTULO DE H1 SE MODIFICÓ. [es to en]"
      );

      await TranslationsTest.assertTranslationResult(
        "The h1 aria-label attribute is now translated after intersecting.",
        getH1AriaLabel,
        "ESTE ATRIBUTO DE ETIQUETA ARIA DE H1 SE AÑADIÓ. [es to en]"
      );
    });

    await cleanup();
  }
);

/**
 * This test case ensures that closing the FindBar on a page where Full-Page Translations
 * is already active will enter into lazy translations mode, ensuring that translations
 * for both content and attributes are not fulfilled until the elements that they belong
 * to enter proximity with the viewport.
 */
add_task(
  async function test_findbar_close_switches_to_lazy_mode_from_content_eager_mode() {
    const { cleanup, resolveDownloads, runInPage, tab } = await loadTestPage({
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

    info(
      "Closing the find bar, which should switch the page from content eager mode back to lazy mode."
    );
    await closeFindBar(tab);

    info("Mutating the final paragraph text content and title attribute.");
    await runInPage(async TranslationsTest => {
      const { getFinalParagraph } = TranslationsTest.getSelectors();
      const p = getFinalParagraph();

      p.innerText = "Este contenido de texto de último párrafo se modificó.";
      p.setAttribute(
        "title",
        "Este atributo de título de último párrafo se modificó."
      );
    });

    await FullPageTranslationsTestUtils.waitForAllPendingTranslationsToComplete(
      runInPage
    );

    info(
      "Ensuring mutated final paragraph content and attributes are not translated while out of view in lazy mode."
    );
    await runInPage(async TranslationsTest => {
      const { getFinalParagraph, getFinalParagraphTitle } =
        TranslationsTest.getSelectors();

      await TranslationsTest.assertTranslationResult(
        "The mutated final paragraph text content is not translated.",
        getFinalParagraph,
        "Este contenido de texto de último párrafo se modificó."
      );

      await TranslationsTest.assertTranslationResult(
        "The mutated final paragraph title attribute is not translated.",
        getFinalParagraphTitle,
        "Este atributo de título de último párrafo se modificó."
      );
    });

    info("Scrolling to the bottom of the page so the paragraph intersects.");
    await scrollToBottomOfPage(runInPage);

    await FullPageTranslationsTestUtils.waitForAllPendingTranslationsToComplete(
      runInPage
    );

    info(
      "Asserting the mutated final paragraph content and title are now translated after intersecting."
    );
    await runInPage(async TranslationsTest => {
      const { getFinalParagraph, getFinalParagraphTitle } =
        TranslationsTest.getSelectors();

      await TranslationsTest.assertTranslationResult(
        "The mutated final paragraph text content is translated.",
        getFinalParagraph,
        "ESTE CONTENIDO DE TEXTO DE ÚLTIMO PÁRRAFO SE MODIFICÓ. [es to en]"
      );

      await TranslationsTest.assertTranslationResult(
        "The mutated final paragraph title attribute is translated.",
        getFinalParagraphTitle,
        "ESTE ATRIBUTO DE TÍTULO DE ÚLTIMO PÁRRAFO SE MODIFICÓ. [es to en]"
      );
    });

    await cleanup();
  }
);
