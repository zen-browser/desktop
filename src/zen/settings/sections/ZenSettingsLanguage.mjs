/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const kWebsiteLanguagesDialogURL =
  "chrome://browser/content/preferences/dialogs/languages.xhtml";
const kTranslationsDialogURL =
  "chrome://browser/content/preferences/dialogs/translations.xhtml";
const kDictionariesURLPref = "browser.dictionaries.download.url";
const kLocaleTopics = [
  "intl:requested-locales-changed",
  "intl:app-locales-changed",
];

export class ZenSettingsLanguage {
  constructor(settings) {
    this.settings = settings;
    this.#initLanguage();
  }

  get actions() {
    return {
      "open-website-languages": () =>
        this.settings.openDialog(kWebsiteLanguagesDialogURL),
      "open-translations": () =>
        this.settings.openDialog(kTranslationsDialogURL),
      "download-dictionaries": () =>
        window.openTrustedLinkIn(
          Services.urlFormatter.formatURLPref(kDictionariesURLPref),
          "tab"
        ),
    };
  }

  #initLanguage() {
    const list = document.getElementById("zen-settings-language");
    list.addEventListener("command", () => {
      if (list.value == "more") {
        this.#updateLanguage();
        window.openPreferences("paneGeneral");
        return;
      }
      const { requestedLocales } = Services.locale;
      Services.locale.requestedLocales = [
        list.value,
        ...requestedLocales.filter(locale => locale != list.value),
      ];
    });
    this.settings.watchTopics(kLocaleTopics, () => this.#updateLanguage());
    this.#updateLanguage();
  }

  #updateLanguage() {
    const list = document.getElementById("zen-settings-language");
    const locales = Services.locale.availableLocales;
    const names = Services.intl.getLocaleDisplayNames(undefined, locales, {
      preferNative: true,
    });
    list.removeAllItems();
    for (const [index, locale] of locales.entries()) {
      list.appendItem(names[index], locale);
    }
    list.menupopup.append(document.createXULElement("menuseparator"));
    const more = list.appendItem("", "more");
    document.l10n.setAttributes(more, "zen-settings-window-language-more");
    const [requested] = Services.locale.requestedLocales;
    list.value = locales.includes(requested)
      ? requested
      : Services.locale.appLocaleAsBCP47;
  }
}
