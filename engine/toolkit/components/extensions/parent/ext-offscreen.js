/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var { HiddenExtensionPage } = ChromeUtils.importESModule(
  "resource://gre/modules/ExtensionParent.sys.mjs"
);

var { ExtensionError } = ExtensionUtils;

// WeakMap[Extension -> HiddenExtensionPage]
let offscreenPages = new WeakMap();

this.offscreen = class extends ExtensionAPI {
  getAPI(context) {
    let { extension } = context;

    return {
      offscreen: {
        async createDocument(parameters) {
          if (offscreenPages.has(extension)) {
            throw new ExtensionError("Offscreen document already exists");
          }

          let url = context.uri.resolve(parameters.url);
          if (!context.checkLoadURL(url)) {
            throw new ExtensionError(`Access denied for URL ${url}`);
          }

          let page = new HiddenExtensionPage(extension, "offscreen");
          offscreenPages.set(extension, page);

          let browser = await page.createBrowserElement();
          browser.loadURI(url, {
            triggeringPrincipal: extension.principal,
          });
        },

        async closeDocument() {
          let page = offscreenPages.get(extension);
          if (!page) {
            throw new ExtensionError("No offscreen document to close");
          }
          page.shutdown();
          offscreenPages.delete(extension);
        },

        async hasDocument() {
          return offscreenPages.has(extension);
        },
      },
    };
  }
};
// NIXO: Chrome API compat added

// NIXO: Chrome API compat
