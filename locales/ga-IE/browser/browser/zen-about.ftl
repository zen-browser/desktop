# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# The engine this build is based on, not meant to be translated.
-zen-engine-name = Firefox
zen-about-dialog-title = 
    .title = Maidir le { -brand-full-name }
zen-about-app-name = { -brand-full-name }
# Variables:
#   $version (String): Zen version, e.g. 1.24b
#   $arch (String): CPU architecture, e.g. 64-bit or aarch64
zen-about-version = Leagan { $version } ({ $arch })
# Variables:
#   $version (String): Zen version, e.g. 1.25t
#   $isodate (String): build date in ISO format, e.g. 2026-10-29
#   $arch (String): CPU architecture, e.g. 64-bit or aarch64
zen-about-version-twilight = Leagan { $version } ({ $isodate }) ({ $arch })
zen-about-version-button = 
    .title = Cóipeáil faisnéis an tiomsaithe
zen-about-copied = Cóipeáilte
# Variables:
#   $firefoxVersion (String): engine version this build is based on, e.g. 159.0
zen-about-firefox-version = Bunaithe ar { -zen-engine-name } { $firefoxVersion }

## Update status

zen-about-update-check = Seiceáil le haghaidh nuashonruithe
zen-about-update-check-again = Seiceáil arís
zen-about-update-try-again = Déan iarracht arís
zen-about-update-checking = Ag seiceáil le haghaidh nuashonruithe…
zen-about-update-up-to-date = Tá { -brand-short-name } cothrom le dáta
# Variables:
#   $version (String): the version that can be downloaded, e.g. 1.25b
zen-about-update-available = Tá { -brand-short-name } { $version } ar fáil
zen-about-update-download = Íoslódáil agus suiteáil
# Variables:
#   $transfer (String): download progress, e.g. 12.3 of 90.1 MB
zen-about-update-downloading = Nuashonrú á íoslódáil — { $transfer }
zen-about-update-applying = Nuashonrú á chur i bhfeidhm…
zen-about-update-ready = Tá an nuashonrú réidh le suiteáil
zen-about-update-restart = Atosaigh chun nuashonrú a dhéanamh
zen-about-update-restarting = Ag atosú…
zen-about-update-download-failed = Níorbh fhéidir an nuashonrú a íoslódáil
zen-about-update-checking-failed = Níorbh fhéidir nuashonruithe a sheiceáil
zen-about-update-internal-error = Níl nuashonruithe ar fáil mar gheall ar earráid inmheánach
zen-about-update-download-manually = Íoslódáil de láimh
zen-about-update-manual = Tá leagan nua ar fáil ar an leathanach íoslódála
zen-about-update-policy-disabled = Tá nuashonruithe díchumasaithe ag d’eagraíocht
zen-about-update-other-instance = Tá { -brand-short-name } á nuashonrú ag instáins eile
zen-about-update-unsupported = Ní féidir leis an gcóras seo nuashonruithe a fháil a thuilleadh
zen-about-update-learn-more = Faigh tuilleadh eolais

## Links

zen-about-release-notes = Cad atá nua
zen-about-donate = Tabhair Síntiús
zen-about-report-issue = Tuairiscigh fadhb
zen-about-community = Tá { -brand-short-name } saor in aisce agus foinse oscailte; tá sé tógtha ar { -zen-engine-name } ag <a data-l10n-name="github-link">pobal rannpháirtithe</a>.
zen-about-license = Ceadúnas
zen-about-rights = Do chearta
zen-about-privacy = Príobháideachas
