/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "ZenCommonUtils.h"
#include "nsCocoaUtils.h"
#include "nsObjCExceptions.h"
#include "mozilla/Preferences.h"

#import <AppKit/AppKit.h>
#include <unistd.h>

static const NSTimeInterval kLinkWaitInterval = 0.08;

@interface ZenActivationStandInWindow : NSWindow
@end

@implementation ZenActivationStandInWindow
- (BOOL)canBecomeKeyWindow {
  return YES;
}
- (BOOL)canBecomeMainWindow {
  return YES;
}
@end

static ZenActivationStandInWindow* sStandIn = nil;
static NSInteger sWindowToRaise = 0;
static NSInteger sKeyBeforeResigning = 0;
static bool sStandInTookActivation = false;
static bool sExpectingWindow = false;
static uint32_t sActivationGeneration = 0;

static void RemoveStandIn() {
  [sStandIn orderOut:nil];
  [sStandIn autorelease];
  sStandIn = nil;
  sStandInTookActivation = false;
  sExpectingWindow = false;
}

static void RaiseInsteadOfStandIn() {
  if (!sStandInTookActivation) {
    return;
  }
  NSWindow* window = [NSApp windowWithWindowNumber:sWindowToRaise];
  bool standInIsKey = sStandIn.isKeyWindow;
  RemoveStandIn();
  if (standInIsKey && window && NSApp.isActive) {
    [window makeKeyAndOrderFront:nil];
  }
}

static void InstallStandIn() {
  NSWindow* key = [NSApp windowWithWindowNumber:sKeyBeforeResigning];
  RemoveStandIn();
  if (!mozilla::Preferences::GetBool("zen.widget.macos.activation-stand-in",
                                     true) ||
      NSApp.isHidden || !key || !key.isVisible || key.isMiniaturized) {
    return;
  }
  sStandIn = [[ZenActivationStandInWindow alloc]
      initWithContentRect:NSMakeRect(NSMidX(key.frame), NSMidY(key.frame), 1, 1)
                styleMask:NSWindowStyleMaskBorderless
                  backing:NSBackingStoreBuffered
                    defer:NO];
  sStandIn.releasedWhenClosed = NO;
  sStandIn.opaque = NO;
  sStandIn.backgroundColor = NSColor.clearColor;
  sStandIn.hasShadow = NO;
  sStandIn.ignoresMouseEvents = YES;
  sStandIn.excludedFromWindowsMenu = YES;
  sStandIn.collectionBehavior = NSWindowCollectionBehaviorCanJoinAllSpaces |
                                NSWindowCollectionBehaviorFullScreenAuxiliary |
                                NSWindowCollectionBehaviorStationary |
                                NSWindowCollectionBehaviorIgnoresCycle;
  sWindowToRaise = key.windowNumber;
  [sStandIn makeKeyAndOrderFront:nil];
}

static void OnApplicationActivated() {
  if (!sStandIn.isVisible) {
    return;
  }
  for (NSWindow* window in NSApp.orderedWindows) {
    if (window == sStandIn) {
      break;
    }
    if (window.isVisible && window.canBecomeKeyWindow &&
        window.level == NSNormalWindowLevel) {
      RemoveStandIn();
      [window makeKeyAndOrderFront:nil];
      return;
    }
  }
  sStandInTookActivation = true;
  uint32_t generation = ++sActivationGeneration;
  dispatch_after(
      dispatch_time(DISPATCH_TIME_NOW,
                    (int64_t)(kLinkWaitInterval * NSEC_PER_SEC)),
      dispatch_get_main_queue(), ^{
        if (generation == sActivationGeneration && !sExpectingWindow) {
          RaiseInsteadOfStandIn();
        }
      });
}

@interface ZenActivationStandInObserver : NSObject
@end

