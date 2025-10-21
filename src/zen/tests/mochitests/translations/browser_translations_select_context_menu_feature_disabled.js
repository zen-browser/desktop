/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// This file ensures that the translate selection menu item is unavailable when the translation feature is disabled,
// This file will be removed when the feature is released, as the pref will no longer exist.
//
// https://bugzilla.mozilla.org/show_bug.cgi?id=1870366
//
// However, for the time being, I like having these tests to ensure there is no regression when the pref
// is set to false.

/**
 * This test checks the availability of the translate-selection menu item in the context menu,
 * ensuring it is not visible when the "browser.translations.select.enable" preference is set to false
 * and no text is selected when the context menu is invoked.
 */
add_task(
  async function test_translate_selection_menuitem_is_unavailable_with_feature_disabled_and_no_text_selected() {
    const { cleanup, runInPage } = await loadTestPage({
      page: SELECT_TEST_PAGE_URL,
      languagePairs: LANGUAGE_PAIRS,
      prefs: [["browser.translations.select.enable", false]],
    });

    await FullPageTranslationsTestUtils.assertTranslationsButton(
      { button: true, circleArrows: false, locale: false, icon: true },
      "The button is available."
    );

    await FullPageTranslationsTestUtils.assertPageIsNotTranslated(runInPage);

    await SelectTranslationsTestUtils.assertContextMenuTranslateSelectionItem(
      runInPage,
      {
        selectSpanishSentence: false,
        openAtSpanishSentence: true,
        expectMenuItemVisible: false,
      },
      "The translate-selection context menu item should be unavailable when the feature is disabled."
    );

    await cleanup();
  }
);

/**
 * This test case verifies the functionality of the translate-selection context menu item
 * when the selected text is not in the user's preferred language. The menu item should be
 * localized to translate to the target language matching the user's top preferred language
 * when the selected text is detected to be in a different language.
 */
add_task(
  async function test_translate_selection_menuitem_is_unavailable_with_feature_disabled_and_text_selected() {
    const { cleanup, runInPage } = await loadTestPage({
      page: SELECT_TEST_PAGE_URL,
      languagePairs: LANGUAGE_PAIRS,
      prefs: [["browser.translations.select.enable", false]],
    });

    await FullPageTranslationsTestUtils.assertTranslationsButton(
      { button: true, circleArrows: false, locale: false, icon: true },
      "The button is available."
    );

    await FullPageTranslationsTestUtils.assertPageIsNotTranslated(runInPage);

    await SelectTranslationsTestUtils.assertContextMenuTranslateSelectionItem(
      runInPage,
      {
        selectSpanishSentence: true,
        openAtSpanishSentence: true,
        expectMenuItemVisible: false,
      },
      "The translate-selection context menu item should be unavailable when the feature is disabled."
    );

    await cleanup();
  }
);

/**
 * This test checks the availability of the translate-selection menu item in the context menu,
 * ensuring it is not visible when the "browser.translations.select.enable" preference is set to false
 * and the context menu is invoked on a hyperlink. This would result in the menu item being available
 * if the pref were set to true.
 */
add_task(
  async function test_translate_selection_menuitem_is_unavailable_with_feature_disabled_and_clicking_a_hyperlink() {
    const { cleanup, runInPage } = await loadTestPage({
      page: SELECT_TEST_PAGE_URL,
      languagePairs: LANGUAGE_PAIRS,
      prefs: [["browser.translations.select.enable", false]],
    });

    await FullPageTranslationsTestUtils.assertTranslationsButton(
      { button: true, circleArrows: false, locale: false, icon: true },
      "The button is available."
    );

    await SelectTranslationsTestUtils.assertContextMenuTranslateSelectionItem(
      runInPage,
      {
        selectSpanishSentence: false,
        openAtSpanishHyperlink: true,
        expectMenuItemVisible: false,
      },
      "The translate-selection context menu item should be unavailable when the feature is disabled."
    );

    await cleanup();
  }
);
