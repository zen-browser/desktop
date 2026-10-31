# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# The engine this build is based on, not meant to be translated.
-zen-engine-name = Firefox
zen-about-dialog-title = 
    .title = 關於 { -brand-full-name }
zen-about-app-name = { -brand-full-name }
# Variables:
#   $version (String): Zen version, e.g. 1.24b
#   $arch (String): CPU architecture, e.g. 64-bit or aarch64
zen-about-version = 版本 { $version } ({ $arch })
# Variables:
#   $version (String): Zen version, e.g. 1.25t
#   $isodate (String): build date in ISO format, e.g. 2026-10-29
#   $arch (String): CPU architecture, e.g. 64-bit or aarch64
zen-about-version-twilight = 版本 { $version } ({ $isodate }) ({ $arch })
zen-about-version-button = 
    .title = 複製版本資訊
zen-about-copied = 已複製
# Variables:
#   $firefoxVersion (String): engine version this build is based on, e.g. 159.0
zen-about-firefox-version = 基於 { -zen-engine-name } { $firefoxVersion }

## Update status

zen-about-update-check = 檢查更新
zen-about-update-check-again = 再次檢查
zen-about-update-try-again = 再試一次
zen-about-update-checking = 正在檢查更新…
zen-about-update-up-to-date = { -brand-short-name } 已經是最新版本
# Variables:
#   $version (String): the version that can be downloaded, e.g. 1.25b
zen-about-update-available = { -brand-short-name } { $version } 可供更新
zen-about-update-download = 下載並安裝
# Variables:
#   $transfer (String): download progress, e.g. 12.3 of 90.1 MB
zen-about-update-downloading = 正在下載更新 — { $transfer }
zen-about-update-applying = 安裝更新中…
zen-about-update-ready = 新版本已可供安裝
zen-about-update-restart = 重新啟動以更新
zen-about-update-restarting = 重新啟動中…
zen-about-update-download-failed = 無法下載更新
zen-about-update-checking-failed = 無法檢查更新
zen-about-update-internal-error = 因內部錯誤，無法提供更新
zen-about-update-download-manually = 手動下載
zen-about-update-manual = 下載頁面中已有新版本
zen-about-update-policy-disabled = 更新已由您的機構停用
zen-about-update-other-instance = { -brand-short-name } 正由另一程序更新中
zen-about-update-unsupported = 此作業系統已無法再接受更新
zen-about-update-learn-more = 了解更多

## Links

zen-about-release-notes = 新功能
zen-about-donate = 贊助
zen-about-report-issue = 問題回報
zen-about-community = { -brand-short-name } 免費且開源，由<a data-l10n-name="github-link">社群貢獻者</a>基於{ -zen-engine-name }所打造。
zen-about-license = 授權資訊
zen-about-rights = 使用條款
zen-about-privacy = 隱私權公告
