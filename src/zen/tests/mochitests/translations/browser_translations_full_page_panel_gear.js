/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Test managing the languages menu item.
 */
add_task(async function test_translations_panel_manage_languages() {
  const { cleanup } = await loadTestPage({
    page: SPANISH_PAGE_URL,
    languagePairs: LANGUAGE_PAIRS,
  });

  await FullPageTranslationsTestUtils.openPanel({
    expectedFromLanguage: "es",
    expectedToLanguage: "en",
    onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewIntro,
  });

  await FullPageTranslationsTestUtils.openTranslationsSettingsMenu();

  await FullPageTranslationsTestUtils.clickManageLanguages();

  await waitForCondition(
    () => gBrowser.currentURI.spec === "about:preferences#general",
    "Waiting for about:preferences to be opened."
  );

  info("Remove the about:preferences tab");
  gBrowser.removeCurrentTab();

  await cleanup();
});
