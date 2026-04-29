/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_ZenWindowControl_h_
#define mozilla_ZenWindowControl_h_

#include "nsIZenWindowControl.h"

namespace zen {

class ZenWindowControl final : public nsIZenWindowControl {
 public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIZENWINDOWCONTROL

  ZenWindowControl() = default;

 private:
  ~ZenWindowControl() = default;
};

}  // namespace zen

#endif
