/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests that having an "always translate" set to your app locale doesn't break things.
 */
add_task(async function test_always_translate_with_bad_data() {
  const { cleanup, runInPage } = await loadTestPage({
    page: ENGLISH_PAGE_URL,
    languagePairs: LANGUAGE_PAIRS,
    prefs: [["browser.translations.alwaysTranslateLanguages", "en,fr"]],
  });

  await FullPageTranslationsTestUtils.openPanel({
    expectedFromLanguage: "en",
    expectedToLanguage: "",
    onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewIntro,
    openFromAppMenu: true,
  });
  await FullPageTranslationsTestUtils.openTranslationsSettingsMenu();

  await FullPageTranslationsTestUtils.assertIsAlwaysTranslateLanguage("en", {
    checked: false,
    disabled: true,
  });
  await closeAllOpenPanelsAndMenus();

  info("Checking that the page is not translated");
  await runInPage(async TranslationsTest => {
    const { getH1 } = TranslationsTest.getSelectors();
    await TranslationsTest.assertTranslationResult(
      "The page's H1 is not translated and in the original English.",
      getH1,
      '"The Wonderful Wizard of Oz" by L. Frank Baum'
    );
  });

  await cleanup();
});
