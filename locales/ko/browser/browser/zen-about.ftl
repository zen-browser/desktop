# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# The engine this build is based on, not meant to be translated.
-zen-engine-name = Firefox
zen-about-dialog-title = 
    .title = { -brand-full-name }에 대하여
zen-about-app-name = { -brand-full-name }
# Variables:
#   $version (String): Zen version, e.g. 1.24b
#   $arch (String): CPU architecture, e.g. 64-bit or aarch64
zen-about-version = 버전 { $version } ({ $arch })
# Variables:
#   $version (String): Zen version, e.g. 1.25t
#   $isodate (String): build date in ISO format, e.g. 2026-10-29
#   $arch (String): CPU architecture, e.g. 64-bit or aarch64
zen-about-version-twilight = 버전 { $version } ({ $isodate }) ({ $arch })
zen-about-version-button = 
    .title = 빌드 정보 복사
zen-about-copied = 복사됨
# Variables:
#   $firefoxVersion (String): engine version this build is based on, e.g. 159.0
zen-about-firefox-version = { -zen-engine-name }{ $firefoxVersion } 기반

## Update status

zen-about-update-check = 업데이트 확인
zen-about-update-check-again = 다시 확인
zen-about-update-try-again = 다시 시도
zen-about-update-checking = 업데이트 확인하는 중…
zen-about-update-up-to-date = { -brand-short-name }은 최신 버전입니다
# Variables:
#   $version (String): the version that can be downloaded, e.g. 1.25b
zen-about-update-available = { -brand-short-name } { $version } 버전으로 업데이트할 수 있습니다
zen-about-update-download = 다운로드 및 설치
# Variables:
#   $transfer (String): download progress, e.g. 12.3 of 90.1 MB
zen-about-update-downloading = 업데이트 다운로드 중 — { $transfer }
zen-about-update-applying = 업데이트 적용 중…
zen-about-update-ready = 업데이트를 설치할 준비가 되었습니다
zen-about-update-restart = 재시작하여 업데이트
zen-about-update-restarting = 재시작하는 중…
zen-about-update-download-failed = 업데이트를 다운로드할 수 없습니다
zen-about-update-checking-failed = 업데이트를 확인할 수 없습니다
zen-about-update-internal-error = 내부 오류로 인해 업데이트가 불가능합니다
zen-about-update-download-manually = 수동으로 다운로드
zen-about-update-manual = 다운로드 페이지에서 새 버전을 이용 가능합니다
zen-about-update-policy-disabled = 당신의 조직에 의해 업데이트가 비활성화 되었습니다
zen-about-update-other-instance = { -brand-short-name }은 다른 인스턴스에 의해 업데이트 되고 있습니다
zen-about-update-unsupported = 이 시스템은 더 이상 업데이트를 받을 수 없습니다
zen-about-update-learn-more = 더 알아보기

## Links

zen-about-release-notes = 새로운 것들
zen-about-donate = 후원
zen-about-report-issue = 버그 제보하기
zen-about-community = { -brand-short-name }은 무료 오픈소스이며, <a data-l10n-name="github-link">기여자들의 커뮤니티</a>에 의해 { -zen-engine-name }를 기반으로 만들어졌습니다.
zen-about-license = 라이선스
zen-about-rights = 당신의 권리
zen-about-privacy = 개인정보
