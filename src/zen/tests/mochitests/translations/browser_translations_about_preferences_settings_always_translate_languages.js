/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(
  async function test_about_preferences_always_translate_language_settings() {
    const {
      cleanup,
      elements: { settingsButton },
    } = await setupAboutPreferences(LANGUAGE_PAIRS, {
      prefs: [["browser.translations.newSettingsUI.enable", false]],
    });

    info("Ensuring the list of always-translate languages is empty");
    is(
      getAlwaysTranslateLanguagesFromPref().length,
      0,
      "The list of always-translate languages is empty"
    );

    info("Adding two languages to the alwaysTranslateLanguages pref");
    Services.prefs.setCharPref(ALWAYS_TRANSLATE_LANGS_PREF, "fr,de");

    const dialogWindow = await waitForOpenDialogWindow(
      "chrome://browser/content/preferences/dialogs/translations.xhtml",
      () => {
        click(
          settingsButton,
          "Opening the about:preferences Translations Settings"
        );
      }
    );
    let tree = dialogWindow.document.getElementById(
      "alwaysTranslateLanguagesTree"
    );
    let remove = dialogWindow.document.getElementById(
      "removeAlwaysTranslateLanguage"
    );
    let removeAll = dialogWindow.document.getElementById(
      "removeAllAlwaysTranslateLanguages"
    );

    is(
      tree.view.rowCount,
      2,
      "The always-translate languages list has 2 items"
    );
    ok(remove.disabled, "The 'Remove Language' button is disabled");
    ok(!removeAll.disabled, "The 'Remove All Languages' button is enabled");

    info("Selecting the first always-translate language.");
    tree.view.selection.select(0);
    ok(!remove.disabled, "The 'Remove Language' button is enabled");

    click(remove, "Clicking the remove-language button");
    is(
      tree.view.rowCount,
      1,
      "The always-translate languages list now contains 1 item"
    );
    is(
      getAlwaysTranslateLanguagesFromPref().length,
      1,
      "One language tag in the pref"
    );

    info("Removing all languages from the alwaysTranslateLanguages pref");
    Services.prefs.setCharPref(ALWAYS_TRANSLATE_LANGS_PREF, "");
    is(tree.view.rowCount, 0, "The always-translate languages list is empty");
    ok(remove.disabled, "The 'Remove Language' button is disabled");
    ok(removeAll.disabled, "The 'Remove All Languages' button is disabled");

    info("Adding more languages to the alwaysTranslateLanguages pref");
    Services.prefs.setCharPref(ALWAYS_TRANSLATE_LANGS_PREF, "fr,en,es");
    is(
      tree.view.rowCount,
      3,
      "The always-translate languages list has 3 items"
    );
    ok(remove.disabled, "The 'Remove Language' button is disabled");
    ok(!removeAll.disabled, "The 'Remove All Languages' button is enabled");

    click(removeAll, "Clicking the remove-all languages button");
    is(tree.view.rowCount, 0, "The always-translate languages list is empty");
    ok(remove.disabled, "The 'Remove Language' button is disabled");
    ok(removeAll.disabled, "The 'Remove All Languages' button is disabled");
    is(
      getAlwaysTranslateLanguagesFromPref().length,
      0,
      "There are no languages in the alwaysTranslateLanguages pref"
    );

    await waitForCloseDialogWindow(dialogWindow);
    await cleanup();
  }
);
