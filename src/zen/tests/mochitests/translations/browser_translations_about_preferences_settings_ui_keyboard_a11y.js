/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { PermissionTestUtils } = ChromeUtils.importESModule(
  "resource://testing-common/PermissionTestUtils.sys.mjs"
);

add_task(async function test_translations_settings_keyboard_a11y() {
  const {
    cleanup,
    elements: { settingsButton },
  } = await setupAboutPreferences(LANGUAGE_PAIRS, {
    prefs: [["browser.translations.newSettingsUI.enable", true]],
  });

  info(
    "Open translations settings page by clicking on translations settings button."
  );
  assertVisibility({
    message: "Expect paneGeneral elements to be visible.",
    visible: { settingsButton },
  });

  const {
    translationsSettingsBackButton,
    alwaysTranslateMenuList,
    neverTranslateMenuList,
    translateDownloadLanguagesLearnMore,
    downloadLanguageList,
  } =
    await TranslationsSettingsTestUtils.openAboutPreferencesTranslationsSettingsPane(
      settingsButton
    );

  const document = gBrowser.selectedBrowser.contentDocument;

  info("Press the Tab key to focus the first page element, the back button");

  EventUtils.synthesizeKey("KEY_Tab");
  is(
    document.activeElement.id,
    translationsSettingsBackButton.id,
    "Key is focused on back button"
  );

  info(
    "Press the Tab key to focus the next page element, the Always Translate Menulist button"
  );

  EventUtils.synthesizeKey("KEY_Tab");
  is(
    document.activeElement.id,
    alwaysTranslateMenuList.id,
    "Key is focused on Always Translate Menulist button"
  );

  info(
    "Press the Tab key to focus the next page element, the Never Translate Menulist button"
  );
  EventUtils.synthesizeKey("KEY_Tab");
  is(
    document.activeElement.id,
    neverTranslateMenuList.id,
    "Key is focused on Never Translate Menulist button"
  );

  info(
    "Press the Tab key to focus the next page element, the Download Languages' Learn More link"
  );
  EventUtils.synthesizeKey("KEY_Tab");
  is(
    document.activeElement.id,
    translateDownloadLanguagesLearnMore.id,
    "Key is focused on Download Languages' Learn More link"
  );

  info(
    "Press the Tab key to focus the next page element, the Download Languages list section"
  );
  EventUtils.synthesizeKey("KEY_Tab");
  is(
    document.activeElement.id,
    downloadLanguageList.id,
    "Key is focused on Download Languages list section"
  );

  await cleanup();
});

add_task(async function test_translations_settings_keyboard_download_a11y() {
  const {
    cleanup,
    elements: { settingsButton },
  } = await setupAboutPreferences(LANGUAGE_PAIRS, {
    prefs: [["browser.translations.newSettingsUI.enable", true]],
  });

  info(
    "Open translations settings page by clicking on translations settings button."
  );
  assertVisibility({
    message: "Expect paneGeneral elements to be visible.",
    visible: { settingsButton },
  });

  const {
    translationsSettingsBackButton,
    alwaysTranslateMenuList,
    neverTranslateMenuList,
    translateDownloadLanguagesLearnMore,
    downloadLanguageList,
  } =
    await TranslationsSettingsTestUtils.openAboutPreferencesTranslationsSettingsPane(
      settingsButton
    );

  const document = gBrowser.selectedBrowser.contentDocument;

  info("Press the Tab key to focus the first page element, the back button");

  EventUtils.synthesizeKey("KEY_Tab");
  is(
    document.activeElement.id,
    translationsSettingsBackButton.id,
    "Key is focused on back button"
  );

  info(
    "Press the Tab key to focus the next page element, the Always Translate Menulist button"
  );
  EventUtils.synthesizeKey("KEY_Tab");
  is(
    document.activeElement.id,
    alwaysTranslateMenuList.id,
    "Key is focused on Always Translate Menulist button"
  );

  info(
    "Press the Tab key to focus the next page element, the Never Translate Menulist button"
  );
  EventUtils.synthesizeKey("KEY_Tab");
  is(
    document.activeElement.id,
    neverTranslateMenuList.id,
    "Key is focused on Never Translate Menulist button"
  );

  info(
    "Press the Tab key to focus the next page element, the Download Languages' Learn More link"
  );
  EventUtils.synthesizeKey("KEY_Tab");
  is(
    document.activeElement.id,
    translateDownloadLanguagesLearnMore.id,
    "Key is focused on Download Languages' Learn More link"
  );

  info(
    "Press the Tab key to focus the next page element, the Download Languages list section"
  );
  EventUtils.synthesizeKey("KEY_Tab");
  is(
    document.activeElement.id,
    downloadLanguageList.id,
    "Key is focused on Download Languages list section"
  );

  info(
    "Press the Arrow Down key to focus the first language element in the Download List Section"
  );

  for (let element of downloadLanguageList.children) {
    info(
      "Press the Arrow Down key to focus the next language element in the Download List Section"
    );
    EventUtils.synthesizeKey("KEY_ArrowDown");
    is(
      document.activeElement.parentNode.id,
      element.id,
      "Key is focused on the language " +
        element.querySelector("label").textContent +
        " within the language list"
    );
  }

  is(
    document.activeElement.parentNode.id,
    downloadLanguageList.lastElementChild.id,
    "Key is focused on the last language " +
      downloadLanguageList.lastElementChild.querySelector("label").textContent +
      " within the language list"
  );

  info(
    "Press the Arrow up key to focus the previous language element in the Download List Section"
  );
  for (let i = downloadLanguageList.children.length - 2; i >= 0; i--) {
    info(
      "Press the Arrow up key to focus the previous language element in the Download List Section"
    );
    EventUtils.synthesizeKey("KEY_ArrowUp");
    is(
      document.activeElement.parentNode.id,
      downloadLanguageList.children[i].id,
      "Key is focused on the language " +
        downloadLanguageList.children[i].querySelector("label").textContent +
        " within the language list"
    );
  }

  is(
    document.activeElement.parentNode.id,
    downloadLanguageList.firstElementChild.id,
    "Key is focused on the first language within the language list"
  );

  await cleanup();
});

