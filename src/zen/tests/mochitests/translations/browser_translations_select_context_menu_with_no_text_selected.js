/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test case verifies that the translate-selection context menu item is unavailable
 * when no text is selected.
 */
add_task(
  async function test_translate_selection_menuitem_is_unavailable_when_no_text_is_selected() {
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
        selectSpanishSentence: false,
        openAtSpanishSentence: true,
        expectMenuItemVisible: false,
      },
      "The translate-selection context menu item should be unavailable when no text is selected."
    );

    await cleanup();
  }
);
