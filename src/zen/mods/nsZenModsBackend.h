/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_ZenStyleSheetCache_h__
#define mozilla_ZenStyleSheetCache_h__

#include "ZenStyleSheetCache.h"
#include "nsIZenCommonUtils.h"

namespace zen {

class ZenModsBackend final : public nsZenModsBackend {
  NS_DECL_ISUPPORTS
  NS_DECL_NSIZENMODSBACKEND

 public:
  explicit ZenModsBackend() = default;

 private:
  ~ZenModsBackend() = default;

  RefPtr<ZenStyleSheetCache> mCache;
};

} // namespace zen

#endif
