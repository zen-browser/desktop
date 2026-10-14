// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

export const VENDORS = [
  {
    id: "onetrust",
    root: "#onetrust-banner-sdk, #onetrust-consent-sdk",
    reject:
      "#onetrust-reject-all-handler, .ot-pc-refuse-all-handler, .onetrust-reject-all-handler",
  },
  {
    id: "cookiebot",
    root: "#CybotCookiebotDialog",
    reject:
      "#CybotCookiebotDialogBodyButtonDecline, #CybotCookiebotDialogBodyLevelButtonLevelOptinDeclineAll",
  },
  {
    id: "quantcast",
    root: "#qc-cmp2-container, .qc-cmp2-container",
    reject: "button[mode='reject']",
  },
  {
    id: "didomi",
    root: "#didomi-host, #didomi-notice, .didomi-popup-container",
    reject:
      "#didomi-notice-disagree-button, .didomi-disagree-button, button#btn-toggle-disagree",
  },
  {
    id: "sourcepoint",
    root: "[id^='sp_message_container']",
    reject:
      ".sp_choice_type_REJECT_ALL, button[title='Reject All' i], button[aria-label='Reject All' i]",
  },
  {
    id: "usercentrics",
    root: "#usercentrics-root",
    reject: "[data-testid='uc-deny-all-button']",
  },
  {
    id: "cookieyes",
    root: ".cky-consent-container, #cky-consent",
    reject: ".cky-btn-reject",
  },
  {
    id: "complianz",
    root: "#cmplz-cookiebanner-container, .cmplz-cookiebanner",
    reject: ".cmplz-deny",
  },
  {
    id: "osano",
    root: ".osano-cm-window, .osano-cm-dialog",
    reject: ".osano-cm-denyAll, .osano-cm-deny",
  },
  {
    id: "trustarc",
    root: "#truste-consent-track, #consent_blackbar, .trustarc-banner",
    reject: "#truste-consent-required, .pdynamicbutton .required",
  },
  {
    id: "iubenda",
    root: "#iubenda-cs-banner, .iubenda-cs-container",
    reject: ".iubenda-cs-reject-btn",
  },
  {
    id: "termly",
    root: "[id^='termly-consent'], #termly-code-snippet-support",
    reject: "[data-tid='banner-decline']",
  },
  {
    id: "klaro",
    root: ".klaro",
    reject: ".cm-btn-decline, .cn-decline",
  },
  {
    id: "cookiescript",
    root: "#cookiescript_injected_wrapper, #cookiescript_injected",
    reject: "#cookiescript_reject",
  },
  {
    id: "moove",
    root: "#moove_gdpr_cookie_info_bar, .moove-gdpr-info-bar-container",
    reject: ".moove-gdpr-infobar-reject-btn",
  },
  {
    id: "borlabs",
    root: "#BorlabsCookieBox, #BorlabsCookie",
    reject: "[data-cookie-refuse]",
  },
  {
    id: "fundingchoices",
    root: ".fc-consent-root",
    reject: ".fc-cta-do-not-consent",
  },
  {
    id: "cookieconsent",
    root: ".cc-window, .cc-banner",
    reject: ".cc-deny, .cc-btn.cc-deny",
  },
  {
    id: "cookielawinfo",
    root: "#cookie-law-info-bar, .cli-bar-container, #cookie-notice",
    reject:
      ".wt-cli-reject-btn, #wt-cli-reject-btn, .cli-btn-reject, .cookie_action_close_header_reject, #cn-refuse-cookie",
  },
];

/**
 * Known consent managers, in the order a person would refuse them:
 * click reject when it is already on screen, otherwise open preferences,
 * then click reject. A step marked final means the refusal itself.
 * Optional steps are skipped when that control is not in the dialog yet.
 */
export const CMP_RULES = {
  onetrust: [
    {
      click:
        "#onetrust-reject-all-handler, .onetrust-reject-all-handler",
      optional: true,
      final: true,
    },
    {
      click: "#onetrust-pc-btn-handler, button.ot-sdk-show-settings",
      optional: true,
    },
    { click: ".ot-pc-refuse-all-handler", final: true },
  ],
  sourcepoint: [
    {
      click:
        ".sp_choice_type_REJECT_ALL, button[title='Reject All' i], button[aria-label='Reject All' i]",
      optional: true,
      final: true,
    },
    {
      click: "button[title*='option' i], button[title*='setting' i]",
      optional: true,
    },
    { click: ".sp_choice_type_REJECT_ALL", final: true },
  ],
  usercentrics: [
    { click: "[data-testid='uc-deny-all-button']", final: true },
  ],
  didomi: [
    {
      click:
        "#didomi-notice-disagree-button, .didomi-disagree-button, button#btn-toggle-disagree",
      optional: true,
      final: true,
    },
    { click: "#didomi-notice-learn-more-button", optional: true },
    {
      click: ".didomi-components-button--color-secondary, button#btn-toggle-disagree",
      final: true,
    },
  ],
  quantcast: [
    { click: "button[mode='reject']", optional: true, final: true },
    { click: "button[mode='secondary']", optional: true },
    { click: "button[mode='reject']", final: true },
  ],
};

/**
 * Hosts that serve a consent dialog in a subframe. Matched as the hostname
 * or a subdomain so a vendor's regional CDN still qualifies.
 */
export const CONSENT_FRAME_HOSTS = [
  "cdn.cookielaw.org",
  "cookielaw.org",
  "privacy-mgmt.com",
  "sourcepoint.mgr.consensu.org",
  "quantcast.mgr.consensu.org",
  "cmp.quantcast.com",
  "sdk.privacy-center.org",
  "privacy-center.org",
  "fundingchoicesmessages.google.com",
  "cdn.consentmanager.net",
  "consentmanager.net",
  "consentcdn.cookiebot.com",
  "cookiebot.com",
  "app.usercentrics.eu",
  "usercentrics.eu",
];

