/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test case tests the scenario of clicking the settings menu item
 * that leads to the translations section of the about:preferences settings
 * page in Firefox.
 */
add_task(async function test_select_translations_panel_open_settings_page() {
  const { cleanup, runInPage, resolveDownloads } = await loadTestPage({
    page: SELECT_TEST_PAGE_URL,
    languagePairs: LANGUAGE_PAIRS,
    prefs: [["browser.translations.select.enable", true]],
  });

  await SelectTranslationsTestUtils.openPanel(runInPage, {
    selectFrenchSentence: true,
    openAtFrenchSentence: true,
    expectedFromLanguage: "fr",
    expectedToLanguage: "en",
    downloadHandler: resolveDownloads,
    onOpenPanel: SelectTranslationsTestUtils.assertPanelViewTranslated,
  });

  await SelectTranslationsTestUtils.openPanelSettingsMenu();
  SelectTranslationsTestUtils.clickTranslationsSettingsPageMenuItem();

  await waitForCondition(
    () => gBrowser.currentURI.spec === "about:preferences#general",
    "Waiting for about:preferences to be opened."
  );

  info("Remove the about:preferences tab");
  gBrowser.removeCurrentTab();

  await cleanup();
});

/**
 * This test case tests the scenario of opening the SelectTranslationsPanel
 * settings menu from the unsupported-language panel state.
 */
add_task(
  async function test_select_translations_panel_open_settings_menu_from_unsupported_language() {
    const { cleanup, runInPage } = await loadTestPage({
      page: SELECT_TEST_PAGE_URL,
      languagePairs: [
        // Do not include Spanish.
        { fromLang: "fr", toLang: "en" },
        { fromLang: "en", toLang: "fr" },
      ],
      prefs: [["browser.translations.select.enable", true]],
    });

    await SelectTranslationsTestUtils.openPanel(runInPage, {
      selectSpanishSection: true,
      openAtSpanishSection: true,
      onOpenPanel:
        SelectTranslationsTestUtils.assertPanelViewUnsupportedLanguage,
    });

    await SelectTranslationsTestUtils.openPanelSettingsMenu();

    await SelectTranslationsTestUtils.clickDoneButton();

    await cleanup();
  }
);
