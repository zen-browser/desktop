// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * Default feature folder for a new overlay patch, chosen from the engine path.
 * Only used to group patches under peppermint/patches/<feature>/; `pm:record`
 * accepts any feature name and keeps an existing patch where it already is.
 */

const RULES = [
  [/^browser\/base\/moz\.build$|moz\.build$|moz-configure|^config\/|^python\/|^build\/|^toolkit\/xre\/|nsAboutRedirector|^security\/|^widget\/|^browser\/installer\//, "platform"],
  [/urlbar|Urlbar|ZenUB|omnibox/, "urlbar"],
  [/preferences|zen-settings|zenKeyboardShortcuts/, "preferences"],
  [/site-data|SiteData|site_control|identity-block|ZenSiteData/, "site-data"],
  [/sessionstore|SessionStore|SessionWriter|ZenSessionManager|ZenSessionStore|session-store/, "sessions"],
  [/tabbrowser|Tabbrowser|vertical-tabs|ZenPinned|ZenEssentials|\/tabs\//, "tabs"],
  [/welcome|Welcome|about|branding|nsis|hardenedruntime|custom-properties|ZenUpdates|ZenSidebarNotification|zen-icons|privatebrowsing|stylelintrc|license/, "branding"],
  [/spaces|ZenSpace|ZenGradient|workspaces|space-routing/, "spaces"],
  [/mods|ZenMods|boosts/, "mods"],
  [/compact|Compact/, "compact-mode"],
  [/zen\/tests\/|\.toml$/, "tests"],
  [/\.css$|styles|themes/, "theme"],
  [/ZenCommonUtils|ZenUIManager|ZenStartup|ZenCustomizableUI|ZenActorsManager|ZenUIMigration|zen\.globals|ZenPreloaded|zen-assets|zen-sets/, "core"],
];

export function featureFor(enginePath) {
  for (const [re, feature] of RULES) {
    if (re.test(enginePath)) {
      return feature;
    }
  }
  return "core";
}
