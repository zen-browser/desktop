/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const { nsIAboutModule } = Ci;

const PAGE_URL = "chrome://browser/content/peppermint-reader/saved.xhtml";

/**
 * about:saved, the list of articles saved for offline reading. It is a
 * privileged page in the parent process (like about:downloads), so it reads
 * the store directly.
 */
export class PeppermintAboutSaved {
  QueryInterface = ChromeUtils.generateQI([nsIAboutModule]);

  newChannel(_uri, loadInfo) {
    const channel = Services.io.newChannelFromURIWithLoadInfo(
      Services.io.newURI(PAGE_URL),
      loadInfo
    );
    channel.owner = Services.scriptSecurityManager.getSystemPrincipal();
    return channel;
  }

  getURIFlags() {
    return nsIAboutModule.ALLOW_SCRIPT | nsIAboutModule.IS_SECURE_CHROME_UI;
  }

  getChromeURI() {
    return Services.io.newURI(PAGE_URL);
  }
}
