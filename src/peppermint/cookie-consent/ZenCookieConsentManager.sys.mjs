// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const PREF_ENABLED = "zen.cookie-consent.enabled";
const PAUSED_FILE = "zen-cookie-consent-paused.json";

function hostnameOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function siteKeyFromUrl(url) {
  if (!url) {
    return null;
  }
  const spec = typeof url === "string" ? url : url?.spec;
  if (!spec) {
    return null;
  }
  try {
    return Services.eTLD.getBaseDomain(Services.io.newURI(spec));
  } catch {
    const host = hostnameOf(spec);
    return host || null;
  }
}

function isHttpUrl(url) {
  const spec = typeof url === "string" ? url : url?.spec;
  return (
    typeof spec === "string" &&
    (spec.startsWith("http:") || spec.startsWith("https:"))
  );
}

class ZenCookieConsentManager {
  #initialized = false;
  #paused = new Set();
  #epoch = 0;
  #ready = Promise.resolve();

  init() {
    if (this.#initialized || Services.appinfo.inSafeMode) {
      return;
    }
    this.#initialized = true;
    this.#ready = this.#load();
  }

  isEnabled() {
    return Services.prefs.getBoolPref(PREF_ENABLED, true);
  }

  isPaused(url) {
    const key = siteKeyFromUrl(url);
    return !!key && this.#paused.has(key);
  }

  async shouldRun(url) {
    this.init();
    await this.#ready;
    if (!this.isEnabled() || !isHttpUrl(url)) {
      return false;
    }
    return !this.isPaused(url);
  }

  setPaused(url, paused) {
    const key = siteKeyFromUrl(url);
    if (!key) {
      return;
    }
    this.#epoch++;
    if (paused) {
      this.#paused.add(key);
    } else {
      this.#paused.delete(key);
    }
    const path = this.#path();
    IOUtils.writeJSON(path, [...this.#paused]).catch(error => {
      console.error("ZenCookieConsent failed to store pauses", error);
    });
  }

  #path() {
    return PathUtils.join(PathUtils.profileDir, PAUSED_FILE);
  }

  async #load() {
    const epoch = this.#epoch;
    let data = [];
    try {
      data = await IOUtils.readJSON(this.#path());
    } catch {
      data = [];
    }
    if (epoch !== this.#epoch || !Array.isArray(data)) {
      return;
    }
    for (const key of data) {
      if (typeof key === "string" && key) {
        this.#paused.add(key);
      }
    }
  }
}

export const gZenCookieConsent = new ZenCookieConsentManager();