add_task(
  async function test_translations_settings_keyboard_never_translate_site_a11y() {
    const {
      cleanup,
      elements: { settingsButton },
    } = await setupAboutPreferences(LANGUAGE_PAIRS, {
      prefs: [["browser.translations.newSettingsUI.enable", true]],
    });

    info(
      "Open translations settings page by clicking on translations settings button."
    );
    assertVisibility({
      message: "Expect paneGeneral elements to be visible.",
      visible: { settingsButton },
    });

    const {
      translationsSettingsBackButton,
      alwaysTranslateMenuList,
      neverTranslateMenuList,
      neverTranslateSiteList,
      translateDownloadLanguagesLearnMore,
    } =
      await TranslationsSettingsTestUtils.openAboutPreferencesTranslationsSettingsPane(
        settingsButton
      );

    is(
      neverTranslateSiteList.childElementCount,
      0,
      "The never-translate sites html list is empty"
    );

    info("Adding sites to the neverTranslateSites perms");
    await PermissionTestUtils.add(
      "https://example.com",
      TRANSLATIONS_PERMISSION,
      Services.perms.DENY_ACTION
    );
    await PermissionTestUtils.add(
      "https://example.org",
      TRANSLATIONS_PERMISSION,
      Services.perms.DENY_ACTION
    );
    await PermissionTestUtils.add(
      "https://example.net",
      TRANSLATIONS_PERMISSION,
      Services.perms.DENY_ACTION
    );

    is(
      getNeverTranslateSitesFromPerms().length,
      3,
      "The list of never-translate sites has 3 elements"
    );

    const document = gBrowser.selectedBrowser.contentDocument;

    info("Press the Tab key to focus the first page element, the back button");
    EventUtils.synthesizeKey("KEY_Tab");
    is(
      document.activeElement.id,
      translationsSettingsBackButton.id,
      "Key is focused on back button"
    );

    info(
      "Press the Tab key to focus the next page element, the Always Translate Menulist button"
    );
    EventUtils.synthesizeKey("KEY_Tab");
    is(
      document.activeElement.id,
      alwaysTranslateMenuList.id,
      "Key is focused on Always Translate Menulist button"
    );

    info(
      "Press the Tab key to focus the next page element, the Never Translate Menulist button"
    );
    EventUtils.synthesizeKey("KEY_Tab");
    is(
      document.activeElement.id,
      neverTranslateMenuList.id,
      "Key focus is now Never Translate List Menu button"
    );

    info(
      "Press the Tab key to focus the next page element, the Never Translate Site List section"
    );
    EventUtils.synthesizeKey("KEY_Tab");
    is(
      document.activeElement.id,
      neverTranslateSiteList.id,
      "Key focus is now Never Translate Site List"
    );
    info(
      "Press the Arrow Down key to focus the first site element in the Never Translate Site List"
    );
    for (const site of neverTranslateSiteList.children) {
      info(
        "Press the Arrow Down key to focus the next site element in the Never Translate Site List"
      );
      EventUtils.synthesizeKey("KEY_ArrowDown");
      is(
        document.activeElement.parentNode.id,
        site.id,
        "Key focus is now Never Translate Site list element " +
          site.querySelector("label").textContent
      );
    }
    is(
      document.activeElement.parentNode.id,
      neverTranslateSiteList.lastElementChild.id,
      "Key is focused on the last site " +
        neverTranslateSiteList.lastElementChild.querySelector("label")
          .textContent +
        " within the site list"
    );

    info(
      "Press the Arrow up key to focus the previous site element in the Never Translate Site List"
    );
    for (let i = neverTranslateSiteList.children.length - 2; i >= 0; i--) {
      info(
        "Press the Arrow up key to focus the previous site element in the Never Translate Site List"
      );
      EventUtils.synthesizeKey("KEY_ArrowUp");
      is(
        document.activeElement.parentNode.id,
        neverTranslateSiteList.children[i].id,
        "Key is focused on the site " +
          neverTranslateSiteList.children[i].querySelector("label")
            .textContent +
          " within the site list"
      );
    }

    info(
      "Press the Tab key to focus the next page element, the Download Languages' Learn More link"
    );
    EventUtils.synthesizeKey("KEY_Tab");
    is(
      document.activeElement.id,
      translateDownloadLanguagesLearnMore.id,
      "Key is focused on Download Languages' Learn More link"
    );

    await cleanup();
  }
);

