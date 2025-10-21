/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test case verifies the behavior of the SelectTranslationsPanel when the source
 * language has a script tag and the target language does not have a script tag.
 */
add_task(
  async function test_select_translations_panel_source_lang_has_script_tag() {
    const { cleanup, runInPage, resolveDownloads } = await loadTestPage({
      page: SELECT_TEST_PAGE_URL,
      languagePairs: [
        { fromLang: "es", toLang: "en" },
        { fromLang: "en", toLang: "es" },
        { fromLang: "zh-Hant", toLang: "en" },
      ],
      prefs: [["browser.translations.select.enable", true]],
    });

    await SelectTranslationsTestUtils.openPanel(runInPage, {
      selectSpanishSentence: true,
      openAtSpanishSentence: true,
      expectedFromLanguage: "es",
      expectedToLanguage: "en",
      downloadHandler: resolveDownloads,
      onOpenPanel: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    await SelectTranslationsTestUtils.changeSelectedFromLanguage(["zh-Hant"], {
      openDropdownMenu: false,
      downloadHandler: resolveDownloads,
      onChangeLanguage: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    await SelectTranslationsTestUtils.clickDoneButton();

    await cleanup();
  }
);

/**
 * This test case verifies the behavior of the SelectTranslationsPanel when the target
 * language has a script tag and the source language does not have a script tag.
 */
add_task(
  async function test_select_translations_panel_target_lang_has_script_tag() {
    const { cleanup, runInPage, resolveDownloads } = await loadTestPage({
      page: SELECT_TEST_PAGE_URL,
      languagePairs: [
        { fromLang: "es", toLang: "en" },
        { fromLang: "en", toLang: "es" },
        { fromLang: "en", toLang: "zh-Hans" },
      ],
      prefs: [["browser.translations.select.enable", true]],
    });

    await SelectTranslationsTestUtils.openPanel(runInPage, {
      selectSpanishSentence: true,
      openAtSpanishSentence: true,
      expectedFromLanguage: "es",
      expectedToLanguage: "en",
      downloadHandler: resolveDownloads,
      onOpenPanel: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    await SelectTranslationsTestUtils.changeSelectedToLanguage(["zh-Hans"], {
      openDropdownMenu: true,
      downloadHandler: resolveDownloads,
      pivotTranslation: true,
      onChangeLanguage: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    await SelectTranslationsTestUtils.clickDoneButton();

    await cleanup();
  }
);

/**
 * This test case verifies the behavior of the SelectTranslationsPanel when both the source
 * language and the target language have a script tag.
 */
add_task(
  async function test_select_translations_panel_source_and_target_langs_have_script_tags() {
    const { cleanup, runInPage, resolveDownloads } = await loadTestPage({
      page: SELECT_TEST_PAGE_URL,
      languagePairs: [
        { fromLang: "es", toLang: "en" },
        { fromLang: "en", toLang: "es" },
        { fromLang: "zh-Hans", toLang: "en" },
        { fromLang: "en", toLang: "zh-Hans" },
        { fromLang: "zh-Hant", toLang: "en" },
        { fromLang: "en", toLang: "zh-Hant" },
      ],
      prefs: [["browser.translations.select.enable", true]],
    });

    await SelectTranslationsTestUtils.openPanel(runInPage, {
      selectSpanishSentence: true,
      openAtSpanishSentence: true,
      expectedFromLanguage: "es",
      expectedToLanguage: "en",
      downloadHandler: resolveDownloads,
      onOpenPanel: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    await SelectTranslationsTestUtils.changeSelectedFromLanguage(["zh-Hant"], {
      openDropdownMenu: false,
      downloadHandler: resolveDownloads,
      onChangeLanguage: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    await SelectTranslationsTestUtils.changeSelectedToLanguage(["zh-Hans"], {
      openDropdownMenu: true,
      downloadHandler: resolveDownloads,
      pivotTranslation: true,
      onChangeLanguage: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    await SelectTranslationsTestUtils.clickDoneButton();

    await cleanup();
  }
);
