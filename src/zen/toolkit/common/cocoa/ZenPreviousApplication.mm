/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "ZenCommonUtils.h"
#include "nsCocoaUtils.h"
#include "nsObjCExceptions.h"

#import <AppKit/AppKit.h>
#include <unistd.h>

namespace zen {

void ZenCommonUtils::ReturnToPreviousApplicationInternal() {
  NS_OBJC_BEGIN_TRY_IGNORE_BLOCK;
  CFArrayRef windows = CGWindowListCopyWindowInfo(
      kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements,
      kCGNullWindowID);
  if (!windows) {
    return;
  }
  for (NSDictionary* window in (NSArray*)windows) {
    if ([window[(id)kCGWindowLayer] intValue] != 0) {
      continue;
    }
    pid_t owner = [window[(id)kCGWindowOwnerPID] intValue];
    if (owner == getpid()) {
      continue;
    }
    NSRunningApplication* application =
        [NSRunningApplication runningApplicationWithProcessIdentifier:owner];
    if (application && !application.terminated &&
        application.activationPolicy == NSApplicationActivationPolicyRegular) {
      [application activateWithOptions:0];
      break;
    }
  }
  CFRelease(windows);
  NS_OBJC_END_TRY_IGNORE_BLOCK;
}

}  // namespace zen
