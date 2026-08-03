/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsZenWindowDragUtils.h"

#include "mozilla/dom/Element.h"
#include "nsContentUtils.h"
#include "nsIContent.h"

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

}  // namespace zen
