/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests the effect of toggling the always-translate-language menuitem.
 * Checking the box on an not translated page should immediately translate the page.
 * Unchecking the box on a translated page should immediately restore the page.
 */
add_task(async function test_toggle_always_translate_language_menuitem() {
  const { cleanup, resolveDownloads, runInPage } = await loadTestPage({
    page: SPANISH_PAGE_URL,
    languagePairs: LANGUAGE_PAIRS,
  });

  await FullPageTranslationsTestUtils.assertTranslationsButton(
    { button: true, circleArrows: false, locale: false, icon: true },
    "The translations button is visible."
  );

  await FullPageTranslationsTestUtils.assertPageIsNotTranslated(runInPage);

  await FullPageTranslationsTestUtils.openPanel({
    expectedFromLanguage: "es",
    expectedToLanguage: "en",
    onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewIntro,
  });
  await FullPageTranslationsTestUtils.openTranslationsSettingsMenu();

  await FullPageTranslationsTestUtils.assertIsAlwaysTranslateLanguage("es", {
    checked: false,
  });
  await FullPageTranslationsTestUtils.clickAlwaysTranslateLanguage({
    downloadHandler: resolveDownloads,
  });
  await FullPageTranslationsTestUtils.assertIsAlwaysTranslateLanguage("es", {
    checked: true,
  });

  await FullPageTranslationsTestUtils.assertOnlyIntersectingNodesAreTranslated({
    fromLanguage: "es",
    toLanguage: "en",
    runInPage,
    message: "The page should be automatically translated.",
  });

  await navigate("Navigate to a different Spanish page", {
    url: SPANISH_PAGE_URL_DOT_ORG,
  });

  await FullPageTranslationsTestUtils.assertOnlyIntersectingNodesAreTranslated({
    fromLanguage: "es",
    toLanguage: "en",
    runInPage,
    message: "The page should be automatically translated.",
  });

  await FullPageTranslationsTestUtils.openPanel({
    expectedToLanguage: "en",
    onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewRevisit,
  });
  await FullPageTranslationsTestUtils.openTranslationsSettingsMenu();

  await FullPageTranslationsTestUtils.assertIsAlwaysTranslateLanguage("es", {
    checked: true,
  });
  await FullPageTranslationsTestUtils.clickAlwaysTranslateLanguage();
  await FullPageTranslationsTestUtils.assertIsAlwaysTranslateLanguage("es", {
    checked: false,
  });

  await FullPageTranslationsTestUtils.assertTranslationsButton(
    { button: true, circleArrows: false, locale: false, icon: true },
    "Only the button appears"
  );

  await FullPageTranslationsTestUtils.assertPageIsNotTranslated(runInPage);

  await cleanup();
});
