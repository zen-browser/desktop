/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_ZenBoostsBackend_h__
#define mozilla_ZenBoostsBackend_h__

#include "nsColor.h"
#include "nsPresContext.h"
#include "nsIZenBoostsBackend.h"

#include "mozilla/RefPtr.h"

#define ZEN_BOOSTS_BACKEND_CONTRACTID "@mozilla.org/zen/boosts-backend;1"

using ZenBoostData = nscolor;  // For now, Zen boosts data is just a color.

namespace zen {

class nsZenBoostsBackend final : public nsIZenBoostsBackend {
  NS_DECL_ISUPPORTS

 public:
  explicit nsZenBoostsBackend();

  /**
   * Indicates whether the current frame being rendered is for anonymous
   * content.
   */
  bool mCurrentFrameIsAnonymousContent = false;

  /**
   * @brief Resolve a StyleAbsoluteColor to take into account Zen boosts.
   * @param aColor The color to resolve.
   * @return The resolved color with Zen boost filters applied, or the original
   * color if no boost is active.
   * @see StyleColor::ResolveColor for reference.
   */
  static auto ResolveStyleColor(mozilla::StyleAbsoluteColor aColor)
      -> mozilla::StyleAbsoluteColor;

  /**
   * @brief Filter a color based on the current Zen boost settings.
   * @param aColor The color to filter.
   * @param aPresContext The presentation context to use for filtering.
   * @return The filtered color.
   */
  static auto FilterColorFromPresContext(nscolor aColor, 
      nsPresContext* aPresContext = nullptr) -> nscolor;

  /**
   * @brief Called when a presshell is entered during rendering.
   * @param aPresContext The presentation context that was entered.
   */
  auto onPresShellEntered(mozilla::dom::Document* aDocument) -> void;

  [[nodiscard]]
  inline auto GetCurrentBrowsingContext() const {
    return mCurrentBrowsingContext;
  }

  NS_DECL_NSIZENBOOSTSBACKEND
 private:
  ~nsZenBoostsBackend() = default;

  /**
   * The presshell of the current document being rendered.
   */
  RefPtr<mozilla::dom::BrowsingContext> mCurrentBrowsingContext;

 public:
  /**
   * @brief Get the singleton instance of the ZenBoostsBackend.
   * @return The singleton instance.
   */
  static auto GetInstance() -> nsCOMPtr<nsZenBoostsBackend>;
};

}  // namespace zen

#endif
