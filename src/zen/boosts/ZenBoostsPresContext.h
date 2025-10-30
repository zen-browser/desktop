/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_ZenBoostsPressContext_h__
#define mozilla_ZenBoostsPressContext_h__

#include "nsColor.h"
#include "nsISupports.h"

namespace mozilla {

class ZenBoostsPresContext : public nsISupports {
  ~ZenBoostsPresContext();

  public:
  NS_DECL_ISUPPORTS

  nscolor mAccentColor;

  explicit ZenBoostsPresContext(nscolor aAccentColor)
      : mAccentColor(aAccentColor) {}
};

}  // namespace mozilla

#endif  // mozilla_ZenBoostsPressContext_h__
