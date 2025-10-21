/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests how the unsupported language flow works.
 */
add_task(async function test_unsupported_lang() {
  const { cleanup } = await loadTestPage({
    page: SPANISH_PAGE_URL,
    languagePairs: [
      // Do not include Spanish.
      { fromLang: "fr", toLang: "en" },
      { fromLang: "en", toLang: "fr" },
    ],
  });

  await FullPageTranslationsTestUtils.openPanel({
    openFromAppMenu: true,
    onOpenPanel:
      FullPageTranslationsTestUtils.assertPanelViewUnsupportedLanguage,
  });

  await FullPageTranslationsTestUtils.clickChangeSourceLanguageButton({
    intro: true,
  });
  FullPageTranslationsTestUtils.assertPanelViewIntro();
  FullPageTranslationsTestUtils.assertSelectedFromLanguage({ langTag: "" });
  FullPageTranslationsTestUtils.assertSelectedToLanguage({ langTag: "en" });

  await cleanup();
});
