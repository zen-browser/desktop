"use strict";

/**
 * Tests the effect of checking the never-translate-language menuitem on a page where
 * translations and never translate site are inactive.
 * Checking the box on the page automatically closes/hides the translations panel.
 */
add_task(async function test_panel_closes_on_toggle_never_translate_language() {
  const { cleanup } = await loadTestPage({
    page: SPANISH_PAGE_URL,
    languagePairs: LANGUAGE_PAIRS,
  });

  await FullPageTranslationsTestUtils.assertTranslationsButton(
    { button: true },
    "The translations button is available"
  );

  await FullPageTranslationsTestUtils.openPanel({
    expectedFromLanguage: "es",
    expectedToLanguage: "en",
    openFromAppMenu: true,
    onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewIntro,
  });

  await FullPageTranslationsTestUtils.openTranslationsSettingsMenu();

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
});

/**
 * Tests the effect of checking the never-translate-language menuitem on a page where
 * translations are inactive (never-translate-site is enabled).
 * Checking the box on the page automatically closes/hides the translations panel.
 */
add_task(
  async function test_panel_closes_on_toggle_never_translate_language_with_never_translate_site_enabled() {
    const { cleanup } = await loadTestPage({
      page: SPANISH_PAGE_URL,
      languagePairs: LANGUAGE_PAIRS,
    });

    await FullPageTranslationsTestUtils.assertTranslationsButton(
      { button: true },
      "The translations button is available"
    );

    await FullPageTranslationsTestUtils.openPanel({
      expectedFromLanguage: "es",
      expectedToLanguage: "en",
      openFromAppMenu: true,
      onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewIntro,
    });

    await FullPageTranslationsTestUtils.openTranslationsSettingsMenu();

    await FullPageTranslationsTestUtils.assertIsNeverTranslateSite(
      SPANISH_PAGE_URL,
      { checked: false }
    );
    await FullPageTranslationsTestUtils.clickNeverTranslateSite();
    await FullPageTranslationsTestUtils.assertIsNeverTranslateSite(
      SPANISH_PAGE_URL,
      { checked: true }
    );

    await FullPageTranslationsTestUtils.openPanel({
      expectedFromLanguage: "es",
      expectedToLanguage: "en",
      openFromAppMenu: true,
      onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewIntro,
    });
    await FullPageTranslationsTestUtils.openTranslationsSettingsMenu();
    await FullPageTranslationsTestUtils.assertIsNeverTranslateSite(
      SPANISH_PAGE_URL,
      { checked: true }
    );

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
