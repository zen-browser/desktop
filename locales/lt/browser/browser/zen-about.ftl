# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# The engine this build is based on, not meant to be translated.
-zen-engine-name = Firefox
zen-about-dialog-title = 
    .title = Apie „{ -brand-full-name }“
zen-about-app-name = „{ -brand-full-name }“
# Variables:
#   $version (String): Zen version, e.g. 1.24b
#   $arch (String): CPU architecture, e.g. 64-bit or aarch64
zen-about-version = Versija { $version } ({ $arch }).
# Variables:
#   $version (String): Zen version, e.g. 1.25t
#   $isodate (String): build date in ISO format, e.g. 2026-10-29
#   $arch (String): CPU architecture, e.g. 64-bit or aarch64
zen-about-version-twilight = Versija { $version } ({ $isodate }) ({ $arch }).
zen-about-version-button = 
    .title = Kopijuoti darinio informaciją
zen-about-copied = Nukopijuota.
# Variables:
#   $firefoxVersion (String): engine version this build is based on, e.g. 159.0
zen-about-firefox-version = Remiantis „{ -zen-engine-name }“ { $firefoxVersion }.

## Update status

zen-about-update-check = Tikrinti dėl atnaujinimų
zen-about-update-check-again = Tikrinti dar kartą
zen-about-update-try-again = Bandyti dar kartą
zen-about-update-checking = Tikrinama dėl atnaujinimų…
zen-about-update-up-to-date = „{ -brand-short-name }“ yra atnaujinta.
# Variables:
#   $version (String): the version that can be downloaded, e.g. 1.25b
zen-about-update-available = „{ -brand-short-name }“ { $version } pasiekiama.
zen-about-update-download = Atsisiųsti ir įdiegti
# Variables:
#   $transfer (String): download progress, e.g. 12.3 of 90.1 MB
zen-about-update-downloading = Atsisiunčiamas atnaujinimas – { $transfer }
zen-about-update-applying = Taikomas atnaujinimas…
zen-about-update-ready = Atnaujinimas parengtas įdiegti.
zen-about-update-restart = Paleiskite iš naujo, kad atnaujintumėte.
zen-about-update-restarting = Paleidžiama iš naujo…
zen-about-update-download-failed = Nepavyko atsisiųsti atnaujinimo.
zen-about-update-checking-failed = Nepavyko patikrinti atnaujinimų.
zen-about-update-internal-error = Atnaujinimai nepasiekiami dėl vidinės klaidos.
zen-about-update-download-manually = Atsisiųsti rankiniu būdu
zen-about-update-manual = Nauja versija pasiekiama atsisiuntimo puslapyje.
zen-about-update-policy-disabled = Jūsų organizacija išjungė atnaujinimus.
zen-about-update-other-instance = „{ -brand-short-name }“ šiuo metu atnaujinamas kito serverio.
zen-about-update-unsupported = Ši sistema nebegali gauti atnaujinimų
zen-about-update-learn-more = Sužinoti daugiau

## Links

zen-about-release-notes = Kas naujo
zen-about-donate = Aukoti
zen-about-report-issue = Pranešti apie problemą
zen-about-community = „{ -brand-short-name }“ yra nemokama ir atvirojo kodo, sukurta „{ -zen-engine-name }“ pagrindu <a data-l10n-name="github-link">talkininkų bendruomenės</a>.
zen-about-license = Licencija
zen-about-rights = Jūsų teisės
zen-about-privacy = Privatumas
