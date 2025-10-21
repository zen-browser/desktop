/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test case ensures that A11yUtils.announce is called to announce to assistive technology
 * whenever the translation completes, and that no call is made if the translation fails,
 * since that is handled by aria-describedby when the error message occurs.
 */
add_task(
  async function test_select_translations_panel_a11y_announce_translation_complete() {
    const { cleanup, runInPage, resolveDownloads, rejectDownloads } =
      await loadTestPage({
        page: SELECT_TEST_PAGE_URL,
        languagePairs: LANGUAGE_PAIRS,
        prefs: [["browser.translations.select.enable", true]],
      });

    is(
      MockedA11yUtils.announceCalls.length,
      0,
      "There should be no A11yUtils announce calls."
    );

    await SelectTranslationsTestUtils.openPanel(runInPage, {
      selectFrenchSentence: true,
      openAtFrenchSentence: true,
      expectedFromLanguage: "fr",
      expectedToLanguage: "en",
      downloadHandler: resolveDownloads,
      onOpenPanel: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    MockedA11yUtils.assertMostRecentAnnounceCall({
      expectedCallNumber: 1,
      expectedArgs: {
        id: "select-translations-panel-translation-complete-announcement",
      },
    });

    await SelectTranslationsTestUtils.changeSelectedFromLanguage(["es"], {
      openDropdownMenu: false,
      downloadHandler: resolveDownloads,
      onChangeLanguage: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    MockedA11yUtils.assertMostRecentAnnounceCall({
      expectedCallNumber: 2,
      expectedArgs: {
        id: "select-translations-panel-translation-complete-announcement",
      },
    });

    await SelectTranslationsTestUtils.changeSelectedToLanguage(["fr"], {
      openDropdownMenu: false,
      downloadHandler: resolveDownloads,
      pivotTranslation: true,
      onChangeLanguage: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    MockedA11yUtils.assertMostRecentAnnounceCall({
      expectedCallNumber: 3,
      expectedArgs: {
        id: "select-translations-panel-translation-complete-announcement",
      },
    });

    await SelectTranslationsTestUtils.changeSelectedToLanguage(["uk"], {
      openDropdownMenu: false,
      downloadHandler: rejectDownloads,
      pivotTranslation: true,
      onChangeLanguage:
        SelectTranslationsTestUtils.assertPanelViewTranslationFailure,
    });

    is(
      MockedA11yUtils.announceCalls.length,
      3,
      "A failed translation should not announce that the translation is complete."
    );

    await SelectTranslationsTestUtils.clickCancelButton();

    await cleanup();
  }
);
