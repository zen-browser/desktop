// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  gZenCookieConsent:
    "resource:///modules/zen/cookieconsent/ZenCookieConsentManager.sys.mjs",
});

export class ZenCookieConsentParent extends JSWindowActorParent {
  async receiveMessage(message) {
    if (message.name !== "ZenCookieConsent:ShouldRun") {
      return null;
    }
    let url = message.data?.url || "";
    try {
      url = this.browsingContext?.top?.currentURI?.spec || url;
    } catch {
      // The top context can close while the query is in flight.
    }
    const run = await lazy.gZenCookieConsent.shouldRun(url);
    return { run };
  }
}
