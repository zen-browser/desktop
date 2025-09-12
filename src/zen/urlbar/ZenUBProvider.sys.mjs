/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { UrlbarProvidersManager } from 'resource:///modules/UrlbarProvidersManager.sys.mjs';

const providers = {};
ChromeUtils.defineESModuleGetters(providers, {
  ZenUrlbarProviderGlobalActions: 'resource:///modules/ZenUBActionsProvider.sys.mjs',
});

export function registerZenUrlbarProviders() {
  for (let provider of Object.values(providers)) {
    UrlbarProvidersManager.registerProvider(new provider());
  }
}
