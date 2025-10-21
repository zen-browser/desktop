/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test case ensures that the language display names within the SelectTranslationsPanel
 * dropdown menu lists update immediately upon the next panel open when the user's application
 * locale changes.
 */
add_task(
  async function test_select_translations_panel_change_application_locale() {
    const { runInPage, resolveDownloads, cleanup } = await loadTestPage({
      page: SELECT_TEST_PAGE_URL,
      languagePairs: LANGUAGE_PAIRS,
    });

    await SelectTranslationsTestUtils.openPanel(runInPage, {
      selectFrenchSentence: true,
      openAtFrenchSentence: true,
      expectedFromLanguage: "fr",
      expectedToLanguage: "en",
      downloadHandler: resolveDownloads,
      onOpenPanel: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    const { fromMenuList, toMenuList } = SelectTranslationsPanel.elements;

    is(
      fromMenuList.label,
      "French",
      "The SelectTranslationsPanel from-menu-list languages should be localized to English display names."
    );

    is(
      toMenuList.label,
      "English",
      "The SelectTranslationsPanel to-menu-list languages should be localized to English display names."
    );

    await SelectTranslationsTestUtils.clickDoneButton();

    info("Changing the application locale from English to Spanish");
    const cleanupLocales = await mockLocales({
      appLocales: ["es"],
      webLanguages: ["en"],
    });

    await SelectTranslationsTestUtils.openPanel(runInPage, {
      selectFrenchSentence: true,
      openAtFrenchSentence: true,
      expectedFromLanguage: "fr",
      expectedToLanguage: "en",
      onOpenPanel: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    is(
      fromMenuList.label,
      "francés",
      "The SelectTranslationsPanel from-menu-list languages should be localized to Spanish display names."
    );

    is(
      toMenuList.label,
      "inglés",
      "The SelectTranslationsPanel to-menu-list languages should be localized to Spanish display names."
    );

    await SelectTranslationsTestUtils.clickDoneButton();

    await cleanupLocales();
    await cleanup();
  }
);
