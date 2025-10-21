/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests a basic panel open, translation, and restoration to the original language.
 */
add_task(async function test_translations_moz_extension() {
  let extension = ExtensionTestUtils.loadExtension({
    manifest: {
      web_accessible_resources: ["test_page.html"],
    },
    files: {
      "test_page.html": `<!DOCTYPE html>
        <html lang="es">
          <head>
            <meta charset="UTF-8">
          </head>
          <body>
            <h1 title="Este es el título del encabezado de página">Don Quijote de La Mancha</h1>
            <p title="Este es el título del último párrafo">— Pues, aunque mováis más brazos que los del gigante Briareo, me lo habéis de pagar.</p>
          </body>
        </html>`,
    },
  });

  await extension.startup();

  const { cleanup, resolveDownloads, runInPage } = await loadTestPage({
    page: `moz-extension://${extension.uuid}/test_page.html`,
    languagePairs: LANGUAGE_PAIRS,
  });

  const { button } =
    await FullPageTranslationsTestUtils.assertTranslationsButton(
      { button: true, circleArrows: false, locale: false, icon: true },
      "The button is available."
    );

  is(button.getAttribute("data-l10n-id"), "urlbar-translations-button-intro");

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
  await FullPageTranslationsTestUtils.assertPageFinalParagraphTitleIsTranslated(
    {
      fromLanguage: "es",
      toLanguage: "en",
      runInPage,
      message:
        "The page's final paragraph's title should be translated because it intersects with the viewport.",
    }
  );

  await cleanup();
  await extension.unload();
});
