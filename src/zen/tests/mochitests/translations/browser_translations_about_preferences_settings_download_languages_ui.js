/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_translations_settings_download_languages() {
  await testWithAndWithoutLexicalShortlist(async lexicalShortlistPrefs => {
    const {
      cleanup,
      remoteClients,
      elements: { settingsButton },
    } = await setupAboutPreferences(LANGUAGE_PAIRS, {
      prefs: [
        ["browser.translations.newSettingsUI.enable", true],
        ...lexicalShortlistPrefs,
      ],
    });

    assertVisibility({
      message: "Expect paneGeneral elements to be visible.",
      visible: { settingsButton },
    });

    info(
      "Open translations settings page by clicking on translations settings button."
    );
    const { downloadLanguageList } =
      await TranslationsSettingsTestUtils.openAboutPreferencesTranslationsSettingsPane(
        settingsButton
      );

    info("Test French language model install and uninstall function.");

    let langFr = Array.from(
      downloadLanguageList.querySelectorAll("label")
    ).find(el => el.getAttribute("value") === "fr");

    let clickButton = BrowserTestUtils.waitForEvent(
      langFr.parentNode.querySelector("moz-button"),
      "click"
    );
    langFr.parentNode.querySelector("moz-button").click();
    await clickButton;

    const frenchModels = languageModelNames([
      { fromLang: "fr", toLang: "en" },
      { fromLang: "en", toLang: "fr" },
    ]);

    Assert.deepEqual(
      await remoteClients.translationModels.resolvePendingDownloads(
        frenchModels.length
      ),
      frenchModels,
      "French models were downloaded."
    );

    await TranslationsSettingsTestUtils.downaloadButtonClick(
      langFr,
      "translations-settings-remove-icon",
      "Delete icon is visible on French button."
    );

    langFr.parentNode.querySelector("moz-button").click();
    await clickButton;

    await TranslationsSettingsTestUtils.downaloadButtonClick(
      langFr,
      "translations-settings-download-icon",
      "Download icon is visible on French Button."
    );

    info("Test 'All language' models install and uninstall function");

    // Download "All languages" is the first child
    let langAll = downloadLanguageList.children[0];

    let clickButtonAll = BrowserTestUtils.waitForEvent(
      langAll.querySelector("moz-button"),
      "click"
    );
    langAll.querySelector("moz-button").click();
    await clickButtonAll;

    const allModels = languageModelNames(LANGUAGE_PAIRS);

    Assert.deepEqual(
      await remoteClients.translationModels.resolvePendingDownloads(
        allModels.length
      ),
      allModels,
      "All models were downloaded."
    );
    Assert.deepEqual(
      await remoteClients.translationsWasm.resolvePendingDownloads(1),
      ["bergamot-translator"],
      "Wasm was downloaded."
    );

    await TranslationsSettingsTestUtils.downaloadButtonClick(
      langAll,
      "translations-settings-remove-icon",
      "Delete icon is visible on 'All languages' button"
    );

    langAll.querySelector("moz-button").click();
    await clickButton;

    await TranslationsSettingsTestUtils.downaloadButtonClick(
      langAll,
      "translations-settings-download-icon",
      "Download icon is visible on 'All Language' button."
    );

    await cleanup();
  });
});
