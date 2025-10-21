/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test case ensures that nodes with mutated content are picked up and translated
 * regardless of their proximity to the viewport in content-eager translations mode,
 * but attributes that are mutated will not be translated until the elements they
 * belong to enter proximity with the viewport.
 */
add_task(
  async function test_mutated_nodes_are_translated_in_content_eager_mode() {
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

    info(
      "Ensuring intersecting attributes are translated and non-intersecting attributes are not translated."
    );
    await runInPage(async TranslationsTest => {
      const { getH1Title, getFinalParagraphTitle } =
        TranslationsTest.getSelectors();

      await TranslationsTest.assertTranslationResult(
        "The <h1> title attribute is translated.",
        getH1Title,
        "ESTE ES EL TÍTULO DEL ENCABEZADO DE PÁGINA [es to en]"
      );

      await TranslationsTest.assertTranslationResult(
        "The final paragraph title attribute is not translated.",
        getFinalParagraphTitle,
        "Este es el título del último párrafo"
      );
    });

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

    await FullPageTranslationsTestUtils.waitForAllPendingTranslationsToComplete(
      runInPage
    );

    info("Ensuring all H1 mutations are translated.");
    await runInPage(async TranslationsTest => {
      const { getH1, getH1Title, getH1AriaLabel } =
        TranslationsTest.getSelectors();

      await TranslationsTest.assertTranslationResult(
        "The mutated h1 text content is translated.",
        getH1,
        "ESTE CONTENIDO DE TEXTO DE H1 SE MODIFICÓ. [es to en]"
      );

      await TranslationsTest.assertTranslationResult(
        "The mutated h1 title attribute is translated.",
        getH1Title,
        "ESTE ATRIBUTO DE TÍTULO DE H1 SE MODIFICÓ. [es to en]"
      );

      await TranslationsTest.assertTranslationResult(
        "The mutated h1 aria-label attribute is translated.",
        getH1AriaLabel,
        "ESTE ATRIBUTO DE ETIQUETA ARIA DE H1 SE AÑADIÓ. [es to en]"
      );
    });

    info("Mutating the final paragraph text content and attributes.");
    await runInPage(async TranslationsTest => {
      const { getFinalParagraph } = TranslationsTest.getSelectors();
      const p = getFinalParagraph();

      p.innerText = "Este contenido de texto de último párrafo se modificó.";
      p.setAttribute(
        "title",
        "Este atributo de título de último párrafo se modificó."
      );
      p.setAttribute(
        "aria-label",
        "Este atributo de etiqueta aria de último párrafo se añadió."
      );
    });

    await FullPageTranslationsTestUtils.waitForAllPendingTranslationsToComplete(
      runInPage
    );

    info(
      "Ensuring that only the final paragraph's content mutations are translated."
    );
    await runInPage(async TranslationsTest => {
      const {
        getFinalParagraph,
        getFinalParagraphTitle,
        getFinalParagraphAriaLabel,
      } = TranslationsTest.getSelectors();

      await TranslationsTest.assertTranslationResult(
        "The mutated final paragraph text content is translated.",
        getFinalParagraph,
        "ESTE CONTENIDO DE TEXTO DE ÚLTIMO PÁRRAFO SE MODIFICÓ. [es to en]"
      );

      await TranslationsTest.assertTranslationResult(
        "The mutated final paragraph title attribute is not translated.",
        getFinalParagraphTitle,
        "Este atributo de título de último párrafo se modificó."
      );

      await TranslationsTest.assertTranslationResult(
        "The mutated final paragraph aria-label attribute is not translated.",
        getFinalParagraphAriaLabel,
        "Este atributo de etiqueta aria de último párrafo se añadió."
      );
    });

    await scrollToBottomOfPage(runInPage);
    await FullPageTranslationsTestUtils.waitForAllPendingTranslationsToComplete(
      runInPage
    );
    await scrollToBottomOfPage(runInPage);

    info("Ensuring all final paragraph mutations are translated.");
    await runInPage(async TranslationsTest => {
      const {
        getFinalParagraph,
        getFinalParagraphTitle,
        getFinalParagraphAriaLabel,
      } = TranslationsTest.getSelectors();

      await TranslationsTest.assertTranslationResult(
        "The mutated final paragraph text content remains translated.",
        getFinalParagraph,
        "ESTE CONTENIDO DE TEXTO DE ÚLTIMO PÁRRAFO SE MODIFICÓ. [es to en]"
      );

      await TranslationsTest.assertTranslationResult(
        "The mutated final paragraph title attribute is translated.",
        getFinalParagraphTitle,
        "ESTE ATRIBUTO DE TÍTULO DE ÚLTIMO PÁRRAFO SE MODIFICÓ. [es to en]"
      );

      await TranslationsTest.assertTranslationResult(
        "The mutated final paragraph aria-label attribute is translated.",
        getFinalParagraphAriaLabel,
        "ESTE ATRIBUTO DE ETIQUETA ARIA DE ÚLTIMO PÁRRAFO SE AÑADIÓ. [es to en]"
      );
    });

    info("Mutating the H1 content and title again.");
    await runInPage(async TranslationsTest => {
      const { getH1 } = TranslationsTest.getSelectors();
      const h1 = getH1();

      h1.innerText = "Este contenido de texto de h1 se modificó otra vez.";
      h1.setAttribute(
        "title",
        "Este atributo de título de h1 se modificó otra vez."
      );
    });

    await FullPageTranslationsTestUtils.waitForAllPendingTranslationsToComplete(
      runInPage
    );

    info(
      "Ensuring mutated H1 content is translated, but the mutated attribute is not."
    );
    await runInPage(async TranslationsTest => {
      const { getH1, getH1Title, getH1AriaLabel } =
        TranslationsTest.getSelectors();

      await TranslationsTest.assertTranslationResult(
        "The re-mutated h1 text content is translated.",
        getH1,
        "ESTE CONTENIDO DE TEXTO DE H1 SE MODIFICÓ OTRA VEZ. [es to en]"
      );

      await TranslationsTest.assertTranslationResult(
        "The re-mutated h1 title attribute is not translated.",
        getH1Title,
        "Este atributo de título de h1 se modificó otra vez."
      );

      await TranslationsTest.assertTranslationResult(
        "The h1 aria-label attribute remains previously translated.",
        getH1AriaLabel,
        "ESTE ATRIBUTO DE ETIQUETA ARIA DE H1 SE AÑADIÓ. [es to en]"
      );
    });

    await scrollToTopOfPage(runInPage);

    await FullPageTranslationsTestUtils.waitForAllPendingTranslationsToComplete(
      runInPage
    );

    info("Ensuring re-mutated H1 title attribute is translated.");
    await runInPage(async TranslationsTest => {
      const { getH1Title } = TranslationsTest.getSelectors();

      await TranslationsTest.assertTranslationResult(
        "The re-mutated h1 title attribute is translated.",
        getH1Title,
        "ESTE ATRIBUTO DE TÍTULO DE H1 SE MODIFICÓ OTRA VEZ. [es to en]"
      );
    });

    await cleanup();
  }
);
