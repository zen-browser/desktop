/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test verifies that when language models are added or removed from Remote Settings,
 * then the list of available languages is immediately reflected in the SelectTranslationsPanel's
 * dropdown menu lists upon the panel's next open.
 */
add_task(
  async function test_select_translations_panel_modify_available_language_models() {
    const { runInPage, remoteClients, resolveDownloads, cleanup } =
      await loadTestPage({
        page: SELECT_TEST_PAGE_URL,
        languagePairs: LANGUAGE_PAIRS,
      });

    const { fromMenuList, toMenuList } = SelectTranslationsPanel.elements;

    await SelectTranslationsTestUtils.openPanel(runInPage, {
      selectSpanishSentence: true,
      openAtSpanishSentence: true,
      expectedFromLanguage: "es",
      expectedToLanguage: "en",
      downloadHandler: resolveDownloads,
      onOpenPanel: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });
    ok(
      !fromMenuList.querySelector('[value="ja"]'),
      "The SelectTranslationsPanel has no selection for Japanese in the from-menu-list."
    );
    ok(
      !toMenuList.querySelector('[value="ja"]'),
      "The SelectTranslationsPanel has no selection for Japanese in the to-menu-list."
    );

    await SelectTranslationsTestUtils.clickDoneButton();

    const recordsForEnJa = createRecordsForLanguagePair("en", "ja");
    const recordsForJaEn = createRecordsForLanguagePair("ja", "en");

    info("Publishing Japanese as a source language in Remote Settings.");
    await modifyRemoteSettingsRecords(remoteClients.translationModels.client, {
      recordsToCreate: recordsForJaEn,
      expectedCreatedRecordsCount: RECORDS_PER_LANGUAGE_PAIR_SHARED_VOCAB,
    });

    await SelectTranslationsTestUtils.openPanel(runInPage, {
      selectSpanishSentence: true,
      openAtSpanishSentence: true,
      expectedFromLanguage: "es",
      expectedToLanguage: "en",
      onOpenPanel: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });
    ok(
      fromMenuList.querySelector('[value="ja"]'),
      "The SelectTranslationsPanel now has a selection for Japanese in the from-menu-list."
    );
    ok(
      !toMenuList.querySelector('[value="ja"]'),
      "The SelectTranslationsPanel still has no selection for Japanese in the to-menu-list."
    );
    await SelectTranslationsTestUtils.changeSelectedFromLanguage(["ja"], {
      openDropdownMenu: true,
      downloadHandler: resolveDownloads,
      onChangeLanguage: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    await SelectTranslationsTestUtils.clickDoneButton();

    info("Removing Japanese as a source language from Remote Settings.");
    await modifyRemoteSettingsRecords(remoteClients.translationModels.client, {
      recordsToDelete: recordsForJaEn,
      expectedDeletedRecordsCount: RECORDS_PER_LANGUAGE_PAIR_SHARED_VOCAB,
    });

    await SelectTranslationsTestUtils.openPanel(runInPage, {
      selectSpanishSection: true,
      openAtSpanishSection: true,
      expectedFromLanguage: "es",
      expectedToLanguage: "en",
      onOpenPanel: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });
    ok(
      !fromMenuList.querySelector('[value="ja"]'),
      "The SelectTranslationsPanel no longer has a selection for Japanese in the from-menu-list."
    );
    ok(
      !toMenuList.querySelector('[value="ja"]'),
      "The SelectTranslationsPanel still has no selection for Japanese in the to-menu-list."
    );

    await SelectTranslationsTestUtils.clickDoneButton();

    info("Publishing Japanese as a target language in Remote Settings.");
    await modifyRemoteSettingsRecords(remoteClients.translationModels.client, {
      recordsToCreate: recordsForEnJa,
      expectedCreatedRecordsCount: RECORDS_PER_LANGUAGE_PAIR_SHARED_VOCAB,
    });

    await SelectTranslationsTestUtils.openPanel(runInPage, {
      selectFrenchSection: true,
      openAtFrenchSection: true,
      expectedFromLanguage: "fr",
      expectedToLanguage: "en",
      downloadHandler: resolveDownloads,
      onOpenPanel: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });
    ok(
      !fromMenuList.querySelector('[value="ja"]'),
      "The SelectTranslationsPanel still has no selection for Japanese in the from-menu-list."
    );
    ok(
      toMenuList.querySelector('[value="ja"]'),
      "The SelectTranslationsPanel now has a selection for Japanese in the to-menu-list."
    );
    await SelectTranslationsTestUtils.changeSelectedToLanguage(["ja"], {
      openDropdownMenu: false,
      pivotTranslation: true,
      downloadHandler: resolveDownloads,
      onChangeLanguage: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    await SelectTranslationsTestUtils.clickDoneButton();

    info("Republishing Japanese as a source language in Remote Settings.");
    await modifyRemoteSettingsRecords(remoteClients.translationModels.client, {
      recordsToCreate: recordsForJaEn,
      expectedCreatedRecordsCount: RECORDS_PER_LANGUAGE_PAIR_SHARED_VOCAB,
    });

    await SelectTranslationsTestUtils.openPanel(runInPage, {
      selectFrenchSentence: true,
      openAtFrenchSentence: true,
      expectedFromLanguage: "fr",
      expectedToLanguage: "ja",
      onOpenPanel: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });
    ok(
      fromMenuList.querySelector('[value="ja"]'),
      "The SelectTranslationsPanel now has a selection for Japanese in the from-menu-list."
    );
    ok(
      toMenuList.querySelector('[value="ja"]'),
      "The SelectTranslationsPanel still has a selection for Japanese in the to-menu-list."
    );
    await SelectTranslationsTestUtils.changeSelectedToLanguage(["es"], {
      openDropdownMenu: true,
      pivotTranslation: true,
      downloadHandler: resolveDownloads,
      onChangeLanguage: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });
    await SelectTranslationsTestUtils.changeSelectedFromLanguage(["ja"], {
      openDropdownMenu: true,
      pivotTranslation: true,
      downloadHandler: resolveDownloads,
      onChangeLanguage: SelectTranslationsTestUtils.assertPanelViewTranslated,
    });

    await cleanup();
  }
);
