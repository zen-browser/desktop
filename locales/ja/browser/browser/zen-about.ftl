# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# The engine this build is based on, not meant to be translated.
-zen-engine-name = Firefox
zen-about-dialog-title = 
    .title = { -brand-full-name } について
zen-about-app-name = { -brand-full-name }
# Variables:
#   $version (String): Zen version, e.g. 1.24b
#   $arch (String): CPU architecture, e.g. 64-bit or aarch64
zen-about-version = バージョン { $version } ({ $arch})
# Variables:
#   $version (String): Zen version, e.g. 1.25t
#   $isodate (String): build date in ISO format, e.g. 2026-10-29
#   $arch (String): CPU architecture, e.g. 64-bit or aarch64
zen-about-version-twilight = Version { $version } ({ $isodate }) ({ $arch})
zen-about-version-button = 
    .title = ビルド情報をコピー
zen-about-copied = コピーしました
# Variables:
#   $firefoxVersion (String): engine version this build is based on, e.g. 159.0
zen-about-firefox-version = { -zen-engine-name } { $firefoxVersion} 搭載

## Update status

zen-about-update-check = アップデートを確認する
zen-about-update-try-again = 再試行
zen-about-update-checking = アップデートを確認中…
zen-about-update-up-to-date = { -brand-short-name } は最新です
# Variables:
#   $version (String): the version that can be downloaded, e.g. 1.25b
zen-about-update-available = { -brand-short-name } { $version } が利用可能です
zen-about-update-download = ダウンロードしてインストール
# Variables:
#   $transfer (String): download progress, e.g. 12.3 of 90.1 MB
zen-about-update-downloading = アップデートをダウンロード中 — { $transfer}
zen-about-update-applying = アップデートを適用しています…
zen-about-update-ready = アップデートをインストールする準備ができました
zen-about-update-restart = 再起動してアップデートする
zen-about-update-restarting = 再起動しています…
zen-about-update-download-failed = アップデートをダウンロードできませんでした
zen-about-update-checking-failed = アップデート情報を取得できません
zen-about-update-internal-error = 内部エラーのためアップデートは利用できません
zen-about-update-download-manually = 手動でダウンロードする
zen-about-update-manual = 新しいバージョンはダウンロードページから利用可能です
zen-about-update-policy-disabled = アップデートは組織によって無効になっています
zen-about-update-other-instance = { -brand-short-name } は別のインスタンスによって更新されています
zen-about-update-unsupported = このシステムはアップデートを受信できません
zen-about-update-learn-more = さらに詳しく

## Links

zen-about-release-notes = 更新情報
zen-about-donate = 寄付
zen-about-report-issue = 問題を報告
zen-about-community = { -brand-short-name } は　{ -zen-engine-name } に基づく無料かつオープンソースのブラウザで、<a data-l10n-name="github-link">community of contributors</a> によって開発・維持されています。
zen-about-license = ライセンス
zen-about-rights = ユーザーの権利
zen-about-privacy = プライバシー
