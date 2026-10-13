/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// The Accept-Language header that websites receive must follow the browser UI
// (app) language by default, not the OS locale or the geographic region, and
// must never override a language list the user chose.

const PREF = "intl.accept_languages";
const TEST_URL = "https://example.com/browser/";

let gRequestCount = 0;

/**
 * Loads a page and returns the language tags of the Accept-Language header
 * of the main document request, without the quality values.
 *
 * @returns {Promise<string[]>}
 */
async function loadAndGetAcceptLanguage() {
  const url = `${TEST_URL}?accept-language=${++gRequestCount}`;
  let header = null;
  const observer = {
    observe(subject) {
      const channel = subject.QueryInterface(Ci.nsIHttpChannel);
      if (channel.URI.spec === url) {
        header = channel.getRequestHeader("Accept-Language");
      }
    },
  };
  Services.obs.addObserver(observer, "http-on-modify-request");
  try {
    await BrowserTestUtils.withNewTab(url, () => {});
  } finally {
    Services.obs.removeObserver(observer, "http-on-modify-request");
  }
  ok(header, `Got an Accept-Language header for ${url}`);
  return header.split(",").map(part => part.split(";")[0].trim());
}

/**
 * Switches the UI language. The HTTP handler is notified synchronously through
 * "intl:app-locales-changed", so the next request already uses the new value.
 *
 * @param {string[]} available Available locales.
 * @param {string} requested The requested UI locale.
 */
function setUILocale(available, requested) {
  Services.locale.availableLocales = available;
  Services.locale.requestedLocales = [requested];
  is(
    Services.locale.appLocaleAsLangTag,
    requested,
    `The UI language is ${requested}`
  );
}

add_setup(async function () {
  const origAvailable = Services.locale.availableLocales;
  const origRequested = Services.locale.requestedLocales;
  Services.prefs.clearUserPref(PREF);
  registerCleanupFunction(() => {
    Services.prefs.clearUserPref(PREF);
    Services.locale.availableLocales = origAvailable;
    Services.locale.requestedLocales = origRequested;
  });
});

add_task(async function test_default_header_matches_ui_language() {
  Services.prefs.clearUserPref(PREF);
  const uiLanguage = Services.locale.appLocaleAsBCP47;
  const tags = await loadAndGetAcceptLanguage();
  is(tags[0], uiLanguage, "The preferred language is the browser UI language");
  Assert.deepEqual(
    tags,
    Services.locale.acceptLanguages.split(",").map(tag => tag.trim()),
    "The header is the default derived from the UI language"
  );
});

add_task(async function test_header_follows_ui_language() {
  Services.prefs.clearUserPref(PREF);
  const cases = [
    // No regional guesses ("ru-RU"), no related languages ("zh-TW"), no
    // trailing English fallback.
    ["de", ["de"]],
    ["ru", ["ru"]],
    ["pt-BR", ["pt-BR", "pt"]],
    ["zh-CN", ["zh-CN", "zh"]],
    ["ca-valencia", ["ca-valencia", "ca"]],
    ["en-US", ["en-US", "en"]],
    // The internal "mac" variant must not reach the wire.
    ["ja-JP-mac", ["ja-JP", "ja"]],
  ];
  for (const [locale, expected] of cases) {
    setUILocale([locale, "en-US"], locale);
    Assert.deepEqual(
      await loadAndGetAcceptLanguage(),
      expected,
      `The header matches the ${locale} UI language`
    );
  }
});

add_task(async function test_custom_language_preference_is_preserved() {
  setUILocale(["de", "en-US"], "de");
  Services.prefs.setCharPref(PREF, "fr-CA, fr, en");
  Assert.deepEqual(
    await loadAndGetAcceptLanguage(),
    ["fr-CA", "fr", "en"],
    "A user-chosen website language list overrides the UI language"
  );

  // Changing the UI language must not touch the custom list either.
  setUILocale(["pt-BR", "de", "en-US"], "pt-BR");
  is(
    Services.prefs.getCharPref(PREF),
    "fr-CA, fr, en",
    "The custom preference is untouched"
  );
  Assert.deepEqual(
    await loadAndGetAcceptLanguage(),
    ["fr-CA", "fr", "en"],
    "The custom list still wins after the UI language changed"
  );

  Services.prefs.clearUserPref(PREF);
  Assert.deepEqual(
    await loadAndGetAcceptLanguage(),
    ["pt-BR", "pt"],
    "Resetting the preference goes back to the UI language"
  );
});
