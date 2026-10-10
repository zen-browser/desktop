/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#import <Cocoa/Cocoa.h>

#include "nsDebug.h"
#include "nsIWidget.h"
#include "nsObjCExceptions.h"

namespace zen {

// Cocoa side of StartNativeWindowMove()
nsresult StartNativeWindowMoveCocoa(nsIWidget* aWidget) {
  NS_OBJC_BEGIN_TRY_BLOCK_RETURN;

  NSWindow* window =
      static_cast<NSWindow*>(aWidget->GetNativeData(NS_NATIVE_WINDOW));
  NS_ENSURE_TRUE(window, NS_ERROR_FAILURE);

  // performWindowDragWithEvent: needs a left-button event to start the
  // WindowServer drag session. The triggering mousedown happened in a
  // content process, so synthesize an equivalent event at the current
  // mouse location.
  NSPoint location = [window convertPointFromScreen:[NSEvent mouseLocation]];
  NSEvent* event =
      [NSEvent mouseEventWithType:NSEventTypeLeftMouseDragged
                         location:location
                    modifierFlags:0
                        timestamp:NSProcessInfo.processInfo.systemUptime
                     windowNumber:window.windowNumber
                          context:nil
                      eventNumber:0
                       clickCount:1
                         pressure:1.0];
  NS_ENSURE_TRUE(event, NS_ERROR_FAILURE);

  [window performWindowDragWithEvent:event];
  return NS_OK;

  NS_OBJC_END_TRY_BLOCK_RETURN(NS_ERROR_FAILURE);
}

}  // namespace zen