add_task(
  async function test_translations_settings_keyboard_never_translate_a11y() {
    const {
      cleanup,
      elements: { settingsButton },
    } = await setupAboutPreferences(LANGUAGE_PAIRS, {
      prefs: [["browser.translations.newSettingsUI.enable", true]],
    });

    info(
      "Open translations settings page by clicking on translations settings button."
    );
    assertVisibility({
      message: "Expect paneGeneral elements to be visible.",
      visible: { settingsButton },
    });

    const {
      translationsSettingsBackButton,
      alwaysTranslateMenuList,
      neverTranslateMenuList,
      neverTranslateLanguageList,
      neverTranslateMenuPopup,
      translateDownloadLanguagesLearnMore,
    } =
      await TranslationsSettingsTestUtils.openAboutPreferencesTranslationsSettingsPane(
        settingsButton
      );

    const document = gBrowser.selectedBrowser.contentDocument;

    info("Press the Tab key to focus the first page element, the back button");

    EventUtils.synthesizeKey("KEY_Tab");
    is(
      document.activeElement.id,
      translationsSettingsBackButton.id,
      "Key is focused on back button"
    );

    info(
      "Press the Tab key to focus the next page element, the Always Translate Menulist button"
    );
    EventUtils.synthesizeKey("KEY_Tab");
    is(
      document.activeElement.id,
      alwaysTranslateMenuList.id,
      "Key is focused on Always Translate Menulist button"
    );

    info(
      "Press the Tab key to focus the next page element, the Never Translate Menulist button."
    );
    EventUtils.synthesizeKey("KEY_Tab");
    is(
      document.activeElement.id,
      neverTranslateMenuList.id,
      "Key is focused on Never Translate Menulist button"
    );

    info("Press the Arrow Down key to focus on the first list element.");
    for (const menuItem of neverTranslateMenuPopup.children) {
      if (AppConstants.platform === "macosx") {
        info("Opening the menu popup.");
        const popupPromise = BrowserTestUtils.waitForEvent(
          neverTranslateMenuPopup,
          "popupshown"
        );
        EventUtils.synthesizeKey("KEY_ArrowDown");
        await popupPromise;
      }

      EventUtils.synthesizeKey("KEY_ArrowDown");

      if (AppConstants.platform === "macosx") {
        info("Closing the menu popup.");
        const popupPromise = BrowserTestUtils.waitForEvent(
          neverTranslateMenuPopup,
          "popuphidden"
        );
        EventUtils.synthesizeKey("KEY_Enter");
        await popupPromise;
      } else {
        const { promise, resolve } = Promise.withResolvers();
        requestAnimationFrame(() => {
          requestAnimationFrame(resolve);
        });

        EventUtils.synthesizeKey("KEY_Enter");
        await promise;
      }

      is(
        neverTranslateLanguageList.firstElementChild.querySelector("label")
          .textContent,
        menuItem.textContent,
        menuItem.textContent + "is added to never translate language"
      );
    }

    info(
      "Press the Tab key to focus the next page element, the Never Translate list"
    );
    EventUtils.synthesizeKey("KEY_Tab");
    is(
      neverTranslateLanguageList.id,
      document.activeElement.id,
      "Key is focused on Always Translate list."
    );

    info("Press the Arrow Down key to focus on the first list element.");

    for (const lang of neverTranslateLanguageList.children) {
      EventUtils.synthesizeKey("KEY_ArrowDown");
      is(
        document.activeElement.parentNode.id,
        lang.id,
        "Key is focused on " +
          lang.querySelector("label").textContent +
          " element of Never Translate list."
      );
    }

    info(
      "Press the Tab key to focus the next page element, the Download Languages' Learn More link"
    );
    EventUtils.synthesizeKey("KEY_Tab");
    is(
      document.activeElement.id,
      translateDownloadLanguagesLearnMore.id,
      "Key is focused on Download Languages' Learn More link"
    );

    await cleanup();
  }
);

