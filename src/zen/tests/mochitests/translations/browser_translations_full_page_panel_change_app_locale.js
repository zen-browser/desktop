/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test case ensures that the language display names within the FullPageTranslationsPanel
 * dropdown menu lists update immediately upon the next panel open when the user's application
 * locale changes.
 */
add_task(
  async function test_full_page_translations_panel_change_application_locale() {
    const { cleanup } = await loadTestPage({
      page: SPANISH_PAGE_URL,
      languagePairs: LANGUAGE_PAIRS,
    });

    await FullPageTranslationsTestUtils.assertTranslationsButton(
      { button: true },
      "The button is available."
    );

    await FullPageTranslationsTestUtils.openPanel({
      expectedFromLanguage: "es",
      expectedToLanguage: "en",
      onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewIntro,
    });

    const { fromMenuList, toMenuList } = FullPageTranslationsPanel.elements;

    is(
      fromMenuList.label,
      "Spanish",
      "The FullPageTranslationsPanel from-menu-list languages should be localized to English display names."
    );

    is(
      toMenuList.label,
      "English",
      "The FullPageTranslationsPanel to-menu-list languages should be localized to English display names."
    );

    await FullPageTranslationsTestUtils.clickCancelButton();

    info("Changing the application locale from English to Spanish");
    const cleanupLocales = await mockLocales({
      appLocales: ["es"],
      webLanguages: ["en"],
    });

    await FullPageTranslationsTestUtils.openPanel({
      expectedFromLanguage: "es",
      expectedToLanguage: "en",
      onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewIntro,
    });

    is(
      fromMenuList.label,
      "español",
      "The FullPageTranslationsPanel from-menu-list languages should be localized to Spanish display names."
    );

    is(
      toMenuList.label,
      "inglés",
      "The FullPageTranslationsPanel to-menu-list languages should be localized to Spanish display names."
    );

    await FullPageTranslationsTestUtils.clickCancelButton();

    await cleanupLocales();
    await cleanup();
  }
);
