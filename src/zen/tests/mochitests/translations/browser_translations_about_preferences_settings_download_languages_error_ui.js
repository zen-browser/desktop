/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(
  async function test_translations_settings_download_languages_error_handling() {
    const {
      cleanup,
      remoteClients,
      elements: { settingsButton },
    } = await setupAboutPreferences(LANGUAGE_PAIRS, {
      prefs: [["browser.translations.newSettingsUI.enable", true]],
    });

    const frenchModels = languageModelNames([
      { fromLang: "fr", toLang: "en" },
      { fromLang: "en", toLang: "fr" },
    ]);

    const spanishModels = languageModelNames([
      { fromLang: "es", toLang: "en" },
      { fromLang: "en", toLang: "es" },
    ]);

    const allModels = languageModelNames(LANGUAGE_PAIRS);

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

    info("Test French language model for download error");

    let langFr = Array.from(
      downloadLanguageList.querySelectorAll("label")
    ).find(el => el.getAttribute("value") === "fr");

    let clickButton = BrowserTestUtils.waitForEvent(
      langFr.parentNode.querySelector("moz-button"),
      "click"
    );
    langFr.parentNode.querySelector("moz-button").click();
    await clickButton;

    await captureTranslationsError(() =>
      remoteClients.translationModels.rejectPendingDownloads(
        frenchModels.length
      )
    );

    const errorElement = gBrowser.selectedBrowser.contentDocument.querySelector(
      ".translations-settings-language-error"
    );

    assertVisibility({
      message: "Moz-message-bar with error message is visible",
      visible: { errorElement },
    });
    is(
      document.l10n.getAttributes(errorElement).id,
      "translations-settings-language-download-error",
      "Error message correctly shows download error"
    );
    is(
      document.l10n.getAttributes(errorElement).args.name,
      "French",
      "Error message correctly shows download error for French language"
    );

    await TranslationsSettingsTestUtils.downaloadButtonClick(
      langFr,
      "translations-settings-download-icon",
      "Download icon is visible on French button"
    );

    remoteClients.translationsWasm.assertNoNewDownloads();

    info("Download Spanish language model successfully.");

    let langEs = Array.from(
      downloadLanguageList.querySelectorAll("label")
    ).find(el => el.getAttribute("value") === "es");

    clickButton = BrowserTestUtils.waitForEvent(
      langEs.parentNode.querySelector("moz-button"),
      "click"
    );
    langEs.parentNode.querySelector("moz-button").click();
    await clickButton;

    const errorElementEs =
      gBrowser.selectedBrowser.contentDocument.querySelector(
        ".translations-settings-language-error"
      );

    ok(
      !errorElementEs,
      "Previous error is remove when new action occured, i.e. click download Spanish button"
    );

    Assert.deepEqual(
      await remoteClients.translationModels.resolvePendingDownloads(
        spanishModels.length
      ),
      spanishModels,
      "Spanish models were downloaded."
    );

    await TranslationsSettingsTestUtils.downaloadButtonClick(
      langEs,
      "translations-settings-remove-icon",
      "Delete icon is visible for Spanish language hence downloaded"
    );

    info("Test All language models download error");
    // Download "All languages" is the first child
    let langAll = downloadLanguageList.children[0];

    let clickButtonAll = BrowserTestUtils.waitForEvent(
      langAll.querySelector("moz-button"),
      "click"
    );
    langAll.querySelector("moz-button").click();
    await clickButtonAll;

    await captureTranslationsError(() =>
      remoteClients.translationModels.rejectPendingDownloads(allModels.length)
    );

    await captureTranslationsError(() =>
      remoteClients.translationsWasm.rejectPendingDownloads(allModels.length)
    );

    remoteClients.translationsWasm.assertNoNewDownloads();

    await TranslationsSettingsTestUtils.downaloadButtonClick(
      langAll,
      "translations-settings-download-icon",
      "Download icon is visible for 'all languages'"
    );

    const errorElementAll =
      gBrowser.selectedBrowser.contentDocument.querySelector(
        ".translations-settings-language-error"
      );

    assertVisibility({
      message: "Moz-message-bar with error message is visible",
      visible: { errorElementAll },
    });
    is(
      document.l10n.getAttributes(errorElementAll).id,
      "translations-settings-language-download-error",
      "Error message correctly shows download error"
    );
    is(
      document.l10n.getAttributes(errorElementAll).args.name,
      "all",
      "Error message correctly shows download error for all language"
    );

    await cleanup();
  }
);
