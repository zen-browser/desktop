/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_ZenStyleSheetCache_h__
#define mozilla_ZenStyleSheetCache_h__

#include "mozilla/css/Loader.h"

namespace zen {

class ZenStyleSheetCache final {
 public:
  static ZenStyleSheetCache* Singleton();

  /**
   * @brief Clear up the cache and create a new mods stylesheet.
   * This is called when we need to recalculate the mods stylesheets.
   * @returns The mods stylesheet.
   */
  RefPtr<StyleSheet> InvalidateModsSheet();

  /**
   * @brief Get the mods stylesheet.
   * This is called when we need to get the mods stylesheets.
   * @returns The mods stylesheet.
   */
  RefPtr<StyleSheet> GetModsSheet();

  /**
   * @brief Clear the cache and release the stylesheets.
   * This is called when we need to recalculate the stylesheets,
   */
  void Clear();

 private:
  ZenStyleSheetCache() = default;
  ~ZenStyleSheetCache() = default;

  RefPtr<StyleSheet> mModsSheet;
};

} // namespace zen

#endif
