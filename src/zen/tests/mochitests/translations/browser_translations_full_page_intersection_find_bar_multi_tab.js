/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test case ensures that when more than one tab is open to a page
 * each with Full-Page Translations active, that opening the FindBar
 * in one tab and transitioning to content-eager translations mode
 * does not affect the other tab.
 */
add_task(async function test_findbar_open_affects_only_target_tab() {
  const {
    cleanup,
    resolveDownloads,
    runInPage: runInSpanishDotCom,
    tab: spanishDotComTab,
  } = await loadTestPage({
    page: SPANISH_PAGE_URL,
    languagePairs: LANGUAGE_PAIRS,
  });

  await FullPageTranslationsTestUtils.openPanel({
    expectedFromLanguage: "es",
    expectedToLanguage: "en",
    onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewIntro,
  });
  await FullPageTranslationsTestUtils.clickTranslateButton({
    downloadHandler: resolveDownloads,
  });
  await FullPageTranslationsTestUtils.assertOnlyIntersectingNodesAreTranslated({
    fromLanguage: "es",
    toLanguage: "en",
    runInPage: runInSpanishDotCom,
  });

  const {
    tab: spanishDotOrgTab,
    runInPage: runInSpanishDotOrg,
    removeTab: removeSpanishDotOrgTab,
  } = await addTab(SPANISH_PAGE_URL_DOT_ORG);

  await FullPageTranslationsTestUtils.openPanel({
    expectedFromLanguage: "es",
    expectedToLanguage: "en",
    onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewDefault,
  });
  await FullPageTranslationsTestUtils.clickTranslateButton();
  await FullPageTranslationsTestUtils.assertOnlyIntersectingNodesAreTranslated({
    fromLanguage: "es",
    toLanguage: "en",
    runInPage: runInSpanishDotOrg,
  });

  info("Opening the find bar in the .org tab.");
  await openFindBar(spanishDotOrgTab);

  await FullPageTranslationsTestUtils.assertAllPageContentIsTranslated({
    fromLanguage: "es",
    toLanguage: "en",
    runInPage: runInSpanishDotOrg,
  });

  await switchTab(spanishDotComTab);

  await FullPageTranslationsTestUtils.assertOnlyIntersectingNodesAreTranslated({
    fromLanguage: "es",
    toLanguage: "en",
    runInPage: runInSpanishDotCom,
  });

  info("Mutating the final paragraph in the .com tab.");
  await runInSpanishDotCom(async TranslationsTest => {
    const { getFinalParagraph } = TranslationsTest.getSelectors();
    const p = getFinalParagraph();
    p.innerText = "Este contenido de texto de último párrafo se modificó.";
    p.setAttribute(
      "title",
      "Este atributo de título de último párrafo se modificó."
    );
  });

  await FullPageTranslationsTestUtils.waitForAllPendingTranslationsToComplete(
    runInSpanishDotCom
  );

  await runInSpanishDotCom(async TranslationsTest => {
    const { getFinalParagraph, getFinalParagraphTitle } =
      TranslationsTest.getSelectors();
    await TranslationsTest.assertTranslationResult(
      "Paragraph text remains untranslated in .com tab.",
      getFinalParagraph,
      "Este contenido de texto de último párrafo se modificó."
    );
    await TranslationsTest.assertTranslationResult(
      "Paragraph title remains untranslated in .com tab.",
      getFinalParagraphTitle,
      "Este atributo de título de último párrafo se modificó."
    );
  });

  info("Opening the find bar in the .com tab.");
  await openFindBar(spanishDotComTab);

  await FullPageTranslationsTestUtils.waitForAllPendingTranslationsToComplete(
    runInSpanishDotCom
  );

  await runInSpanishDotCom(async TranslationsTest => {
    const { getFinalParagraph, getFinalParagraphTitle } =
      TranslationsTest.getSelectors();
    await TranslationsTest.assertTranslationResult(
      "Paragraph text translated in .com tab.",
      getFinalParagraph,
      "ESTE CONTENIDO DE TEXTO DE ÚLTIMO PÁRRAFO SE MODIFICÓ. [es to en]"
    );

    await TranslationsTest.assertTranslationResult(
      "Paragraph title remains untranslated in .com tab.",
      getFinalParagraphTitle,
      "Este atributo de título de último párrafo se modificó."
    );
  });

  await removeSpanishDotOrgTab();
  await cleanup();
});

