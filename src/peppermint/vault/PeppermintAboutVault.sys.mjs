/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const { nsIAboutModule } = Ci;

const PAGE_URL = "chrome://browser/content/peppermint-vault/vault.xhtml";

/**
 * about:vault. A privileged page in the parent process (like about:saved), so
 * it talks to the Vault modules directly and needs no actor.
 */
export class PeppermintAboutVault {
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
