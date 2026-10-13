// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const EASYLIST = "https://easylist.to/easylist/easylist.txt";
const EASYPRIVACY = "https://easylist.to/easylist/easyprivacy.txt";
const PETER_LOWE =
  "https://pgl.yoyo.org/adservers/serverlist.php?hostformat=adblockplus&showintro=0&mimetype=plaintext";
const UBO = "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/";

const MEDIUM_LISTS = [
  EASYLIST,
  EASYPRIVACY,
  PETER_LOWE,
  `${UBO}filters.txt`,
  `${UBO}privacy.txt`,
  `${UBO}badware.txt`,
  `${UBO}quick-fixes.txt`,
  `${UBO}unbreak.txt`,
];

export const LIST_URLS = {
  light: [EASYLIST],
  medium: MEDIUM_LISTS,
  heavy: [
    ...MEDIUM_LISTS,
    `${UBO}annoyances-cookies.txt`,
    `${UBO}annoyances-overlays.txt`,
    "https://easylist.to/easylist/fanboy-social.txt",
  ],
};

// Scriptlet and redirect resources understood by the vendored engine.
export const RESOURCES_URL =
  "https://raw.githubusercontent.com/ghostery/adblocker/master/packages/adblocker/assets/ublock-origin/resources.json";

export const UPDATE_INTERVAL_MS = 4 * 24 * 60 * 60 * 1000;

export const UBLOCK_ORIGIN_ID = "uBlock0@raymondhill.net";

// Covers the gap before the first list download finishes.
const BOOTSTRAP_HOSTS = [
  "doubleclick.net",
  "googlesyndication.com",
  "googleadservices.com",
  "googletagservices.com",
  "google-analytics.com",
  "adservice.google.com",
  "adnxs.com",
  "adsrvr.org",
  "amazon-adsystem.com",
  "scorecardresearch.com",
  "taboola.com",
  "outbrain.com",
  "criteo.com",
  "criteo.net",
  "moatads.com",
  "rubiconproject.com",
  "pubmatic.com",
  "openx.net",
  "casalemedia.com",
  "advertising.com",
  "2mdn.net",
  "adform.net",
  "imasdk.googleapis.com",
  "dmxleo.dailymotion.com",
  "smartadserver.com",
  "serving-sys.com",
];

export function hashString(text) {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash) ^ text.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

export function matchesBootstrapHost(hostname) {
  if (!hostname) {
    return false;
  }
  const host = hostname.toLowerCase().replace(/\.$/, "");
  for (const suffix of BOOTSTRAP_HOSTS) {
    if (host === suffix || host.endsWith("." + suffix)) {
      return true;
    }
  }
  return false;
}