@implementation ZenActivationStandInObserver
+ (void)load {
  NSNotificationCenter* center = NSNotificationCenter.defaultCenter;
  [center addObserverForName:NSApplicationDidBecomeActiveNotification
                      object:nil
                       queue:nil
                  usingBlock:^(NSNotification*) {
                    OnApplicationActivated();
                  }];
  [center addObserverForName:NSApplicationWillResignActiveNotification
                      object:nil
                       queue:nil
                  usingBlock:^(NSNotification*) {
                    NSWindow* key = NSApp.keyWindow ?: NSApp.mainWindow;
                    sKeyBeforeResigning =
                        key && key != sStandIn ? key.windowNumber : 0;
                  }];
  [center addObserverForName:NSApplicationDidResignActiveNotification
                      object:nil
                       queue:nil
                  usingBlock:^(NSNotification*) {
                    ++sActivationGeneration;
                    InstallStandIn();
                  }];
  [center addObserverForName:NSApplicationWillTerminateNotification
                      object:nil
                       queue:nil
                  usingBlock:^(NSNotification*) {
                    ++sActivationGeneration;
                    RemoveStandIn();
                  }];
  [center addObserverForName:NSWindowWillCloseNotification
                      object:nil
                       queue:nil
                  usingBlock:^(NSNotification* aNotification) {
                    if (sExpectingWindow && aNotification.object != sStandIn) {
                      RaiseInsteadOfStandIn();
                    }
                  }];
  [center addObserverForName:NSWindowDidBecomeKeyNotification
                      object:nil
                       queue:nil
                  usingBlock:^(NSNotification* aNotification) {
                    if (sStandInTookActivation && NSApp.isActive &&
                        aNotification.object != sStandIn) {
                      RemoveStandIn();
                    }
                  }];
}
@end

static bool ActivationStandInExpectWindow() {
  if (!sStandIn.isVisible || (!sStandInTookActivation && NSApp.isActive)) {
    return false;
  }
  sExpectingWindow = true;
  return true;
}

static bool IsActivationStandIn(NSWindow* aWindow) {
  return aWindow && aWindow == sStandIn;
}

static CFAbsoluteTime sLastActivation = 0;

@interface ZenActivationObserver : NSObject
@end

@implementation ZenActivationObserver
+ (void)load {
  [NSNotificationCenter.defaultCenter
      addObserverForName:NSApplicationDidBecomeActiveNotification
                  object:nil
                   queue:nil
              usingBlock:^(NSNotification*) {
                sLastActivation = CFAbsoluteTimeGetCurrent();
              }];
}
@end

namespace zen {

static const CFTimeInterval kRaisedByActivationInterval = 2.0;

void ZenCommonUtils::KeepWindowsBehindPreviousApplicationInternal() {
  NS_OBJC_BEGIN_TRY_IGNORE_BLOCK;
  if (ActivationStandInExpectWindow()) {
    return;
  }
  if (!NSApp.isActive) {
    CFAbsoluteTime requested = CFAbsoluteTimeGetCurrent();
    __block id observer = [NSNotificationCenter.defaultCenter
        addObserverForName:NSApplicationDidBecomeActiveNotification
                    object:nil
                     queue:nil
                usingBlock:^(NSNotification*) {
                  [NSNotificationCenter.defaultCenter removeObserver:observer];
                  if (CFAbsoluteTimeGetCurrent() - requested <
                      kRaisedByActivationInterval) {
                    KeepWindowsBehindPreviousApplicationInternal();
                  }
                }];
    return;
  }
  if (CFAbsoluteTimeGetCurrent() - sLastActivation >
      kRaisedByActivationInterval) {
    return;
  }
  CFArrayRef windows = CGWindowListCopyWindowInfo(
      kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements,
      kCGNullWindowID);
  if (!windows) {
    return;
  }
  NSMutableArray<NSWindow*>* raised = [NSMutableArray array];
  NSInteger previous = 0;
  for (NSDictionary* window in (NSArray*)windows) {
    if ([window[(id)kCGWindowLayer] intValue] != 0) {
      continue;
    }
    pid_t owner = [window[(id)kCGWindowOwnerPID] intValue];
    NSInteger number = [window[(id)kCGWindowNumber] integerValue];
    if (owner == getpid()) {
      NSWindow* ours = [NSApp windowWithWindowNumber:number];
      if (ours && !IsActivationStandIn(ours)) {
        [raised addObject:ours];
      }
      continue;
    }
    NSRunningApplication* application =
        [NSRunningApplication runningApplicationWithProcessIdentifier:owner];
    if (application && !application.terminated &&
        application.activationPolicy == NSApplicationActivationPolicyRegular) {
      previous = number;
      break;
    }
  }
  CFRelease(windows);
  if (previous) {
    for (NSWindow* window in raised.reverseObjectEnumerator) {
      [window orderWindow:NSWindowBelow relativeTo:previous];
    }
  }
  NS_OBJC_END_TRY_IGNORE_BLOCK;
}

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
