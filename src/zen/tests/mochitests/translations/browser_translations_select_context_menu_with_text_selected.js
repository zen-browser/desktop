/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test case verifies the functionality of the translate-selection context menu item
 * when the selected text is not in the user's preferred language. The menu item should be
 * localized to translate to the target language matching the user's top preferred language
 * when the selected text is detected to be in a different language.
 */
add_task(
  async function test_translate_selection_menuitem_when_selected_text_is_not_preferred_language() {
    const { cleanup, runInPage } = await loadTestPage({
      page: SELECT_TEST_PAGE_URL,
      languagePairs: LANGUAGE_PAIRS,
      prefs: [["browser.translations.select.enable", true]],
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
        expectMenuItemVisible: true,
        expectedTargetLanguage: "en",
      },
      "The translate-selection context menu item should display a target language " +
        "when the selected text is not the preferred language."
    );

    await cleanup();
  }
);

/**
 * This test case verifies the functionality of the translate-selection context menu item
 * when the selected text is detected to be in the user's preferred language. The menu item
 * still be localized to the user's preferred language as a target, since the Select Translations
 * Panel allows passing through the text for same-language translation.
 */
add_task(
  async function test_translate_selection_menuitem_when_selected_text_is_preferred_language() {
    const { cleanup, runInPage } = await loadTestPage({
      page: SELECT_TEST_PAGE_URL,
      languagePairs: LANGUAGE_PAIRS,
      prefs: [["browser.translations.select.enable", true]],
    });

    await FullPageTranslationsTestUtils.assertTranslationsButton(
      { button: true, circleArrows: false, locale: false, icon: true },
      "The button is available."
    );

    await SelectTranslationsTestUtils.assertContextMenuTranslateSelectionItem(
      runInPage,
      {
        selectEnglishSentence: true,
        openAtEnglishSentence: true,
        expectMenuItemVisible: true,
        expectedTargetLanguage: "en",
      },
      "The translate-selection context menu item should still display a target language " +
        "when the selected text is in the preferred language."
    );

    await cleanup();
  }
);