add_task(
  async function test_translations_settings_keyboard_always_translate_a11y() {
    const {
      cleanup,
      elements: { settingsButton },
    } = await setupAboutPreferences(LANGUAGE_PAIRS, {
      prefs: [["browser.translations.newSettingsUI.enable", true]],
    });

    info(
      "Open translations settings page by clicking on translations settings button."
    );
    assertVisibility({
      message: "Expect paneGeneral elements to be visible.",
      visible: { settingsButton },
    });

    const {
      translationsSettingsBackButton,
      alwaysTranslateMenuList,
      neverTranslateMenuList,
      alwaysTranslateLanguageList,
      alwaysTranslateMenuPopup,
    } =
      await TranslationsSettingsTestUtils.openAboutPreferencesTranslationsSettingsPane(
        settingsButton
      );

    const document = gBrowser.selectedBrowser.contentDocument;

    info("Press the Tab key to focus the first page element, the back button");

    EventUtils.synthesizeKey("KEY_Tab");
    is(
      document.activeElement.id,
      translationsSettingsBackButton.id,
      "Key is focused on back button"
    );

    info(
      "Press the Tab key to focus the next page element, the Always Translate Menulist button"
    );
    EventUtils.synthesizeKey("KEY_Tab");
    is(
      document.activeElement.id,
      alwaysTranslateMenuList.id,
      "Key is focused on Always Translate Menulist button"
    );

    info("Press the Arrow Down key to focus on the first list element.");
    for (const menuItem of alwaysTranslateMenuPopup.children) {
      if (AppConstants.platform === "macosx") {
        info("Opening the menu popup.");
        const popupPromise = BrowserTestUtils.waitForEvent(
          alwaysTranslateMenuPopup,
          "popupshown"
        );
        EventUtils.synthesizeKey("KEY_ArrowDown");
        await popupPromise;
      }

      EventUtils.synthesizeKey("KEY_ArrowDown");

      if (AppConstants.platform === "macosx") {
        info("Closing the menu popup.");
        const popupPromise = BrowserTestUtils.waitForEvent(
          alwaysTranslateMenuPopup,
          "popuphidden"
        );
        EventUtils.synthesizeKey("KEY_Enter");
        await popupPromise;
      } else {
        const { promise, resolve } = Promise.withResolvers();
        requestAnimationFrame(() => {
          requestAnimationFrame(resolve);
        });

        EventUtils.synthesizeKey("KEY_Enter");
        await promise;
      }

      is(
        alwaysTranslateLanguageList.firstElementChild.querySelector("label")
          .textContent,
        menuItem.textContent,
        menuItem.textContent + "is added to always translate language"
      );
    }

    info(
      "Press the Tab key to focus the next page element, the Always Translate list"
    );
    EventUtils.synthesizeKey("KEY_Tab");
    is(
      alwaysTranslateLanguageList.id,
      document.activeElement.id,
      "Key is focused on Always Translate list."
    );

    info("Press the Arrow Down key to focus on the first list element.");

    for (const lang of alwaysTranslateLanguageList.children) {
      EventUtils.synthesizeKey("KEY_ArrowDown");
      is(
        document.activeElement.parentNode.id,
        lang.id,
        "Key is focused on " +
          lang.querySelector("label").textContent +
          " element of Always Translate list."
      );
    }

    info(
      "Press the Tab key to focus the next page element, the Never Translate list"
    );
    EventUtils.synthesizeKey("KEY_Tab");
    is(
      document.activeElement.id,
      neverTranslateMenuList.id,
      "Key focus is now Never Translate List Menu button"
    );

    await cleanup();
  }
);
