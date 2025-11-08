/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { UrlbarProvidersManager } from 'moz-src:///browser/components/urlbar/UrlbarProvidersManager.sys.mjs';

const providers = {};
ChromeUtils.defineESModuleGetters(providers, {
  ZenUrlbarProviderGlobalActions: 'resource:///modules/ZenUBActionsProvider.sys.mjs',
});

export function registerZenUrlbarProviders() {
  for (let i = 0; i < Object.keys(providers).length; i++) {
    const provider = Object.values(providers)[i];
    const name = Object.keys(providers)[i];
    if (!UrlbarProvidersManager.getProvider(name)) {
      UrlbarProvidersManager.registerProvider(new provider());
    }
  }
}
