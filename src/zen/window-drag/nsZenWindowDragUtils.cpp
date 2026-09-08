/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsZenWindowDragUtils.h"

#include "Units.h"
#include "mozilla/PresShell.h"
#include "mozilla/ServoStyleConsts.h"
#include "mozilla/dom/Element.h"
#include "nsContentUtils.h"
#include "nsIContent.h"
#include "nsIFrame.h"

namespace zen {

NS_IMPL_ISUPPORTS(nsZenWindowDragUtils, nsIZenWindowDragUtils)

NS_IMETHODIMP
nsZenWindowDragUtils::IsInteractiveContent(nsINode* aNode, bool* aResult) {
  *aResult = false;
  NS_ENSURE_ARG_POINTER(aNode);

  nsIContent* content = nsIContent::FromNode(aNode);
  if (!content) {
    return NS_OK;
  }
  if (content->IsEditable() || nsContentUtils::ContentIsDraggable(content)) {
    *aResult = true;
    return NS_OK;
  }
  mozilla::dom::Element* element = mozilla::dom::Element::FromNode(content);
  *aResult = element && element->IsInteractiveHTMLContent();
  return NS_OK;
}

NS_IMETHODIMP
nsZenWindowDragUtils::IsInteractiveCursor(nsINode* aNode, float aClientX,
                                          float aClientY, bool* aResult) {
  using mozilla::StyleCursorKind;

  *aResult = false;
  NS_ENSURE_ARG_POINTER(aNode);

  nsIContent* content = nsIContent::FromNode(aNode);
  nsIFrame* frame = content ? content->GetPrimaryFrame() : nullptr;
  if (!frame) {
    return NS_OK;
  }
  nsIFrame* rootFrame = frame->PresShell()->GetRootFrame();
  if (!rootFrame) {
    return NS_OK;
  }
  nsPoint point(mozilla::CSSPixel::ToAppUnits(aClientX),
                mozilla::CSSPixel::ToAppUnits(aClientY));
  point -= frame->GetOffsetTo(rootFrame);

  switch (frame->GetCursor(point).mCursor) {
    case StyleCursorKind::Pointer:
    case StyleCursorKind::Cell:
    case StyleCursorKind::Crosshair:
    case StyleCursorKind::Text:
    case StyleCursorKind::VerticalText:
    case StyleCursorKind::Move:
    case StyleCursorKind::Grab:
    case StyleCursorKind::Grabbing:
    case StyleCursorKind::EResize:
    case StyleCursorKind::NResize:
    case StyleCursorKind::NeResize:
    case StyleCursorKind::NwResize:
    case StyleCursorKind::SResize:
    case StyleCursorKind::SeResize:
    case StyleCursorKind::SwResize:
    case StyleCursorKind::WResize:
    case StyleCursorKind::EwResize:
    case StyleCursorKind::NsResize:
    case StyleCursorKind::NeswResize:
    case StyleCursorKind::NwseResize:
    case StyleCursorKind::ColResize:
    case StyleCursorKind::RowResize:
    case StyleCursorKind::AllScroll:
      *aResult = true;
      break;
    default:
      break;
  }
  return NS_OK;
}

}  // namespace zen
