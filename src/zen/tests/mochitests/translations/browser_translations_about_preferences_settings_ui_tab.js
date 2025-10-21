/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(
  async function test_translations_settings_about_preferences_translations_tab() {
    const { cleanup } = await setupAboutPreferences(LANGUAGE_PAIRS, {
      prefs: [["browser.translations.newSettingsUI.enable", true]],
    });

    info(
      'Open translations settings directly with URL "about:preferences#translations" to ensure that the translations settings elements are visible. This proves that the attribute data-subpanel="true" in the translations settings elements is working'
    );
    const tab = await BrowserTestUtils.openNewForegroundTab(
      gBrowser,
      "about:preferences#translations",
      true // waitForLoad
    );

    const translationsPane =
      content.window.gCategoryModules.get("paneTranslations");
    const {
      translationsSettingsBackButton,
      translationsSettingsHeader,
      translationsSettingsDescription,
      translateAlwaysHeader,
      translateNeverHeader,
      alwaysTranslateMenuList,
      neverTranslateMenuList,
      translateNeverSiteHeader,
      translateNeverSiteDesc,
      translateDownloadLanguagesLearnMore,
    } = translationsPane.elements;

    assertVisibility({
      message: "Expect paneTranslations elements to be visible.",
      visible: {
        translationsSettingsBackButton,
        translationsSettingsHeader,
        translationsSettingsDescription,
        translateAlwaysHeader,
        translateNeverHeader,
        alwaysTranslateMenuList,
        neverTranslateMenuList,
        translateNeverSiteHeader,
        translateNeverSiteDesc,
        translateDownloadLanguagesLearnMore,
      },
    });

    BrowserTestUtils.removeTab(tab);

    await cleanup();
  }
);
