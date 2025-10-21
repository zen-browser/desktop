/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests that the translations button becomes hidden when entering reader mode.
 */
add_task(async function test_translations_button_hidden_in_reader_mode() {
  const { cleanup, runInPage } = await loadTestPage({
    page: SPANISH_PAGE_URL,
    languagePairs: LANGUAGE_PAIRS,
  });

  await FullPageTranslationsTestUtils.assertTranslationsButton(
    { button: true },
    "The translations button is visible."
  );

  await FullPageTranslationsTestUtils.assertPageIsNotTranslated(runInPage);

  await toggleReaderMode();

  await FullPageTranslationsTestUtils.assertTranslationsButton(
    { button: false },
    "The translations button is now hidden in reader mode."
  );

  await runInPage(async TranslationsTest => {
    const { getH1 } = TranslationsTest.getSelectors();
    await TranslationsTest.assertTranslationResult(
      "The page's H1 is now the reader-mode header",
      getH1,
      "Translations Test"
    );
  });

  await runInPage(async TranslationsTest => {
    const { getFinalParagraph } = TranslationsTest.getSelectors();
    await TranslationsTest.assertTranslationResult(
      "The page's final paragraph is in Spanish.",
      getFinalParagraph,
      "— Pues, aunque mováis más brazos que los del gigante Briareo, me lo habéis de pagar."
    );
  });

  await toggleReaderMode();

  await FullPageTranslationsTestUtils.assertTranslationsButton(
    { button: true },
    "The translations button is visible again outside of reader mode."
  );

  await FullPageTranslationsTestUtils.assertPageIsNotTranslated(runInPage);

  await cleanup();
});

/**
 * Tests that translations persist when entering reader mode after translating.
 */
add_task(async function test_translations_persist_in_reader_mode() {
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

  await runInPage(async TranslationsTest => {
    const { getFinalParagraph } = TranslationsTest.getSelectors();
    await TranslationsTest.assertTranslationResult(
      "The page's final paragraph is translated from Spanish to English.",
      getFinalParagraph,
      "— PUES, AUNQUE MOVÁIS MÁS BRAZOS QUE LOS DEL GIGANTE BRIAREO, ME LO HABÉIS DE PAGAR. [es to en]"
    );
  });

  await toggleReaderMode();

  await runInPage(async TranslationsTest => {
    const { getH1 } = TranslationsTest.getSelectors();
    await TranslationsTest.assertTranslationResult(
      "The page's H1 is now the translated reader-mode header",
      getH1,
      "TRANSLATIONS TEST [es to en]"
    );
  });

  await runInPage(async TranslationsTest => {
    const { getFinalParagraph } = TranslationsTest.getSelectors();
    await TranslationsTest.assertTranslationResult(
      "The page's final paragraph is translated from Spanish to English.",
      getFinalParagraph,
      "— PUES, AUNQUE MOVÁIS MÁS BRAZOS QUE LOS DEL GIGANTE BRIAREO, ME LO HABÉIS DE PAGAR. [es to en]"
    );
  });

  await FullPageTranslationsTestUtils.assertTranslationsButton(
    { button: false },
    "The translations button is now hidden in reader mode."
  );

  await cleanup();
});
