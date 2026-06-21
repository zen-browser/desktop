/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_ZenBoostsBackend_h_
#define mozilla_ZenBoostsBackend_h_

#include "nsColor.h"
#include "nsISupportsImpl.h"
#include "nsPresContext.h"

class nsIFrame;

namespace mozilla::dom {
class BrowsingContext;
}

#define ZEN_BOOSTS_BACKEND_CONTRACTID "@mozilla.org/zen/boosts-backend;1"

using ZenBoostData = nscolor;  // For now, Zen boosts data is just a color.

namespace zen {

struct nsZenAccentOklab {
  nscolor accentNS;
  float accL, accA, accB;
  float contrastFactor;
};

#ifdef ENABLE_TESTS
// Test-only forwarders into the file-local color math and accent cache.
namespace detail {
nsZenAccentOklab PrecomputeAccent(nscolor aAccentColor);
nsZenAccentOklab RotateAccent(const nsZenAccentOklab& aBase,
                              float aRotationDeg);
nscolor FilterColorChannel(nscolor aOriginalColor,
                           const nsZenAccentOklab& aAccent,
                           const nsZenAccentOklab& aComplementary);
nscolor InvertColorChannel(nscolor aColor);

size_t AccentCacheSize();
void ResetAccentCache();
bool IsAccentCached(nscolor aAccentNS, float aRotationDeg);
void EnsureCachedAccent(nscolor aAccentNS, float aRotationDeg);
}  // namespace detail
#endif  // ENABLE_TESTS

class nsZenBoostsBackend final : public nsISupports {
 public:
  NS_DECL_ISUPPORTS

  explicit nsZenBoostsBackend() = default;

  /**
   * @brief Resolve a color to take into account Zen boosts. This is the single
   * place style colors are filtered; it is reached for every style color via
   * StyleAbsoluteColor::ToColor. Do not add a second StyleColor::ResolveColor
   * filter on top of this or colors get filtered multiple times (which also
   * makes resting colors disagree with composited transition endpoints).
   *
   * The boost state is derived from the frame the color is being resolved for:
   * its document's top BrowsingContext carries the accent/inversion data. When
   * @p aFrame is null, or belongs to anonymous content (devtools, screenshots,
   * the boosts overlays themselves), the color is returned unfiltered.
   * @param aColor The color to resolve.
   * @param aFrame The frame the color is being resolved for, or null.
   * @return The resolved color with Zen boost filters applied, or the original
   * color if no boost is active.
   * @see StyleAbsoluteColor::ToColor for reference.
   */
  static auto ResolveStyleColor(nscolor aColor, const nsIFrame* aFrame)
      -> nscolor;

 private:
  ~nsZenBoostsBackend() = default;

 public:
  /**
   * @brief Get the singleton instance of the ZenBoostsBackend.
   * @return The singleton instance.
   */
  static auto GetInstance() -> nsZenBoostsBackend*;
};

}  // namespace zen

#endif
