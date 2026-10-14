/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const PREF_ALWAYS_AVAILABLE = "peppermint.reader.always-available";

const READABLE_SCHEMES = new Set(["http", "https", "file"]);

// Firefox only parses these in Reader Mode. PDFs, images and media are out.
const READABLE_TYPES = new Set([
  "text/html",
  "application/xhtml+xml",
  "text/plain",
]);

/**
 * @returns {boolean} Reader Mode is offered on every normal page, not only
 *   on pages that look like articles
 */
export function isAlwaysAvailable() {
  return Services.prefs.getBoolPref(PREF_ALWAYS_AVAILABLE, true);
}

/**
 * Whether a tab's page can be shown in Reader Mode. Firefox decides this from
 * a heuristic that hides the button on anything that is not an article; this
 * widens it to every web page with a text-based document.
 *
 * The content type is often not known yet when the location changes, so an
 * unknown type counts as readable. The controller asks again once the load
 * has finished.
 *
 * @param {XULBrowserElement} browser
 * @returns {boolean}
 */
export function isReaderEligible(browser) {
  if (!isAlwaysAvailable()) {
    return false;
  }
  try {
    const uri = browser?.currentURI;
    if (!uri || !READABLE_SCHEMES.has(uri.scheme)) {
      return false;
    }
    const type = browser.documentContentType;
    return !type || READABLE_TYPES.has(type);
  } catch {
    return false;
  }
}

/**
 * @param {string} spec
 * @returns {boolean} The URL is one an article can be saved from
 */
export function isSavableUrl(spec) {
  const url = URL.parse(spec);
  return !!url && READABLE_SCHEMES.has(url.protocol.slice(0, -1));
}
