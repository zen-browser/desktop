/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test case tests functionality of the SelectTranslationsPanel copy button
 * when retranslating by closing the panel and re-opening the panel to new links
 * or selections of text.
 */
add_task(async function test_select_translations_panel_copy_button_on_reopen() {
  const { cleanup, runInPage, resolveDownloads } = await loadTestPage({
    page: SELECT_TEST_PAGE_URL,
    languagePairs: LANGUAGE_PAIRS,
    prefs: [["browser.translations.select.enable", true]],
  });

  await SelectTranslationsTestUtils.openPanel(runInPage, {
    openAtSpanishHyperlink: true,
    expectedFromLanguage: "es",
    expectedToLanguage: "en",
    downloadHandler: resolveDownloads,
    onOpenPanel: SelectTranslationsTestUtils.assertPanelViewTranslated,
  });

  await SelectTranslationsTestUtils.clickCopyButton();
  await SelectTranslationsTestUtils.clickDoneButton();

  await SelectTranslationsTestUtils.openPanel(runInPage, {
    selectEnglishSection: true,
    openAtEnglishSection: true,
    expectedFromLanguage: "en",
    expectedToLanguage: "en",
    onOpenPanel: SelectTranslationsTestUtils.assertPanelViewTranslated,
  });

  await SelectTranslationsTestUtils.clickCopyButton();
  await SelectTranslationsTestUtils.clickDoneButton();

  await SelectTranslationsTestUtils.openPanel(runInPage, {
    selectFrenchSection: true,
    openAtFrenchSection: true,
    expectedFromLanguage: "fr",
    expectedToLanguage: "en",
    downloadHandler: resolveDownloads,
    onOpenPanel: SelectTranslationsTestUtils.assertPanelViewTranslated,
  });

  await SelectTranslationsTestUtils.clickCopyButton();
  await SelectTranslationsTestUtils.clickDoneButton();

  await cleanup();
});

/**
 * This test case tests functionality of the SelectTranslationsPanel copy button
 * when retranslating by changing the from-language and to-language values for
 * the same selection of source text.
 */
add_task(
  async function test_select_translations_panel_copy_button_on_retranslate() {
    const { cleanup, runInPage, resolveDownloads } = await loadTestPage({
      page: SELECT_TEST_PAGE_URL,
      languagePairs: LANGUAGE_PAIRS,
      prefs: [["browser.translations.select.enable", true]],
    });

    await SelectTranslationsTestUtils.openPanel(runInPage, {
      selectFrenchSection: true,
      openAtFrenchSection: true,
      expectedFromLanguage: "fr",
      expectedToLanguage: "en",
      downloadHandler: resolveDownloads,
      onOpenPanel: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    await SelectTranslationsTestUtils.clickCopyButton();
    await SelectTranslationsTestUtils.changeSelectedFromLanguage(["es"], {
      openDropdownMenu: true,
      downloadHandler: resolveDownloads,
      onChangeLanguage: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    await SelectTranslationsTestUtils.clickCopyButton();
    await SelectTranslationsTestUtils.changeSelectedToLanguage(["es"], {
      openDropdownMenu: false,
      onChangeLanguage: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    await SelectTranslationsTestUtils.clickCopyButton();
    await SelectTranslationsTestUtils.clickDoneButton();

    await cleanup();
  }
);
