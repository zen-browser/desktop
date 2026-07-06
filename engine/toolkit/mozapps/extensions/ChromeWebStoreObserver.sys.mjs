/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const MSG_INSTALL_ADDON = "WebInstallerInstallAddonFromWebpage";

export function ChromeWebStoreObserver() {}

ChromeWebStoreObserver.prototype = {
  observe(subject, topic, data) {
    if (topic !== "http-on-examine-response") {
      return;
    }

    try {
      let channel = subject.QueryInterface(Ci.nsIHttpChannel);
      let uri = channel.URI;

      if (
        uri.host === "clients2.google.com" &&
        uri.filePath.includes("/service/update2/crx")
      ) {
        channel.cancel(Cr.NS_BINDING_ABORTED);

        let { loadInfo } = channel;
        let browsingContext = loadInfo.targetBrowsingContext;
        let browser = browsingContext?.top.embedderElement;

        let install = {
          uri: uri.spec,
          hash: null,
          name: null,
          icon: null,
          mimetype: "application/x-crx",
          triggeringPrincipal: loadInfo.triggeringPrincipal,
          callbackID: -1,
          method: "chrome-web-store",
          sourceHost: "chrome.google.com",
          sourceURL: uri.spec,
          browsingContext,
          hasCrossOriginAncestor: false,
        };

        if (browser) {
          let mm = browser.messageManager;
          if (mm) {
            mm.sendAsyncMessage(MSG_INSTALL_ADDON, install);
          }
        } else {
          Services.ppmm.sendAsyncMessage(MSG_INSTALL_ADDON, install);
        }
      }
    } catch (e) {}
  },

  classID: Components.ID("{a1b2c3d4-e5f6-7890-abcd-ef1234567890}"),
  QueryInterface: ChromeUtils.generateQI(["nsIObserver"]),
};
// NIXO .mjs
// NIXO .mjs
// NIXO .mjs
// NIXO
// NIXO
// NIXO
// NIXO
// NIXO
// NIXO
