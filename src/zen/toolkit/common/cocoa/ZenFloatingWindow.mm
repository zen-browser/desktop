/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "ZenCommonUtils.h"
#include "nsObjCExceptions.h"

#include "ZenNativeWindow.h"

namespace zen {

void ZenCommonUtils::ShowOverFullScreenApplicationsInternal(
    mozIDOMWindowProxy* aWindow) {
  NS_OBJC_BEGIN_TRY_IGNORE_BLOCK;
  NSWindow* window = GetNativeWindow(aWindow);
  if (!window) {
    return;
  }
  // The window server only puts a window on another application's fullscreen
  // Space when it is non-activating and FullScreenAuxiliary.
  window.styleMask |= NSWindowStyleMaskNonactivatingPanel;
  window.collectionBehavior =
      (window.collectionBehavior &
       ~(NSWindowCollectionBehaviorFullScreenPrimary |
         NSWindowCollectionBehaviorFullScreenAllowsTiling)) |
      NSWindowCollectionBehaviorFullScreenAuxiliary |
      NSWindowCollectionBehaviorFullScreenDisallowsTiling;
  NS_OBJC_END_TRY_IGNORE_BLOCK;
}

}  // namespace zen
