"use strict";

/**
 * Tests the effect of checking the never-translate-site menuitem on a page where
 * always-translate-language and never-translate-language are inactive.
 * Checking the box on the page automatically closes/hides the translations panel.
 */
add_task(async function test_panel_closes_on_toggle_never_translate_site() {
  const { cleanup } = await loadTestPage({
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

  await FullPageTranslationsTestUtils.assertIsNeverTranslateSite(
    SPANISH_PAGE_URL,
    { checked: false }
  );
  await FullPageTranslationsTestUtils.waitForPanelPopupEvent(
    "popuphidden",
    async () => {
      await FullPageTranslationsTestUtils.clickNeverTranslateSite();
    }
  );

  await cleanup();
});

/**
 * Tests the effect of checking the never-translate-site menuitem on a page where
 * translations are active (always-translate-language is enabled).
 * Checking the box on the page automatically restores the page and closes/hides the translations panel.
 */
add_task(
  async function test_panel_closes_on_toggle_never_translate_site_with_translations_active() {
    const { cleanup, resolveDownloads, runInPage } = await loadTestPage({
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

    await FullPageTranslationsTestUtils.assertPageIsNotTranslated(runInPage);
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

    await FullPageTranslationsTestUtils.waitForPanelPopupEvent(
      "popuphidden",
      async () => {
        await FullPageTranslationsTestUtils.clickNeverTranslateSite();
      }
    );

    await cleanup();
  }
);

/**
 * Tests the effect of checking the never-translate-site menuitem on a page where
 * translations are inactive (never-translate-language is active).
 * Checking the box on the page automatically closes/hides the translations panel.
 */
add_task(
  async function test_panel_closes_on_toggle_never_translate_site_with_translations_inactive() {
    const { cleanup } = await loadTestPage({
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

    await FullPageTranslationsTestUtils.assertIsNeverTranslateLanguage("es", {
      checked: false,
    });
    await FullPageTranslationsTestUtils.clickNeverTranslateLanguage();
    await FullPageTranslationsTestUtils.assertIsNeverTranslateLanguage("es", {
      checked: true,
    });

    await FullPageTranslationsTestUtils.openPanel({
      openFromAppMenu: true,
      expectedFromLanguage: "es",
      expectedToLanguage: "en",
      onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewIntro,
    });
    await FullPageTranslationsTestUtils.openTranslationsSettingsMenu();

    await FullPageTranslationsTestUtils.assertIsNeverTranslateLanguage("es", {
      checked: true,
    });
    await FullPageTranslationsTestUtils.assertIsNeverTranslateSite(
      SPANISH_PAGE_URL,
      { checked: false }
    );
    await FullPageTranslationsTestUtils.waitForPanelPopupEvent(
      "popuphidden",
      async () => {
        await FullPageTranslationsTestUtils.clickNeverTranslateSite();
      }
    );

    await cleanup();
  }
);
