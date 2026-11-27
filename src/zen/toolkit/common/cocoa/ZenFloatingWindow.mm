/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "ZenCommonUtils.h"
#include "nsCocoaUtils.h"
#include "nsObjCExceptions.h"

#include "nsPIDOMWindow.h"
#include "WidgetUtils.h"
#include "nsIWidget.h"

#import <AppKit/AppKit.h>

namespace zen {

namespace {
static NSWindow* GetNativeWindow(mozIDOMWindowProxy* aWindow) {
  if (!aWindow) {
    return nil;
  }
  nsPIDOMWindowOuter* win = nsPIDOMWindowOuter::From(aWindow);
  nsCOMPtr<nsIWidget> widget =
      mozilla::widget::WidgetUtils::DOMWindowToWidget(win);
  if (!widget) {
    return nil;
  }
  return (NSWindow*)widget->GetNativeData(NS_NATIVE_WINDOW);
}
}  // namespace

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

nsresult ZenCommonUtils::GetPointerPositionInternal(int32_t* aX, int32_t* aY) {
  NS_OBJC_BEGIN_TRY_BLOCK_RETURN;
  NSPoint point = [NSEvent mouseLocation];
  *aX = NSToIntRound(point.x);
  *aY = NSToIntRound(nsCocoaUtils::FlippedScreenY(point.y));
  return NS_OK;
  NS_OBJC_END_TRY_BLOCK_RETURN(NS_ERROR_FAILURE);
}

}  // namespace zen
