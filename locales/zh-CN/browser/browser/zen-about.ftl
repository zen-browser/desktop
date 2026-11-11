# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# The engine this build is based on, not meant to be translated.
-zen-engine-name = Firefox
zen-about-dialog-title = 
    .title = 关于 { -brand-full-name }
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
    .title = 复制构建信息
zen-about-copied = 已复制
# Variables:
#   $firefoxVersion (String): engine version this build is based on, e.g. 159.0
zen-about-firefox-version = 基于 { -zen-engine-name } { $firefoxVersion }

## Update status

zen-about-update-check = 检查更新
zen-about-update-try-again = 重试
zen-about-update-checking = 正在检查更新……
zen-about-update-up-to-date = { -brand-short-name } 已是最新版本
# Variables:
#   $version (String): the version that can be downloaded, e.g. 1.25b
zen-about-update-available = { -brand-short-name } { $version } 版本现已推出
zen-about-update-download = 下载并安装
# Variables:
#   $transfer (String): download progress, e.g. 12.3 of 90.1 MB
zen-about-update-downloading = 正在下载更新 — { $transfer }
zen-about-update-applying = 正在应用更新……
zen-about-update-ready = 更新已准备就绪，可以安装
zen-about-update-restart = 重启以更新
zen-about-update-restarting = 正在重启……
zen-about-update-download-failed = 无法下载更新
zen-about-update-checking-failed = 无法检查更新
zen-about-update-internal-error = 由于内部错误，无法获取更新
zen-about-update-download-manually = 手动下载
zen-about-update-manual = 下载页面提供了新版本
zen-about-update-policy-disabled = 您的组织已禁用更新
zen-about-update-other-instance = 另一个实例正在更新 { -brand-short-name }
zen-about-update-unsupported = 此系统无法再接收更新
zen-about-update-learn-more = 了解更多

## Links

zen-about-release-notes = 更新内容
zen-about-donate = 捐赠
zen-about-report-issue = 报告问题
zen-about-community = { -brand-short-name } 是免费且开源的，由<a data-l10n-name="github-link">贡献者社区</a>基于 { -zen-engine-name } 构建。
zen-about-license = 许可证
zen-about-rights = 您的权利
zen-about-privacy = 隐私
