/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { FiltersEngine } from "resource:///modules/zen/adblock/vendor/adblocker.mjs";

const CONFIGS = {
  light: {
    loadExtendedSelectors: false,
    loadGenericCosmeticsFilters: false,
    enableHtmlFiltering: false,
  },
  medium: {
    loadExtendedSelectors: false,
    loadGenericCosmeticsFilters: true,
    enableHtmlFiltering: false,
  },
  heavy: {
    loadExtendedSelectors: true,
    loadGenericCosmeticsFilters: true,
    enableHtmlFiltering: false,
  },
};

self.onmessage = event => {
  const { text, level, resources } = event.data || {};
  try {
    const engine = FiltersEngine.parse(text || "", CONFIGS[level] || CONFIGS.medium);
    if (resources) {
      engine.updateResources(resources, String(resources.length));
    }
    const bytes = engine.serialize();
    self.postMessage({ ok: true, bytes }, [bytes.buffer]);
  } catch (error) {
    self.postMessage({ ok: false, error: String(error) });
  }
};
