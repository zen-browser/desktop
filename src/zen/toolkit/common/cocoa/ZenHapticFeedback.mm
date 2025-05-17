/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "ZenCommonUtils.h"
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

nsresult ZenCommonUtils::PlayHapticFeedbackInternal() {
  NS_OBJC_BEGIN_TRY_BLOCK_RETURN;
  if (@available(macOS 10.14, *)) {
    id<NSHapticFeedbackPerformer> performer = [NSHapticFeedbackManager defaultPerformer];
    [performer performFeedbackPattern:NSHapticFeedbackPatternAlignment
                performanceTime:NSHapticFeedbackPerformanceTimeDefault];
  } else {
    // Fallback on earlier versions
    // Note: This is a no-op on older versions of iOS/macOS
  }
  return NS_OK;
  NS_OBJC_END_TRY_BLOCK_RETURN(NS_OK);
}

}
