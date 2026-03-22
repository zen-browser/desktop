/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { ProvidersManager } from "moz-src:///browser/components/urlbar/UrlbarProvidersManager.sys.mjs";

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  /* eslint-disable mozilla/valid-lazy */
  ZenUrlbarProviderGlobalActions:
    "resource:///modules/ZenUBActionsProvider.sys.mjs",
});

export function registerZenUrlbarProviders() {
  let instance = ProvidersManager.getInstanceForSap("urlbar");
  for (let i = 0; i < Object.keys(lazy).length; i++) {
    const provider = Object.values(lazy)[i];
    const name = Object.keys(lazy)[i];
    if (!instance.getProvider(name)) {
      instance.registerProvider(new provider());
    }
  }
}
