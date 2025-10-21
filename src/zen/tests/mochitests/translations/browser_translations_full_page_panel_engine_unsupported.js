/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests that the translations button does not appear when the translations
 * engine is not supported.
 */
add_task(async function test_translations_button_hidden_when_cpu_unsupported() {
  const { cleanup, runInPage } = await loadTestPage({
    page: SPANISH_PAGE_URL,
    languagePairs: LANGUAGE_PAIRS,
    prefs: [["browser.translations.simulateUnsupportedEngine", true]],
  });

  await FullPageTranslationsTestUtils.assertPageIsNotTranslated(runInPage);

  await FullPageTranslationsTestUtils.assertTranslationsButton(
    { button: false },
    "The button is not available."
  );

  await cleanup();
});

/**
 * Tests that the translate-page menuitem is not available in the app menu
 * when the translations engine is not supported.
 */
add_task(
  async function test_translate_page_app_menu_item_hidden_when_cpu_unsupported() {
    const { cleanup, runInPage } = await loadTestPage({
      page: SPANISH_PAGE_URL,
      languagePairs: LANGUAGE_PAIRS,
      prefs: [["browser.translations.simulateUnsupportedEngine", true]],
    });

    await FullPageTranslationsTestUtils.assertPageIsNotTranslated(runInPage);

    const appMenuButton = getById("PanelUI-menu-button");

    click(appMenuButton, "Opening the app menu");
    await BrowserTestUtils.waitForEvent(window.PanelUI.mainView, "ViewShown");

    const translateSiteButton = document.getElementById(
      "appMenu-translate-button"
    );
    is(
      translateSiteButton.hidden,
      true,
      "The app-menu translate button should be hidden because when the engine is not supported."
    );

    click(appMenuButton, "Closing the app menu");

    await cleanup();
  }
);
