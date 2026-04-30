/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "ZenCommonUtils.h"
#include "nsCocoaUtils.h"

#include "nsString.h"

#import <AppKit/AppKit.h>

namespace zen {

namespace {

constexpr CGFloat kMacOSAppIconSize = 1024.0;
NSUInteger sRunningIconGeneration = 0;

struct MacOSAppIconImages {
  NSImage* bundleIconImage = nil;
  NSImage* runningIconImage = nil;
};

auto ApplyRunningMacOSAppIconImage(NSImage* aIconImage) -> void {
  [NSApp setApplicationIconImage:aIconImage];
  [[NSApp dockTile] display];
}

auto SetRunningMacOSAppIconImage(NSImage* aIconImage) -> void {
  NSUInteger generation = ++sRunningIconGeneration;
  ApplyRunningMacOSAppIconImage(aIconImage);

  NSImage* iconImage = [aIconImage retain];
  dispatch_after(
      dispatch_time(DISPATCH_TIME_NOW, static_cast<int64_t>(0.5 * NSEC_PER_SEC)),
      dispatch_get_main_queue(), ^{
        if (generation == sRunningIconGeneration) {
          ApplyRunningMacOSAppIconImage(iconImage);
        }
        [iconImage release];
      });
}

auto SetMacOSAppBundleIconOverride(NSImage* aIconImage) -> void {
  NSString* bundlePath = [[NSBundle mainBundle] bundlePath];
  if (bundlePath) {
    [[NSWorkspace sharedWorkspace] setIcon:aIconImage
                                   forFile:bundlePath
                                   options:0];
  }
}

auto CopyRasterizedMacOSAppIconImage(NSImage* aIconImage) -> NSImage* {
  if (!aIconImage) {
    return nil;
  }

  NSSize iconSize = NSMakeSize(kMacOSAppIconSize, kMacOSAppIconSize);
  NSBitmapImageRep* bitmap = [[NSBitmapImageRep alloc]
      initWithBitmapDataPlanes:nullptr
                    pixelsWide:static_cast<NSInteger>(iconSize.width)
                    pixelsHigh:static_cast<NSInteger>(iconSize.height)
                 bitsPerSample:8
               samplesPerPixel:4
                      hasAlpha:YES
                      isPlanar:NO
                colorSpaceName:NSDeviceRGBColorSpace
                   bytesPerRow:0
                  bitsPerPixel:0];
  if (!bitmap) {
    return nil;
  }

  [bitmap setSize:iconSize];
  NSGraphicsContext* context =
      [NSGraphicsContext graphicsContextWithBitmapImageRep:bitmap];
  if (!context) {
    [bitmap release];
    return nil;
  }

  [NSGraphicsContext saveGraphicsState];
  [NSGraphicsContext setCurrentContext:context];
  [context setImageInterpolation:NSImageInterpolationHigh];
  [aIconImage drawInRect:NSMakeRect(0, 0, iconSize.width, iconSize.height)
                fromRect:NSZeroRect
               operation:NSCompositingOperationSourceOver
                fraction:1.0
          respectFlipped:NO
                   hints:nil];
  [NSGraphicsContext restoreGraphicsState];

  NSImage* rasterizedImage = [[[NSImage alloc] initWithSize:iconSize] autorelease];
  [rasterizedImage addRepresentation:bitmap];
  [bitmap release];

  return rasterizedImage;
}

auto SetMacOSAppIconImage(const MacOSAppIconImages& aIconImages) -> nsresult {
  NSImage* bundleIconImage =
      CopyRasterizedMacOSAppIconImage(aIconImages.bundleIconImage);
  NSImage* runningIconImage =
      CopyRasterizedMacOSAppIconImage(aIconImages.runningIconImage);
  if (!bundleIconImage || !runningIconImage) {
    return NS_ERROR_FAILURE;
  }

  SetMacOSAppBundleIconOverride(bundleIconImage);
  SetRunningMacOSAppIconImage(runningIconImage);
  return NS_OK;
}

auto LoadDefaultMacOSAppIconImage() -> NSImage* {
  NSBundle* mainBundle = [NSBundle mainBundle];
  NSString* resourcePath = [mainBundle resourcePath];
  NSString* iconFile =
      [mainBundle objectForInfoDictionaryKey:@"CFBundleIconFile"];
  if (!resourcePath || !iconFile) {
    return nil;
  }

  if ([[iconFile pathExtension] length] == 0) {
    iconFile = [iconFile stringByAppendingPathExtension:@"icns"];
  }

  NSString* iconPath = [resourcePath stringByAppendingPathComponent:iconFile];
  return [[[NSImage alloc] initWithContentsOfFile:iconPath] autorelease];
}

auto ResetMacOSAppIconImage() -> nsresult {
  NSImage* defaultIconImage = LoadDefaultMacOSAppIconImage();
  if (!defaultIconImage) {
    return NS_ERROR_FAILURE;
  }

  SetMacOSAppBundleIconOverride(nil);
  SetRunningMacOSAppIconImage(defaultIconImage);
  return NS_OK;
}

auto LoadMacOSRunningAppIconImage(NSBundle* aIconBundle, NSString* aIconName)
    -> NSImage* {
  NSArray<NSString*>* imageNames = @[
    [aIconName stringByAppendingString:@"Preview"],
    @"alternate-preview",
    aIconName,
  ];

  for (NSString* imageName in imageNames) {
    NSImage* iconImage = [aIconBundle imageForResource:imageName];
    if (iconImage) {
      return iconImage;
    }
  }

  return nil;
}

auto LoadMacOSAppIconImages(const nsAString& aIconBundlePath,
                            const nsAString& aIconName) -> MacOSAppIconImages {
  NSString* resourcePath = [[NSBundle mainBundle] resourcePath];
  if (!resourcePath) {
    return {};
  }

  NSString* iconBundlePath = nsCocoaUtils::ToNSString(aIconBundlePath);
  NSString* iconName = nsCocoaUtils::ToNSString(aIconName);
  NSArray<NSString*>* bundlePaths = @[
    [resourcePath stringByAppendingPathComponent:iconBundlePath],
    [[resourcePath stringByAppendingPathComponent:@"browser"]
        stringByAppendingPathComponent:iconBundlePath],
  ];

  for (NSString* bundlePath in bundlePaths) {
    NSBundle* iconBundle = [NSBundle bundleWithPath:bundlePath];
    NSImage* bundleIconImage = [iconBundle imageForResource:iconName];
    if (bundleIconImage) {
      return {bundleIconImage,
              LoadMacOSRunningAppIconImage(iconBundle, iconName)};
    }
  }

  return {};
}

}  // namespace

auto ZenCommonUtils::SetMacOSAppIconInternal(
    const nsAString& aIconBundlePath, const nsAString& aIconName) -> nsresult {
  if (!NSApp) {
    return NS_ERROR_NOT_AVAILABLE;
  }

  if (aIconBundlePath.IsEmpty() && aIconName.IsEmpty()) {
    return ResetMacOSAppIconImage();
  }

  if (aIconBundlePath.IsEmpty() || aIconName.IsEmpty()) {
    return NS_ERROR_INVALID_ARG;
  }

  MacOSAppIconImages iconImages =
      LoadMacOSAppIconImages(aIconBundlePath, aIconName);
  if (!iconImages.bundleIconImage || !iconImages.runningIconImage) {
    return NS_ERROR_FAILURE;
  }

  return SetMacOSAppIconImage(iconImages);
}

}  // namespace zen
