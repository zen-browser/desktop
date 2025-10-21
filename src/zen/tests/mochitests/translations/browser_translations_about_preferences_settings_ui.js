/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_translations_settings_pane_elements() {
  const {
    cleanup,
    elements: { settingsButton },
  } = await setupAboutPreferences(LANGUAGE_PAIRS, {
    prefs: [["browser.translations.newSettingsUI.enable", true]],
  });

  assertVisibility({
    message: "Expect paneGeneral elements to be visible.",
    visible: { settingsButton },
  });

  info(
    "Open translations settings page by clicking on translations settings button."
  );
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
    downloadLanguageSection,
    translateDownloadLanguagesLearnMore,
  } =
    await TranslationsSettingsTestUtils.openAboutPreferencesTranslationsSettingsPane(
      settingsButton
    );

  const translateDownloadLanguagesHeader =
    downloadLanguageSection.querySelector("h2");
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
    hidden: {
      settingsButton,
    },
  });

  info(
    "In translations settings page, click on back button to go back to main preferences page."
  );
  const paneEvent = BrowserTestUtils.waitForEvent(
    document,
    "paneshown",
    false,
    event => event.detail.category === "paneGeneral"
  );

  click(translationsSettingsBackButton);
  await paneEvent;

  assertVisibility({
    message: "Expect paneGeneral elements to be visible.",
    visible: {
      settingsButton,
    },
    hidden: {
      translationsSettingsBackButton,
      translationsSettingsHeader,
      translationsSettingsDescription,
      translateAlwaysHeader,
      translateNeverHeader,
      alwaysTranslateMenuList,
      neverTranslateMenuList,
      translateNeverSiteHeader,
      translateNeverSiteDesc,
      translateDownloadLanguagesHeader,
      translateDownloadLanguagesLearnMore,
    },
  });
  await cleanup();
});

add_task(async function test_translations_settings_always_translate() {
  const {
    cleanup,
    elements: { settingsButton },
  } = await setupAboutPreferences(LANGUAGE_PAIRS, {
    prefs: [["browser.translations.newSettingsUI.enable", true]],
  });

  assertVisibility({
    message: "Expect paneGeneral elements to be visible.",
    visible: { settingsButton },
  });

  info(
    "Open translations settings page by clicking on translations settings button."
  );
  const {
    alwaysTranslateMenuList,
    alwaysTranslateLanguageList,
    alwaysTranslateMenuPopup,
  } =
    await TranslationsSettingsTestUtils.openAboutPreferencesTranslationsSettingsPane(
      settingsButton
    );

  info("Testing the Always translate langauge settings");
  await testLanguageList(
    alwaysTranslateLanguageList,
    alwaysTranslateMenuList,
    alwaysTranslateMenuPopup,
    ALWAYS_TRANSLATE_LANGS_PREF,
    "Always"
  );
  await testLanguageListWithPref(
    alwaysTranslateLanguageList,
    ALWAYS_TRANSLATE_LANGS_PREF,
    "Always"
  );

  await cleanup();
});

add_task(async function test_translations_settings_never_translate() {
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
    neverTranslateMenuList,
    neverTranslateLanguageList,
    neverTranslateMenuPopup,
  } =
    await TranslationsSettingsTestUtils.openAboutPreferencesTranslationsSettingsPane(
      settingsButton
    );

  info("Testing the Never translate langauge settings");
  await testLanguageList(
    neverTranslateLanguageList,
    neverTranslateMenuList,
    neverTranslateMenuPopup,
    NEVER_TRANSLATE_LANGS_PREF,
    "Never"
  );
  await testLanguageListWithPref(
    neverTranslateLanguageList,
    NEVER_TRANSLATE_LANGS_PREF,
    "Never"
  );
  await cleanup();
});
function getLangsFromPref(pref) {
  let rawLangs = Services.prefs.getCharPref(pref);
  if (!rawLangs) {
    return [];
  }
  let langArr = rawLangs.split(",");
  return langArr;
}

async function testLanguageList(
  languageList,
  menuList,
  menuPopup,
  pref,
  sectionName
) {
  info("Ensure the Always/Never list is empty initially.");

  is(
    languageList.childElementCount,
    0,
    `Language list empty in ${sectionName} Translate list`
  );

  const menuItems = menuPopup.children;

  info(
    "Click each language on the menulist to add it into the Always/Never list."
  );
  for (const menuItem of menuItems) {
    menuList.open = true;

    let clickMenu = BrowserTestUtils.waitForEvent(
      menuList.querySelector("menupopup"),
      "popuphidden"
    );
    click(menuItem);
    menuList.querySelector("menupopup").hidePopup();
    await clickMenu;

    /** Languages are always added on the top, so check the firstChild
     * for newly added languages.
     * the firstChild.querySelector("label").innerText is the language display name
     * which is compared with the menulist display name that is selected
     */
    let langElem = languageList.firstElementChild;
    const displayName = getIntlDisplayName(menuItem.value);
    is(
      langElem.querySelector("label").innerText,
      displayName,
      `Language list has element ${displayName}`
    );

    const langTag = langElem.querySelector("label").getAttribute("value");
    ok(
      getLangsFromPref(pref).includes(langTag),
      `Perferences contains ${langTag}`
    );
  }
  /** The test cases has 4 languages, so check if 4 languages are added to the list */
  let langNum = languageList.childElementCount;
  is(langNum, 4, "Number of languages added is 4");

  info(
    "Remove each language from the Always/Never list that we added initially."
  );
  for (let i = 0; i < langNum; i++) {
    // Delete the first language in the list
    let langElem = languageList.children[0];
    let langName = langElem.querySelector("label").innerText;
    const langTag = langElem.querySelector("label").getAttribute("value");
    let langButton = langElem.querySelector("moz-button");
    let clickButton = BrowserTestUtils.waitForEvent(langButton, "click");
    langButton.click();
    await clickButton;

    ok(
      !getLangsFromPref(pref).includes(langTag),
      `Perferences does not contain ${langTag}`
    );

    if (i < langNum) {
      is(
        languageList.childElementCount,
        langNum - i - 1,
        `${langName} removed from ${sectionName}  Translate`
      );
    }
  }
}

