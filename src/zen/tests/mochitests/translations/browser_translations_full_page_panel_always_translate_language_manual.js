/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests the effect of toggling the always-translate-language menuitem after the page has
 * been manually translated. This should not reload or retranslate the page, but just check
 * the box.
 */
add_task(
  async function test_activate_always_translate_language_after_manual_translation() {
    const { cleanup, resolveDownloads, runInPage } = await loadTestPage({
      page: SPANISH_PAGE_URL,
      languagePairs: LANGUAGE_PAIRS,
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

    await FullPageTranslationsTestUtils.openPanel({
      expectedToLanguage: "en",
      onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewRevisit,
    });
    await FullPageTranslationsTestUtils.openTranslationsSettingsMenu();

    await FullPageTranslationsTestUtils.assertIsAlwaysTranslateLanguage("es", {
      checked: false,
    });
    await FullPageTranslationsTestUtils.clickAlwaysTranslateLanguage();
    await FullPageTranslationsTestUtils.assertIsAlwaysTranslateLanguage("es", {
      checked: true,
    });

    await FullPageTranslationsTestUtils.assertOnlyIntersectingNodesAreTranslated(
      {
        fromLanguage: "es",
        toLanguage: "en",
        runInPage,
      }
    );

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
  }
);
