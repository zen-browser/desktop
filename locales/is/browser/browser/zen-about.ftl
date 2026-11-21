# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# The engine this build is based on, not meant to be translated.
-zen-engine-name = Firefox
zen-about-dialog-title = 
    .title = Um { -brand-full-name }
zen-about-app-name = { -brand-full-name }
# Variables:
#   $version (String): Zen version, e.g. 1.24b
#   $arch (String): CPU architecture, e.g. 64-bit or aarch64
zen-about-version = Útgáfa { $version } ({ $arch })
# Variables:
#   $version (String): Zen version, e.g. 1.25t
#   $isodate (String): build date in ISO format, e.g. 2026-10-29
#   $arch (String): CPU architecture, e.g. 64-bit or aarch64
zen-about-version-twilight = Útgáfa { $version } ({ $isodate }) ({ $arch })
zen-about-version-button = 
    .title = Afrita upplýsingar um byggingu
zen-about-copied = Afritað
# Variables:
#   $firefoxVersion (String): engine version this build is based on, e.g. 159.0
zen-about-firefox-version = Byggt á { -zen-engine-name } { $firefoxVersion }

## Update status

zen-about-update-check = Athuga með uppfærslur
zen-about-update-try-again = Prófa aftur
zen-about-update-checking = Leita að uppfærslum…
zen-about-update-up-to-date = { -brand-short-name } er af nýjustu gerð
# Variables:
#   $version (String): the version that can be downloaded, e.g. 1.25b
zen-about-update-available = { -brand-short-name } { $version } er tiltækt
zen-about-update-download = Sækja og setja upp
# Variables:
#   $transfer (String): download progress, e.g. 12.3 of 90.1 MB
zen-about-update-downloading = Sæki uppfærslu - { $transfer }
zen-about-update-applying = Virkja uppfærslu…
zen-about-update-ready = Uppfærslan tilbúin til uppsetningar
zen-about-update-restart = Endurræsa til að virkja uppfærslu
zen-about-update-restarting = Endurræsi…
zen-about-update-download-failed = Ekki var hægt að sækja uppfærsluna
zen-about-update-checking-failed = Tókst ekki að athuga með uppfærslur
zen-about-update-internal-error = Uppfærslur eru ekki tiltækar vegna innri villu
zen-about-update-download-manually = Sækja handvirkt
zen-about-update-manual = Ný útgáfa er tiltæk á niðurhalssíðunni
zen-about-update-policy-disabled = Uppfærslur hafa verið gerðar óvirkar af kerfisstjórum þínum
zen-about-update-other-instance = { -brand-short-name } er að fá uppfærslur frá öðru tilviki
zen-about-update-unsupported = Þetta kerfi getur ekki lengur fengið uppfærslur
zen-about-update-learn-more = Kanna nánar

## Links

zen-about-release-notes = Nýtt á döfinni
zen-about-donate = Styrkja
zen-about-report-issue = Tilkynna vandamál
zen-about-community = { -brand-short-name } er gjaldfrjáls og opinn hugbúnaður, reistur á grunni { -zen-engine-name } af <a data-l10n-name="github-link">hópi samstarfsfólks</a>.
zen-about-license = Notkunarleyfi
zen-about-rights = Réttindi þín
zen-about-privacy = Persónuvernd
