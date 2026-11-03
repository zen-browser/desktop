/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef zen_nsZenWindowDragUtils_h_
#define zen_nsZenWindowDragUtils_h_

#include "nsIZenWindowDragUtils.h"

#define ZEN_WINDOW_DRAG_UTILS_CONTRACTID "@mozilla.org/zen/window-drag-utils;1"

namespace zen {

class nsZenWindowDragUtils final : public nsIZenWindowDragUtils {
  NS_DECL_ISUPPORTS
  NS_DECL_NSIZENWINDOWDRAGUTILS

 public:
  nsZenWindowDragUtils() = default;

 private:
  ~nsZenWindowDragUtils() = default;
};

}  // namespace zen

#endif
