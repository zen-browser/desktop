/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_ZenDragAndDrop_h_
#define mozilla_ZenDragAndDrop_h_

#include "nsIZenDragAndDrop.h"
#include "nsCOMPtr.h"
#include "Units.h"
#include "nsINode.h"
#include "nsTArray.h"

#if defined(XP_MACOSX) && defined(__OBJC__)
@protocol NSDraggingInfo;
#endif

#define ZEN_DND_MANAGER_CONTRACTID "@mozilla.org/zen/drag-and-drop;1"

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
  auto DropLandingArmed() const { return mDropLandingArmed; }
  const auto& DragImages() const { return mDragImages; }

  /**
   * @brief Take the rects the drag items are to land on after the drop
   * being handled, as the drop added them, in screen CSS pixels and item
   * order. Empty when the drop added none.
   */
  nsTArray<mozilla::DesktopIntRect> TakeDropLandingRects();

  /**
   * @brief Get the singleton instance of nsZenDragAndDrop. There may be
   * occasions where it won't be available (e.g. on the content process), so
   * this may return nullptr.
   * @return nsZenDragAndDrop* The singleton instance, or nullptr if not
   * available
   */
  static auto GetZenDragAndDropInstance() -> nsCOMPtr<nsZenDragAndDrop>;

 private:
  ~nsZenDragAndDrop() = default;
  float mDragImageOpacity{};
  bool mDropLandingArmed{};
  nsTArray<nsCOMPtr<nsINode>> mDragImages;
  nsTArray<mozilla::DesktopIntRect> mDropLandingRects;
};

#if defined(XP_MACOSX) && defined(__OBJC__)
/**
 * @brief From the drag destination view, once a dragover is handled, ask
 * the OS to land the drag image on the drop, if the drag wants that.
 */
void PrepareDropLanding(id<NSDraggingInfo> aInfo);

/**
 * @brief From the drag destination view, once a drop is handled, send the
 * drag image to the rect the drop set, if it set one.
 */
void LandDrop(id<NSDraggingInfo> aInfo);
#endif

}  // namespace zen

#endif
