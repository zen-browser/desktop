
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# NSIS branding defines for unofficial builds.
# The official release build branding.nsi is located in other-license/branding/firefox/
# The nightly build branding.nsi is located in browser/installer/windows/nsis/

# BrandFullNameInternal is used for some registry and file system values
# instead of BrandFullName and typically should not be modified.
!define BrandFullNameInternal "Nixo Browser"
!define BrandFullName         "Nixo Browser"
!define CompanyName           "Nixo Team"
!define URLInfoAbout          "https://zen-browser.app"
!define URLUpdateInfo         "https://zen-browser.app/release-notes/${AppVersion}"
!define HelpLink              "https://github.com/zen-browser/desktop/issues"


; The OFFICIAL define is a workaround to support different urls for Release and
; Stable since they share the same branding when building with other branches that
; set the update channel to stable.
!define OFFICIAL
!define URLStubDownloadX86 "https://download.mozilla.org/?os=win&lang=${AB_CD}&product=firefox-latest"
!define URLStubDownloadAMD64 "https://download.mozilla.org/?os=win64&lang=${AB_CD}&product=firefox-latest"
!define URLStubDownloadAArch64 "https://download.mozilla.org/?os=win64-aarch64&lang=${AB_CD}&product=firefox-latest"
!define URLManualDownload "https://zen-browser.app/download"
!define URLSystemRequirements "https://www.mozilla.org/firefox/system-requirements/"
!define Channel "stable"

# The installer's certificate name and issuer expected by the stub installer
!define CertNameDownload   "Mozilla Corporation"
!define CertIssuerDownload "DigiCert Trusted G4 Code Signing RSA4096 SHA384 2021 CA1"

# Dialog units are used so the UI displays correctly with the system's DPI
# settings.
!define PROFILE_CLEANUP_LABEL_TOP "35u"
!define PROFILE_CLEANUP_LABEL_LEFT "0"
!define PROFILE_CLEANUP_LABEL_WIDTH "100%"
!define PROFILE_CLEANUP_LABEL_HEIGHT "80u"
!define PROFILE_CLEANUP_LABEL_ALIGN "center"
!define PROFILE_CLEANUP_CHECKBOX_LEFT "center"
!define PROFILE_CLEANUP_CHECKBOX_WIDTH "100%"
!define PROFILE_CLEANUP_BUTTON_LEFT "center"
!define INSTALL_BLURB_TOP "137u"
!define INSTALL_BLURB_WIDTH "60u"
!define INSTALL_FOOTER_TOP "-48u"
!define INSTALL_FOOTER_WIDTH "250u"
!define INSTALL_INSTALLING_TOP "70u"
!define INSTALL_INSTALLING_LEFT "0"
!define INSTALL_INSTALLING_WIDTH "100%"
!define INSTALL_PROGRESS_BAR_TOP "112u"
!define INSTALL_PROGRESS_BAR_LEFT "20%"
!define INSTALL_PROGRESS_BAR_WIDTH "60%"
!define INSTALL_PROGRESS_BAR_HEIGHT "12u"

!define PROFILE_CLEANUP_CHECKBOX_TOP_MARGIN "20u"
!define PROFILE_CLEANUP_BUTTON_TOP_MARGIN "20u"
!define PROFILE_CLEANUP_BUTTON_X_PADDING "40u"
!define PROFILE_CLEANUP_BUTTON_Y_PADDING "4u"

# Font settings that can be customized for each channel
!define INSTALL_HEADER_FONT_SIZE 28
!define INSTALL_HEADER_FONT_WEIGHT 400
!define INSTALL_INSTALLING_FONT_SIZE 28
!define INSTALL_INSTALLING_FONT_WEIGHT 400

# UI Colors that can be customized for each channel
!define COMMON_TEXT_COLOR 0xFFFFFF
!define COMMON_BACKGROUND_COLOR 0x000000
!define INSTALL_INSTALLING_TEXT_COLOR 0xFFFFFF