async function testLanguageListWithPref(languageList, pref, sectionName) {
  const langs = [
    "fr",
    "de",
    "en",
    "es",
    "fr,de",
    "fr,en",
    "fr,es",
    "de,en",
    "de,en,es",
    "es,fr,en",
    "en,es,fr,de",
  ];

  info("Ensure the Always/Never list is empty initially.");

  is(
    languageList.childElementCount,
    0,
    `Language list is empty in ${sectionName} Translate list`
  );

  info(
    "Add languages to the Always/Never list in translations setting by setting the ALWAYS_TRANSLATE_LANGS_PREF/NEVER_TRANSLATE_LANGS_PREF."
  );

  for (const langOptions of langs) {
    Services.prefs.setCharPref(pref, langOptions);

    /** Languages are always added on the top, so check the firstChild
     * for newly added languages.
     * the firstChild.querySelector("label").innerText is the language display name
     * which is compared with the menulist display name that is selected
     */

    const langsAdded = langOptions.split(",");
    is(
      languageList.childElementCount,
      langsAdded.length,
      `Language list has ${langsAdded.length} elements `
    );

    let langsAddedHtml = Array.from(languageList.querySelectorAll("label"));

    for (const lang of langsAdded) {
      const langFind = langsAddedHtml
        .find(el => el.getAttribute("value") === lang)
        .getAttribute("value");
      is(langFind, lang, `Language list has element ${lang}`);
    }
  }

  Services.prefs.setCharPref(pref, "");
  is(
    languageList.childElementCount,
    0,
    `All removed from ${sectionName} Translate`
  );
}

const { PermissionTestUtils } = ChromeUtils.importESModule(
  "resource://testing-common/PermissionTestUtils.sys.mjs"
);

add_task(async function test_translations_settings_never_translate_site() {
  const {
    cleanup,
    elements: { settingsButton },
  } = await setupAboutPreferences(LANGUAGE_PAIRS, {
    prefs: [["browser.translations.newSettingsUI.enable", true]],
  });

  info(
    "Open translations settings page by clicking on translations settings button."
  );
  const { neverTranslateSiteList } =
    await TranslationsSettingsTestUtils.openAboutPreferencesTranslationsSettingsPane(
      settingsButton
    );

  info("Ensuring the list of never-translate sites is empty");
  is(
    getNeverTranslateSitesFromPerms().length,
    0,
    "The list of never-translate sites is empty"
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

  is(
    neverTranslateSiteList.childElementCount,
    3,
    "The never-translate sites html list has 3 elements"
  );

  const permissionsUrls = [
    "https://example.com",
    "https://example.org",
    "https://example.net",
  ];

  info(
    "Ensure that the Never translate sites in permissions settings are reflected in Never translate sites section of translations settings page"
  );

  const siteNum = neverTranslateSiteList.children.length;
  for (let i = siteNum; i > 0; i--) {
    is(
      neverTranslateSiteList.children[i - 1].querySelector("label").textContent,
      permissionsUrls[permissionsUrls.length - i],
      `Never translate URL ${
        permissionsUrls[permissionsUrls.length - i]
      } is added`
    );
  }

  info(
    "Delete each site by clicking the button in Never translate sites section of translations settings page and check if it is removed in the Never translate sites in permissions settings"
  );
  for (let i = 0; i < siteNum; i++) {
    // Delete the first site in the list
    let siteElem = neverTranslateSiteList.children[0];
    // Delete the first language in the list
    let siteName = siteElem.querySelector("label").innerText;
    let siteButton = siteElem.querySelector("moz-button");

    ok(
      neverTranslateSiteList.querySelector(`label[value="${siteName}"]`),
      `Site ${siteName} present in the Never transalate site list`
    );

    ok(
      getNeverTranslateSitesFromPerms().find(p => p.origin === siteName),
      `Site ${siteName} present in the Never transalate site permissions list`
    );

    let clickButton = BrowserTestUtils.waitForEvent(siteButton, "click");
    siteButton.click();
    await clickButton;

    ok(
      !neverTranslateSiteList.querySelector(`label[value="${siteName}"]`),
      `Site ${siteName} removed successfully from the Never transalate site list`
    );

    ok(
      !getNeverTranslateSitesFromPerms().find(p => p.origin === siteName),
      `Site ${siteName} removed from successfully from the Never transalate site permissions list`
    );

    if (i < siteNum) {
      is(
        neverTranslateSiteList.childElementCount,
        siteNum - i - 1,
        `${siteName} removed from Never Translate Site`
      );
    }
    const siteLen = siteNum - i - 1;
    is(
      getNeverTranslateSitesFromPerms().length,
      siteLen,
      `There are ${siteLen} site in Never translate site`
    );
  }
  await cleanup();
});
