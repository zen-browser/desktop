/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "ZenMouseTracker.h"
#include "ZenMouseTrackerInternal.h"

#include "nsCocoaUtils.h"

#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>

namespace zen {

// The global monitor only sees events delivered to other applications, so a
// local monitor is needed as well for moves that AppKit routes to our own
// app while the pointer is outside of the tracked window (AppKit sends mouse
// moved events to the key window regardless of the pointer position).
static id sLocalMonitor = nil;
static id sGlobalMonitor = nil;

static void ReportPointerPosition() {
  NSPoint point = [NSEvent mouseLocation];
  point.y = nsCocoaUtils::FlippedScreenY(point.y);
  ZenMouseTracker::OnNativePointerMove(
      mozilla::DesktopPoint(float(point.x), float(point.y)));
}

nsresult ZenNativeMouseMonitor::Start() {
  NS_OBJC_BEGIN_TRY_BLOCK_RETURN;
  if (sLocalMonitor || sGlobalMonitor) {
    return NS_OK;
  }
  const NSEventMask mask = NSEventMaskMouseMoved | NSEventMaskLeftMouseDragged |
                           NSEventMaskRightMouseDragged |
                           NSEventMaskOtherMouseDragged;
  sLocalMonitor =
      [NSEvent addLocalMonitorForEventsMatchingMask:mask
                                            handler:^(NSEvent* aEvent) {
                                              ReportPointerPosition();
                                              return aEvent;
                                            }];
  sGlobalMonitor =
      [NSEvent addGlobalMonitorForEventsMatchingMask:mask
                                             handler:^(NSEvent* aEvent) {
                                               ReportPointerPosition();
                                             }];
  return NS_OK;
  NS_OBJC_END_TRY_BLOCK_RETURN(NS_ERROR_NOT_AVAILABLE);
}

void ZenNativeMouseMonitor::Stop() {
  NS_OBJC_BEGIN_TRY_IGNORE_BLOCK;
  if (sLocalMonitor) {
    [NSEvent removeMonitor:sLocalMonitor];
    sLocalMonitor = nil;
  }
  if (sGlobalMonitor) {
    [NSEvent removeMonitor:sGlobalMonitor];
    sGlobalMonitor = nil;
  }
  NS_OBJC_END_TRY_IGNORE_BLOCK;
}

}  // namespace zen
