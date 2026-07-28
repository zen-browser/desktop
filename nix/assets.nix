# Zen branding assets, generated from surfer-config. Verbatim from nixpkgs
# PR #496647 (Hythera) — branding is unchanged in this fork.
{
  branding,
  surfer-config,
  writeText,
}:
{
  # https://github.com/zen-browser/surfer/blob/main/template/branding.optional/locales/en-US/brand.dtd
  brandDtd = writeText "brand.dtd" ''
    <!-- This Source Code Form is subject to the terms of the Mozilla Public
       - License, v. 2.0. If a copy of the MPL was not distributed with this
       - file, You can obtain one at http://mozilla.org/MPL/2.0/. -->

    <!ENTITY  brandShorterName      "${surfer-config.brands.${branding}.brandShorterName}">
    <!ENTITY  brandShortName        "${surfer-config.brands.${branding}.brandShortName}">
    <!ENTITY  brandFullName         "${surfer-config.brands.${branding}.brandFullName}">
  '';

  # https://github.com/zen-browser/surfer/blob/main/template/branding.optional/locales/en-US/brand.ftl
  brandFtl = writeText "brand.ftl" ''
    # This Source Code Form is subject to the terms of the Mozilla Public
    # License, v. 2.0. If a copy of the MPL was not distributed with this
    # file, You can obtain one at http://mozilla.org/MPL/2.0/.

    ## Firefox and Mozilla Brand
    ##
    ## Firefox and Mozilla must be treated as a brand.
    ##
    ## They cannot be:
    ## - Transliterated.
    ## - Translated.
    ##
    ## Declension should be avoided where possible, leaving the original
    ## brand unaltered in prominent UI positions.
    ##
    ## For further details, consult:
    ## https://mozilla-l10n.github.io/styleguides/mozilla_general/#brands-copyright-and-trademark

    -brand-shorter-name = ${surfer-config.brands.${branding}.brandShorterName}
    -brand-short-name = ${surfer-config.brands.${branding}.brandShortName}
    -brand-full-name = ${surfer-config.brands.${branding}.brandFullName}
    # This brand name can be used in messages where the product name needs to
    # remain unchanged across different versions (Nightly, Beta, etc.).
    -brand-product-name = ${surfer-config.name}
    -vendor-short-name = ${surfer-config.vendor}
    trademarkInfo = { " " }
  '';

  # https://github.com/zen-browser/surfer/blob/main/template/branding.optional/locales/en-US/brand.properties
  brandProperties = writeText "brand.properties" ''
    # This Source Code Form is subject to the terms of the Mozilla Public
    # License, v. 2.0. If a copy of the MPL was not distributed with this
    # file, You can obtain one at http://mozilla.org/MPL/2.0/.

    brandShorterName=${surfer-config.brands.${branding}.brandShorterName}
    brandShortName=${surfer-config.brands.${branding}.brandShortName}
    brandFullName=${surfer-config.brands.${branding}.brandFullName}
    vendorShortName=${surfer-config.vendor}
  '';

  # https://github.com/zen-browser/surfer/blob/main/src/commands/patches/branding-patch.ts
  brandingNsi = writeText "branding.nsi" ''
    # This Source Code Form is subject to the terms of the Mozilla Public
    # License, v. 2.0. If a copy of the MPL was not distributed with this
    # file, You can obtain one at http://mozilla.org/MPL/2.0/.

    # NSIS branding defines for official release builds.
    # The nightly build branding.nsi is located in browser/installer/windows/nsis/
    # The unofficial build branding.nsi is located in browser/branding/unofficial/

    # BrandFullNameInternal is used for some registry and file system values
    # instead of BrandFullName and typically should not be modified.
    !define BrandFullNameInternal "${surfer-config.brands.${branding}.brandFullName}"
    !define BrandFullName         "${surfer-config.brands.${branding}.brandFullName}"
    !define CompanyName           "${surfer-config.vendor}"
    !define URLInfoAbout          "https://zen-browser.app"
    !define URLUpdateInfo         "https://zen-browser.app/release-notes/''${AppVersion}"
    !define HelpLink              "https://github.com/zen-browser/desktop/issues"

    ; The OFFICIAL define is a workaround to support different urls for Release and
    ; Stable since they share the same branding when building with other branches that
    ; set the update channel to stable.
    !define OFFICIAL
    !define URLStubDownloadX86 "https://download.mozilla.org/?os=win&lang=''${AB_CD}&product=firefox-latest"
    !define URLStubDownloadAMD64 "https://download.mozilla.org/?os=win64&lang=''${AB_CD}&product=firefox-latest"
    !define URLStubDownloadAArch64 "https://download.mozilla.org/?os=win64-aarch64&lang=''${AB_CD}&product=firefox-latest"
    !define URLManualDownload "https://zen-browser.app/download"
    !define URLSystemRequirements "https://www.mozilla.org/firefox/system-requirements/"
    !define Channel "stable"

    # The installer's certificate name and issuer expected by the stub installer
    !define CertNameDownload   "${surfer-config.brands.${branding}.brandFullName}"
    !define CertIssuerDownload "DigiCert SHA2 Assured ID Code Signing CA"

    # Dialog units are used so the UI displays correctly with the system's DPI
    # settings. These are tweaked to look good with the en-US strings; ideally
    # we would customize them for each locale but we don't really have a way to
    # implement that and it would be a ton of work for the localizers.
    !define PROFILE_CLEANUP_LABEL_TOP "50u"
    !define PROFILE_CLEANUP_LABEL_LEFT "22u"
    !define PROFILE_CLEANUP_LABEL_WIDTH "175u"
    !define PROFILE_CLEANUP_LABEL_HEIGHT "100u"
    !define PROFILE_CLEANUP_LABEL_ALIGN "left"
    !define PROFILE_CLEANUP_CHECKBOX_LEFT "22u"
    !define PROFILE_CLEANUP_CHECKBOX_WIDTH "175u"
    !define PROFILE_CLEANUP_BUTTON_LEFT "22u"
    !define INSTALL_HEADER_TOP "70u"
    !define INSTALL_HEADER_LEFT "22u"
    !define INSTALL_HEADER_WIDTH "180u"
    !define INSTALL_HEADER_HEIGHT "100u"
    !define INSTALL_BODY_LEFT "22u"
    !define INSTALL_BODY_WIDTH "180u"
    !define INSTALL_INSTALLING_TOP "115u"
    !define INSTALL_INSTALLING_LEFT "270u"
    !define INSTALL_INSTALLING_WIDTH "150u"
    !define INSTALL_PROGRESS_BAR_TOP "100u"
    !define INSTALL_PROGRESS_BAR_LEFT "270u"
    !define INSTALL_PROGRESS_BAR_WIDTH "150u"
    !define INSTALL_PROGRESS_BAR_HEIGHT "12u"

    !define PROFILE_CLEANUP_CHECKBOX_TOP_MARGIN "12u"
    !define PROFILE_CLEANUP_BUTTON_TOP_MARGIN "12u"
    !define PROFILE_CLEANUP_BUTTON_X_PADDING "80u"
    !define PROFILE_CLEANUP_BUTTON_Y_PADDING "8u"
    !define INSTALL_BODY_TOP_MARGIN "20u"

    # Font settings that can be customized for each channel
    !define INSTALL_HEADER_FONT_SIZE 20
    !define INSTALL_HEADER_FONT_WEIGHT 600
    !define INSTALL_INSTALLING_FONT_SIZE 15
    !define INSTALL_INSTALLING_FONT_WEIGHT 600

    # UI Colors that can be customized for each channel
    !define COMMON_TEXT_COLOR 0x000000
    !define COMMON_BACKGROUND_COLOR 0xFFFFFF
    !define INSTALL_INSTALLING_TEXT_COLOR 0xFFFFFF
    # This color is written as 0x00BBGGRR because it's actually a COLORREF value.
    !define PROGRESS_BAR_BACKGROUND_COLOR 0xFFAA00
  '';

  # https://github.com/zen-browser/surfer/blob/main/template/branding.optional/configure.sh
  configureSh = writeText "configure.sh" ''
    # This Source Code Form is subject to the terms of the Mozilla Public
    # License, v. 2.0. If a copy of the MPL was not distributed with this
    # file, You can obtain one at http://mozilla.org/MPL/2.0/.

    MOZ_APP_DISPLAYNAME="${surfer-config.brands.${branding}.brandShortName}"
    MOZ_MACBUNDLE_ID="${surfer-config.appId}"

    # if test "$DEVELOPER_OPTIONS"; then
    #   if test "$MOZ_DEBUG"; then
    #     # Local debug builds
    #     MOZ_HANDLER_CLSID="398ffd8d-5382-48f7-9e3b-19012762d39a"
    #     MOZ_IHANDLERCONTROL_IID="a218497e-8b10-460b-b668-a92b7ee39ff2"
    #     MOZ_ASYNCIHANDLERCONTROL_IID="ca18b9ab-04b6-41be-87f7-d99913d6a2e8"
    #     MOZ_IGECKOBACKCHANNEL_IID="231c4946-4479-4c8e-aadc-8a0e48fc4c51"
    #   else
    #     # Local non-debug builds
    #     MOZ_HANDLER_CLSID="ce573faf-7815-4fc2-a031-b092268ace9e"
    #     MOZ_IHANDLERCONTROL_IID="2b715cce-1790-4fe1-aef5-48bb5acdf3a1"
    #     MOZ_ASYNCIHANDLERCONTROL_IID="8e089670-4f57-41a7-89c0-37f17482fa6f"
    #     MOZ_IGECKOBACKCHANNEL_IID="18e2488d-310f-400f-8339-0e50b513e801"
    #   fi
    # fi
  '';

  # https://github.com/zen-browser/surfer/blob/main/src/commands/patches/branding-patch.ts
  firefox-brandingJs = writeText "firefox-branding.js" ''
    /* This Source Code Form is subject to the terms of the Mozilla Public
     * License, v. 2.0. If a copy of the MPL was not distributed with this
     * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

    pref("startup.homepage_override_url", "https://zen-browser.app/whatsnew?v=%VERSION%");
    pref("startup.homepage_welcome_url", "https://zen-browser.app/welcome/");
    pref("startup.homepage_welcome_url.additional", "https://zen-browser.app/privacy-policy/");

    // Give the user x seconds to react before showing the big UI. default=192 hours
    pref("app.update.promptWaitTime", 691200);
    // app.update.url.manual: URL user can browse to manually if for some reason
    // all update installation attempts fail.
    // app.update.url.details: a default value for the "More information about this
    // update" link supplied in the "An update is available" page of the update
    // wizard.
    pref("app.update.url.manual", "https://zen-browser.app/download/");
    pref("app.update.url.details", "https://zen-browser.app/release-notes/latest/");
    pref("app.releaseNotesURL", "https://zen-browser.app/whatsnew/");
    pref("app.releaseNotesURL.aboutDialog", "https://www.zen-browser.app/release-notes/%VERSION%/");
    pref("app.releaseNotesURL.prompt", "https://zen-browser.app/release-notes/%VERSION%/");

    // Number of usages of the web console.
    // If this is less than 5, then pasting code into the web console is disabled
    pref("devtools.selfxss.count", 5);
  '';
}
