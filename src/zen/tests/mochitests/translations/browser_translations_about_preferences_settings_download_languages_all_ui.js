/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_translations_settings_download_languages_all() {
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

  const ukrainianModels = languageModelNames([
    { fromLang: "uk", toLang: "en" },
    { fromLang: "en", toLang: "uk" },
  ]);

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

  info(
    "Install each language French, Spanish and Ukrainian and check if All language state changes to 'all language downloaded' by changing the all language button icon to 'remove icon'"
  );

  info("Download French language model.");
  let langFr = Array.from(downloadLanguageList.querySelectorAll("label")).find(
    el => el.getAttribute("value") === "fr"
  );

  let clickButton = BrowserTestUtils.waitForEvent(
    langFr.parentNode.querySelector("moz-button"),
    "click"
  );
  langFr.parentNode.querySelector("moz-button").click();
  await clickButton;

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
    "Delete icon is visible for French language hence downloaded"
  );

  info("Download Spanish language model.");

  let langEs = Array.from(downloadLanguageList.querySelectorAll("label")).find(
    el => el.getAttribute("value") === "es"
  );

  clickButton = BrowserTestUtils.waitForEvent(
    langEs.parentNode.querySelector("moz-button"),
    "click"
  );
  langEs.parentNode.querySelector("moz-button").click();
  await clickButton;

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

  info("Download Ukrainian language model.");

  let langUk = Array.from(downloadLanguageList.querySelectorAll("label")).find(
    el => el.getAttribute("value") === "uk"
  );

  clickButton = BrowserTestUtils.waitForEvent(
    langUk.parentNode.querySelector("moz-button"),
    "click"
  );
  langUk.parentNode.querySelector("moz-button").click();
  await clickButton;

  Assert.deepEqual(
    await remoteClients.translationModels.resolvePendingDownloads(
      ukrainianModels.length
    ),
    ukrainianModels,
    "Ukrainian models were downloaded."
  );

  await TranslationsSettingsTestUtils.downaloadButtonClick(
    langUk,
    "translations-settings-remove-icon",
    "Delete icon is visible for Ukranian language hence downloaded."
  );

  // Download "All languages" is the first child
  let langAll = downloadLanguageList.children[0];

  ok(
    langAll
      .querySelector("moz-button")
      .classList.contains("translations-settings-remove-icon"),
    "Delete icon is visible for All Languages after all individual language models were downloaded."
  );

  info(
    "Remove one language ensure that All Languages change state changes to 'removed' to indicate that all languages are not downloaded."
  );

  info("Remove Spanish language model.");
  langEs.parentNode.querySelector("moz-button").click();
  await clickButton;

  await TranslationsSettingsTestUtils.downaloadButtonClick(
    langEs,
    "translations-settings-download-icon",
    "Download icon is visible for Spanish language hence removed"
  );

  ok(
    langAll
      .querySelector("moz-button")
      .classList.contains("translations-settings-download-icon"),
    "Download icon is visible for all languages i.e. all languages are not downloaded since one language, Spanish was removed."
  );

  await cleanup();
});
