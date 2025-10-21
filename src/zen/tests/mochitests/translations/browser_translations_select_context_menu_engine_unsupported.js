/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test checks the availability of the translate-selection menu item in the context menu,
 * ensuring it is not visible when the hardware does not support Translations. In this case
 * we simulate this scenario by setting "browser.translations.simulateUnsupportedEngine" to true.
 */
add_task(
  async function test_translate_selection_menuitem_is_unavailable_when_engine_is_unsupported() {
    const { cleanup, runInPage } = await loadTestPage({
      page: SELECT_TEST_PAGE_URL,
      languagePairs: LANGUAGE_PAIRS,
      prefs: [
        ["browser.translations.enable", true],
        ["browser.translations.select.enable", true],
        ["browser.translations.simulateUnsupportedEngine", true],
      ],
    });

    await SelectTranslationsTestUtils.assertContextMenuTranslateSelectionItem(
      runInPage,
      {
        selectSpanishSentence: true,
        openAtSpanishSentence: true,
        expectMenuItemVisible: false,
      },
      "The translate-selection context menu item should be unavailable the translations engine is unsupported."
    );

    await cleanup();
  }
);
