/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test case verifies the functionality of the translate-selection context menu item
 * when a hyperlink is right-clicked. The menu item should offer to translate the link text
 * to a target language when the detected language of the link text does not match the preferred
 * language.
 */
add_task(
  async function test_translate_selection_menuitem_translate_link_text_to_target_language() {
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
        selectSpanishSentence: false,
        openAtSpanishHyperlink: true,
        expectMenuItemVisible: true,
        expectedTargetLanguage: "en",
      },
      "The translate-selection context menu item should be localized to translate the link text" +
        "to the target language."
    );

    await cleanup();
  }
);

/**
 * This test case verifies the functionality of the translate-selection context menu item
 * when a hyperlink is right-clicked, and the link text is in the top preferred language.
 * The menu item should still offer to translate the link text to the top preferred language,
 * since the Select Translations Panel should pass through the text for same-language translation.
 */
add_task(
  async function test_translate_selection_menuitem_translate_link_text_in_preferred_language() {
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
        selectSpanishSentence: false,
        openAtEnglishHyperlink: true,
        expectMenuItemVisible: true,
        expectedTargetLanguage: "en",
      },
      "The translate-selection context menu item should be localized to translate the link text" +
        "to the target language."
    );

    await cleanup();
  }
);

/**
 * This test case ensures that the translate-selection context menu item functions correctly
 * when text is actively selected but the context menu is invoked on an unselected hyperlink.
 * The selected text content should take precedence over the link text, and the menu item should
 * be localized to translate the selected text to the target language, rather than the hyperlink text.
 */
add_task(
  async function test_translate_selection_menuitem_selected_text_takes_precedence_over_link_text() {
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
        selectSpanishSentence: true,
        openAtEnglishHyperlink: true,
        expectMenuItemVisible: true,
        expectedTargetLanguage: "en",
      },
      "The translate-selection context menu item should be localized to translate the selection" +
        "even though the hyperlink is the element on which the context menu was invoked."
    );

    await cleanup();
  }
);

/**
 * This test case verifies that the translate-selection context menu item is unavailable
 * when the underlying hyperlink text is a URL, rather than plain text.
 */
add_task(
  async function test_translate_selection_menuitem_with_raw_url_hyperlink() {
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
        openAtURLHyperlink: true,
        expectMenuItemVisible: false,
      },
      "The translate-selection context menu item should be unavailable when the hyperlink text is a URL."
    );

    await cleanup();
  }
);
