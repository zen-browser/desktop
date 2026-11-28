# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# The engine this build is based on, not meant to be translated.
-zen-engine-name = Firefox
zen-about-dialog-title = 
    .title = Rakenduse teave: { -brand-full-name }
zen-about-app-name = { -brand-full-name }
# Variables:
#   $version (String): Zen version, e.g. 1.24b
#   $arch (String): CPU architecture, e.g. 64-bit or aarch64
zen-about-version = Versioon { $version } ({ $arch })
# Variables:
#   $version (String): Zen version, e.g. 1.25t
#   $isodate (String): build date in ISO format, e.g. 2026-10-29
#   $arch (String): CPU architecture, e.g. 64-bit or aarch64
zen-about-version-twilight = Versioon { $version } ({ $isodate }) ({ $arch })
zen-about-version-button = 
    .title = Kopeeri kompileerimisteave
zen-about-copied = Kopeeritud
# Variables:
#   $firefoxVersion (String): engine version this build is based on, e.g. 159.0
zen-about-firefox-version = Põhineb rakendusel: { -zen-engine-name } { $firefoxVersion }

## Update status

zen-about-update-check = Kontrolli uuenduste olemasolu
zen-about-update-try-again = Proovi uuesti
zen-about-update-checking = Kontrollin uuenduste olemasolu…
zen-about-update-up-to-date = { -brand-short-name } on uuendatud viimase versioonini
# Variables:
#   $version (String): the version that can be downloaded, e.g. 1.25b
zen-about-update-available = Saadaval on { -brand-short-name } { $version }
zen-about-update-download = Laadi alla ja paigalda
# Variables:
#   $transfer (String): download progress, e.g. 12.3 of 90.1 MB
zen-about-update-downloading = Uuendus on allalaadimisel { $transfer }
zen-about-update-applying = Rakendan uuendust…
zen-about-update-ready = Uuendus on valmis paigaldamiseks
zen-about-update-restart = Taaskäivita uuenduse lõpetamiseks
zen-about-update-restarting = Käivitun uuesti…
zen-about-update-download-failed = Uuenduse allalaadimine ei õnnestunud
zen-about-update-checking-failed = Uuenduste olemasolu kontrollimine ei õnnestunud
zen-about-update-internal-error = Uuendused pole saadaval sisemise vea tõttu
zen-about-update-download-manually = Laadi käsitsi alla
zen-about-update-manual = Uuendus on saadaval allalaadimiste lehel
zen-about-update-policy-disabled = Uuenduste laadimine on sinu organistasioonis keelatud
zen-about-update-other-instance = { -brand-short-name } on uuendamisel teise protsessi poolt
zen-about-update-unsupported = Selles süsteemis pole enam võimalik uuendusi teha
zen-about-update-learn-more = Lisateave

## Links

zen-about-release-notes = Mida on meil uut
zen-about-donate = Toeta rahaliselt
zen-about-report-issue = Teavita veast või probleemist
zen-about-community = { -brand-short-name } on vaba, tasuta ja avatud lähtekoodiga tarkvara, mille aluseks on { -zen-engine-name } ning arendajaks <a data-l10n-name="github-link">kaasautorite kogukond</a>.
zen-about-license = Litsents
zen-about-rights = Sinu õigused
zen-about-privacy = Privaatsus
