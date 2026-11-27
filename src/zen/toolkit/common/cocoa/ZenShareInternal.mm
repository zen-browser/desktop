/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "ZenShareInternal.h"
#include "nsCocoaUtils.h"

#include "ZenNativeWindow.h"

extern mozilla::LazyLogModule gCocoaUtilsLog;
#undef LOG
#define LOG(...) MOZ_LOG(gCocoaUtilsLog, mozilla::LogLevel::Info, (__VA_ARGS__))

#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>

auto nsZenNativeShareInternal::ShowNativeDialog(
    nsCOMPtr<mozIDOMWindowProxy>& aWindow, nsIURI* aUrl,
    const nsACString& aTitle, const nsACString& aText, uint32_t aX, uint32_t aY,
    uint32_t aWidth, uint32_t aHeight) -> nsresult {
  // Just use the URL since apple doesn't support sharing text
  // and title in the share dialog
  nsAutoCString pageUrlAsStringTemp;
  if (aUrl) {
    nsresult rv = aUrl->GetSpec(pageUrlAsStringTemp);
    MOZ_ASSERT(NS_SUCCEEDED(rv));
  } else {
    pageUrlAsStringTemp.SetIsVoid(true);
  }
  NSURL* pageUrl =
      nsCocoaUtils::ToNSURL(NS_ConvertUTF8toUTF16(pageUrlAsStringTemp));
  if (!pageUrl || (![pageUrl.scheme isEqualToString:@"https"] &&
                   ![pageUrl.scheme isEqualToString:@"http"])) {
    return NS_ERROR_FAILURE;
  }
  NSSharingServicePicker* sharingPicker =
      [[NSSharingServicePicker alloc] initWithItems:@[ pageUrl ]];
  NSWindow* cocoaMru = zen::GetNativeWindow(aWindow);
  if (!cocoaMru) {
    LOG("ERROR: failed to get native window pointer");
    return NS_ERROR_FAILURE;
  }
  // Create a rect for the sharing picker
  NSRect rect = NSMakeRect(aX, aY, aWidth, aHeight);
  [sharingPicker showRelativeToRect:rect
                             ofView:cocoaMru.contentView
                      preferredEdge:NSMaxYEdge];
  [sharingPicker release];
  return NS_OK;
}
