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

// Only a non-activating, FullScreenAuxiliary window may be ordered in on
// another application's fullscreen Space; anything else is sent to a regular
// Space behind it. This is what Little Arc does with its NSPanel, and what the
// Picture-in-Picture player does (bug 1688932): BaseWindow keeps
// NSWindowStyleMaskNonactivatingPanel even though it is not an NSPanel. The
// Auxiliary bit itself comes from macnativefullscreen="false" on the window.
void ZenCommonUtils::PrepareFloatingWindowInternal(
    mozIDOMWindowProxy* aWindow) {
  NS_OBJC_BEGIN_TRY_IGNORE_BLOCK;
  NSWindow* window = GetNativeWindow(aWindow);
  if (!window) {
    return;
  }
  window.styleMask |= NSWindowStyleMaskNonactivatingPanel;
  // Join the Space the user is on when first shown, fullscreen or not.
  window.collectionBehavior |= NSWindowCollectionBehaviorMoveToActiveSpace;
  NS_OBJC_END_TRY_IGNORE_BLOCK;
}

void ZenCommonUtils::PresentFloatingWindowInternal(
    mozIDOMWindowProxy* aWindow) {
  NS_OBJC_BEGIN_TRY_IGNORE_BLOCK;
  NSWindow* window = GetNativeWindow(aWindow);
  if (!window || !window.visible) {
    return;
  }
  // Showing a non-activating window does not make it key, so keyboard input
  // would keep going to the application in front of it.
  [window makeKeyAndOrderFront:nil];
  // Stay on that Space from now on rather than following the user around.
  window.collectionBehavior &= ~NSWindowCollectionBehaviorMoveToActiveSpace;
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
