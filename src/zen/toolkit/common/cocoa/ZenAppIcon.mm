/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "ZenCommonUtils.h"
#include "nsCocoaUtils.h"

#include "nsString.h"

#import <AppKit/AppKit.h>

namespace zen {

namespace {

auto SetMacOSAppIconImage(NSImage* aIconImage) -> nsresult {
  NSString* bundlePath = [[NSBundle mainBundle] bundlePath];
  if (!bundlePath) {
    return NS_ERROR_NOT_AVAILABLE;
  }

  if (![[NSWorkspace sharedWorkspace] setIcon:aIconImage
                                      forFile:bundlePath
                                      options:0]) {
    return NS_ERROR_FAILURE;
  }

  [NSApp setApplicationIconImage:aIconImage];
  [[NSApp dockTile] display];
  return NS_OK;
}

auto LoadMacOSAppIconImage(const nsAString& aIconBundlePath,
                           const nsAString& aIconName) -> NSImage* {
  NSString* resourcePath = [[NSBundle mainBundle] resourcePath];
  if (!resourcePath) {
    return nil;
  }

  NSString* iconBundlePath = nsCocoaUtils::ToNSString(aIconBundlePath);
  NSBundle* iconBundle = [NSBundle
      bundleWithPath:[resourcePath stringByAppendingPathComponent:iconBundlePath]];
  if (!iconBundle) {
    return nil;
  }

  return [iconBundle imageForResource:nsCocoaUtils::ToNSString(aIconName)];
}

}  // namespace

auto ZenCommonUtils::SetMacOSAppIconInternal(
    const nsAString& aIconBundlePath, const nsAString& aIconName) -> nsresult {
  if (!NSApp) {
    return NS_ERROR_NOT_AVAILABLE;
  }

  if (aIconBundlePath.IsEmpty() && aIconName.IsEmpty()) {
    return SetMacOSAppIconImage(nil);
  }

  if (aIconBundlePath.IsEmpty() || aIconName.IsEmpty()) {
    return NS_ERROR_INVALID_ARG;
  }

  NSImage* iconImage = LoadMacOSAppIconImage(aIconBundlePath, aIconName);
  if (!iconImage) {
    return NS_ERROR_FAILURE;
  }

  return SetMacOSAppIconImage(iconImage);
}

}  // namespace zen
