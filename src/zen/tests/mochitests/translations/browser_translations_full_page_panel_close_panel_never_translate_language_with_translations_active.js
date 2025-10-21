"use strict";

/**
 * Tests the effect of checking the never-translate-language menuitem on a page where
 * translations are active (always-translate-language is enabled).
 * Checking the box on the page automatically closes/hides the translations panel.
 */
add_task(
  async function test_panel_closes_on_toggle_never_translate_language_with_translations_active() {
    const { cleanup, runInPage, resolveDownloads } = await loadTestPage({
      page: SPANISH_PAGE_URL,
      languagePairs: LANGUAGE_PAIRS,
    });

    await FullPageTranslationsTestUtils.assertTranslationsButton(
      { button: true },
      "The translations button is available"
    );

    await FullPageTranslationsTestUtils.openPanel({
      openFromAppMenu: true,
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
    await FullPageTranslationsTestUtils.assertOnlyIntersectingNodesAreTranslated(
      {
        fromLanguage: "es",
        toLanguage: "en",
        runInPage,
        message: "The page should be automatically translated.",
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
    await FullPageTranslationsTestUtils.assertIsNeverTranslateLanguage("es", {
      checked: false,
    });
    await FullPageTranslationsTestUtils.waitForPanelPopupEvent(
      "popuphidden",
      async () => {
        await FullPageTranslationsTestUtils.clickNeverTranslateLanguage();
      }
    );

    await FullPageTranslationsTestUtils.assertPageIsNotTranslated(runInPage);
    await cleanup();
  }
);

/**
 * Tests the effect of checking the never-translate-language menuitem on
 * a page where translations are active through always-translate-language
 * and inactive on a site through never-translate-site.
 * Checking the box on the page automatically closes/hides the translations panel.
 */
add_task(
  async function test_panel_closes_on_toggle_never_translate_language_with_always_translate_language_and_never_translate_site_active() {
    const { cleanup, runInPage, resolveDownloads } = await loadTestPage({
      page: SPANISH_PAGE_URL,
      languagePairs: LANGUAGE_PAIRS,
    });

    await FullPageTranslationsTestUtils.assertTranslationsButton(
      { button: true },
      "The translations button is available"
    );

    await FullPageTranslationsTestUtils.openPanel({
      openFromAppMenu: true,
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
    await FullPageTranslationsTestUtils.assertOnlyIntersectingNodesAreTranslated(
      {
        fromLanguage: "es",
        toLanguage: "en",
        runInPage,
        message: "The page should be automatically translated.",
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
    await FullPageTranslationsTestUtils.assertIsNeverTranslateSite(
      SPANISH_PAGE_URL,
      { checked: false }
    );
    await FullPageTranslationsTestUtils.clickNeverTranslateSite();
    await FullPageTranslationsTestUtils.assertIsNeverTranslateSite(
      SPANISH_PAGE_URL,
      { checked: true }
    );
    await FullPageTranslationsTestUtils.assertPageIsNotTranslated(runInPage);

    await FullPageTranslationsTestUtils.openPanel({
      openFromAppMenu: true,
      expectedFromLanguage: "es",
      expectedToLanguage: "en",
      onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewDefault,
    });
    await FullPageTranslationsTestUtils.openTranslationsSettingsMenu();
    await FullPageTranslationsTestUtils.assertIsAlwaysTranslateLanguage("es", {
      checked: true,
    });
    await FullPageTranslationsTestUtils.assertIsNeverTranslateSite(
      SPANISH_PAGE_URL,
      { checked: true }
    );
    await FullPageTranslationsTestUtils.assertPageIsNotTranslated(runInPage);

    await FullPageTranslationsTestUtils.assertIsNeverTranslateLanguage("es", {
      checked: false,
    });
    await FullPageTranslationsTestUtils.waitForPanelPopupEvent(
      "popuphidden",
      async () => {
        await FullPageTranslationsTestUtils.clickNeverTranslateLanguage();
      }
    );
    await cleanup();
  }
);
