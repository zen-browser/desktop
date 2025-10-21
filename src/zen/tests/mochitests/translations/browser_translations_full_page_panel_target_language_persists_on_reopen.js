/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test case tests the bug described in Bug 1838422,
 * where the target language is reset if the user clicks
 * outside the translations panel and reopens it.
 * The user-selected target language should persist when
 * the panel is reopened.
 */
add_task(
  async function test_browser_translations_full_page_panel_target_language_persists_on_reopen() {
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

    await FullPageTranslationsTestUtils.changeSelectedToLanguage({
      langTag: "uk",
    });

    await FullPageTranslationsTestUtils.clickCancelButton();

    // Reopen the translations panel and check if the target language is still "fr".
    await FullPageTranslationsTestUtils.openPanel({
      expectedFromLanguage: "es",
      expectedToLanguage: "uk",
      onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewIntro,
    });

    await cleanup();
  }
);
