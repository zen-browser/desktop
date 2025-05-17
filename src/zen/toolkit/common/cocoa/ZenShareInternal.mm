/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "ZenShareInternal.h"
#include "nsCocoaUtils.h"

#include "nsPIDOMWindow.h"
#include "WidgetUtils.h"
#include "nsIWidget.h"

extern mozilla::LazyLogModule gCocoaUtilsLog;
#undef LOG
#define LOG(...) MOZ_LOG(gCocoaUtilsLog, mozilla::LogLevel::Info, (__VA_ARGS__))

#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>

namespace zen {
using ::mozilla::widget::WidgetUtils;

/**
 * Get the native NSWindow pointer from a DOM window.
 *
 * @param a_window The DOM window to get the native window from.
 * @param a_nativeWindow The pointer to the native NSWindow.
 * @return NS_OK on success, or an error code on failure.
 */
static nsresult GetNativeWindowPointerFromDOMWindow(mozIDOMWindowProxy* a_window,
                                             NSWindow** a_nativeWindow) {
  *a_nativeWindow = nil;
  if (!a_window) return NS_ERROR_INVALID_ARG;
  nsPIDOMWindowOuter* win = nsPIDOMWindowOuter::From(a_window);
  nsCOMPtr<nsIWidget> widget = WidgetUtils::DOMWindowToWidget(win);
  if (!widget) {
    return NS_ERROR_FAILURE;
  }
  *a_nativeWindow = (NSWindow*)widget->GetNativeData(NS_NATIVE_WINDOW);
  return NS_OK;
}
}

auto nsZenNativeShareInternal::ShowNativeDialog(nsCOMPtr<mozIDOMWindowProxy>& aWindow, 
      nsIURI* aUrl, const nsACString& aTitle, const nsACString& aText, uint32_t aX, uint32_t aY,
      uint32_t aWidth, uint32_t aHeight)
    -> nsresult {
  // Just use the URL since apple doesn't support sharing text
  // and title in the share dialog
  nsAutoCString pageUrlAsStringTemp;
  if (aUrl) {
    nsresult rv = aUrl->GetSpec(pageUrlAsStringTemp);
    MOZ_ASSERT(NS_SUCCEEDED(rv));
    mozilla::Unused << rv;
  } else {
    pageUrlAsStringTemp.SetIsVoid(true);
  }
  NSURL* pageUrl = nsCocoaUtils::ToNSURL(
    NS_ConvertUTF8toUTF16(pageUrlAsStringTemp)
  );
  if (!pageUrl || (![pageUrl.scheme isEqualToString:@"https"] &&
                   ![pageUrl.scheme isEqualToString:@"http"])) {
    return NS_ERROR_FAILURE;
  }
  NSSharingServicePicker* sharingPicker =
      [[NSSharingServicePicker alloc] initWithItems:@[ pageUrl ]];
  NSWindow* cocoaMru = nil;
  zen::GetNativeWindowPointerFromDOMWindow(aWindow, &cocoaMru);
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
