// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

pref('browser.urlbar.unitConversion.enabled', true);
pref('browser.urlbar.trending.featureGate', false);
pref('browser.urlbar.weather.featureGate', false);
pref('browser.urlbar.quickactions.enabled', true);
pref('browser.urlbar.clipboard.featureGate', true);
pref('browser.urlbar.suggest.calculator', true);

pref("browser.urlbar.trimHttps", true);
pref("browser.urlbar.untrimOnUserInteraction.featureGate", true);

// Keep in sync with browser/components/topsites/constants.mjs
pref("browser.urlbar.maxRichResults", 7);

// Enable private suggestions
pref('browser.search.suggest.enabled', false);
pref('browser.search.suggest.enabled.private', false);

pref("browser.urlbar.trimHttps", true);
pref("browser.search.separatePrivateDefault.ui.enabled", true);
pref("browser.urlbar.update2.engineAliasRefresh", true);
pref("browser.urlbar.quicksuggest.enabled", false, locked);
pref("browser.urlbar.suggest.quicksuggest.sponsored", false, locked);
pref("browser.urlbar.suggest.quicksuggest.nonsponsored", false, locked);
pref("browser.urlbar.groupLabels.enabled", false);
pref("browser.urlbar.keepPanelOpenDuringImeComposition", true); // IMPORTANT: Fixes closing the urlbar when on some languages
pref("browser.formfill.enable", false);
pref("security.insecure_connection_text.enabled", true);
pref("security.insecure_connection_text.pbmode.enabled", true);
pref("network.IDN_show_punycode", true);

pref("browser.urlbar.suggest.topsites", true, locked);