/**
 * This test case ensures that when more than one tab is open to a page
 * each with Full-Page Translations active, that closing the FindBar
 * in one tab and transitioning to lazy translations mode does not affect
 * the other tab.
 */
add_task(async function test_findbar_close_affects_only_target_tab() {
  const {
    cleanup,
    resolveDownloads,
    runInPage: runInSpanishDotCom,
    tab: spanishDotComTab,
  } = await loadTestPage({
    page: SPANISH_PAGE_URL,
    languagePairs: LANGUAGE_PAIRS,
    contentEagerMode: true,
  });

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
    runInPage: runInSpanishDotCom,
  });

  const {
    tab: spanishDotOrgTab,
    runInPage: runInSpanishDotOrg,
    removeTab: removeSpanishDotOrgTab,
  } = await addTab(SPANISH_PAGE_URL_DOT_ORG);

  await FullPageTranslationsTestUtils.openPanel({
    expectedFromLanguage: "es",
    expectedToLanguage: "en",
    onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewDefault,
  });
  await FullPageTranslationsTestUtils.clickTranslateButton();
  await FullPageTranslationsTestUtils.assertOnlyIntersectingNodesAreTranslated({
    fromLanguage: "es",
    toLanguage: "en",
    runInPage: runInSpanishDotOrg,
  });

  info("Opening the find bar in the .org tab.");
  await openFindBar(spanishDotOrgTab);
  await FullPageTranslationsTestUtils.assertAllPageContentIsTranslated({
    fromLanguage: "es",
    toLanguage: "en",
    runInPage: runInSpanishDotOrg,
  });

  await switchTab(spanishDotComTab);

  info("Closing the find bar in the .com tab.");
  await closeFindBar(spanishDotComTab);

  info("Mutating the final paragraph in the .com tab.");
  await runInSpanishDotCom(async TranslationsTest => {
    const { getFinalParagraph } = TranslationsTest.getSelectors();
    const p = getFinalParagraph();
    p.innerText = "Este contenido de texto de último párrafo se modificó.";
    p.setAttribute(
      "title",
      "Este atributo de título de último párrafo se modificó."
    );
  });

  await FullPageTranslationsTestUtils.waitForAllPendingTranslationsToComplete(
    runInSpanishDotCom
  );

  await runInSpanishDotCom(async TranslationsTest => {
    const { getFinalParagraph, getFinalParagraphTitle } =
      TranslationsTest.getSelectors();
    await TranslationsTest.assertTranslationResult(
      "Paragraph text remains untranslated in .com tab.",
      getFinalParagraph,
      "Este contenido de texto de último párrafo se modificó."
    );
    await TranslationsTest.assertTranslationResult(
      "Paragraph title remains untranslated in .com tab.",
      getFinalParagraphTitle,
      "Este atributo de título de último párrafo se modificó."
    );
  });

  await switchTab(spanishDotOrgTab);

  info("Mutating the final paragraph in the .org tab.");
  await runInSpanishDotOrg(async TranslationsTest => {
    const { getFinalParagraph } = TranslationsTest.getSelectors();
    const p = getFinalParagraph();
    p.innerText = "Este contenido de texto de último párrafo se modificó.";
    p.setAttribute(
      "title",
      "Este atributo de título de último párrafo se modificó."
    );
  });

  await FullPageTranslationsTestUtils.waitForAllPendingTranslationsToComplete(
    runInSpanishDotOrg
  );

  await runInSpanishDotOrg(async TranslationsTest => {
    const { getFinalParagraph, getFinalParagraphTitle } =
      TranslationsTest.getSelectors();
    await TranslationsTest.assertTranslationResult(
      "Paragraph text translated in .org tab.",
      getFinalParagraph,
      "ESTE CONTENIDO DE TEXTO DE ÚLTIMO PÁRRAFO SE MODIFICÓ. [es to en]"
    );
    await TranslationsTest.assertTranslationResult(
      "Paragraph title remains untranslated in .org tab.",
      getFinalParagraphTitle,
      "Este atributo de título de último párrafo se modificó."
    );
  });

  await removeSpanishDotOrgTab();
  await cleanup();
});
