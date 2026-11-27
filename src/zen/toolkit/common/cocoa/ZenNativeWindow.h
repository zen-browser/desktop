/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_ZenNativeWindow_h_
#define mozilla_ZenNativeWindow_h_

#include "nsPIDOMWindow.h"
#include "WidgetUtils.h"
#include "nsIWidget.h"

#import <AppKit/AppKit.h>

namespace zen {

/**
 * @brief The native window of a DOM window, or nil if it has none.
 */
inline NSWindow* GetNativeWindow(mozIDOMWindowProxy* aWindow) {
  if (!aWindow) {
    return nil;
  }
  nsCOMPtr<nsIWidget> widget = mozilla::widget::WidgetUtils::DOMWindowToWidget(
      nsPIDOMWindowOuter::From(aWindow));
  if (!widget) {
    return nil;
  }
  return (NSWindow*)widget->GetNativeData(NS_NATIVE_WINDOW);
}

}  // namespace zen

#endif
