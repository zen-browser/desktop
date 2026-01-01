/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_ZenDragAndDrop_h__
#define mozilla_ZenDragAndDrop_h__

#include "nsIZenDragAndDrop.h"
#include "nsCOMPtr.h"

#define ZEN_BOOSTS_BACKEND_CONTRACTID "@mozilla.org/zen/drag-and-drop;1"

namespace zen {

/**
 * @brief Implementation of the nsIZenDragAndDrop interface.
 * When we want to do a drag and drop operation, web standards
 * don't really allow much customization of the drag image.
 * This class allows Zen to have more control over the drag
 * and drop operations for the tabs.
 */
class nsZenDragAndDrop final : public nsIZenDragAndDrop {
  NS_DECL_ISUPPORTS
  NS_DECL_NSIZENDRAGANDDROP

 public:
  explicit nsZenDragAndDrop();
  auto GetDragImageOpacity() const { return mDragImageOpacity; }

  /**
   * @brief Get the singleton instance of nsZenDragAndDrop. There may be occasions
   * where it won't be available (e.g. on the content process), so this may return
   * nullptr.
   * @return nsZenDragAndDrop* The singleton instance, or nullptr if not available
   */
  static auto GetZenDragAndDropInstance() -> nsCOMPtr<nsZenDragAndDrop>;

 private:
  ~nsZenDragAndDrop() = default;
  float mDragImageOpacity{};
};

} // namespace zen

#endif
