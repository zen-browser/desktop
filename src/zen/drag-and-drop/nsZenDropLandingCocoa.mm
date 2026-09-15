/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#import <Cocoa/Cocoa.h>

#include "nsCocoaUtils.h"
#include "nsObjCExceptions.h"
#include "nsZenDragAndDrop.h"

namespace zen {

void PrepareDropLanding(id<NSDraggingInfo> aInfo) {
  NS_OBJC_BEGIN_TRY_IGNORE_BLOCK;

  auto zen = nsZenDragAndDrop::GetZenDragAndDropInstance();
  aInfo.animatesToDestination = zen && zen->DropLandingArmed();

  NS_OBJC_END_TRY_IGNORE_BLOCK;
}

void LandDrop(id<NSDraggingInfo> aInfo) {
  NS_OBJC_BEGIN_TRY_IGNORE_BLOCK;

  auto zen = nsZenDragAndDrop::GetZenDragAndDropInstance();
  if (!zen) {
    return;
  }
  NSMutableArray* targets = [NSMutableArray array];
  for (const auto& landing : zen->TakeDropLandingRects()) {
    [targets
        addObject:[NSValue valueWithRect:nsCocoaUtils::GeckoRectToCocoaRect(
                                             landing)]];
  }
  if (!targets.count) {
    return;
  }
  [aInfo enumerateDraggingItemsWithOptions:NSDraggingItemEnumerationConcurrent
      forView:nil
      classes:@[ [NSPasteboardItem class] ]
      searchOptions:@{}
      usingBlock:^(NSDraggingItem* item, NSInteger idx, BOOL* stop) {
        NSRect target =
            [targets[MIN((NSUInteger)idx, targets.count - 1)] rectValue];
        NSRect frame = item.draggingFrame;
        frame.origin.x = target.origin.x;
        frame.origin.y = NSMaxY(target) - frame.size.height;
        item.draggingFrame = frame;
      }];

  NS_OBJC_END_TRY_IGNORE_BLOCK;
}

}  // namespace zen
