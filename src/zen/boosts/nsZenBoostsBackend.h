/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_ZenBoostsBackend_h_
#define mozilla_ZenBoostsBackend_h_

#include "nsColor.h"
#include "nsISupportsImpl.h"
#include "nsPresContext.h"

#include "mozilla/RefPtr.h"
#include "mozilla/AlreadyAddRefed.h"

#include <cstdint>

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

namespace detail {
// Pure color-math primitives, exposed for unit testing. These have no
// dependency on the singleton, the BrowsingContext, or the process type, so
// they can be exercised directly from gtest.
nsZenAccentOklab PrecomputeAccent(nscolor aAccentColor);
nsZenAccentOklab RotateAccent(const nsZenAccentOklab& aBase,
                              float aRotationDeg);
nscolor FilterColorChannel(nscolor aOriginalColor,
                           const nsZenAccentOklab& aAccent,
                           const nsZenAccentOklab& aComplementary);
nscolor InvertColorChannel(nscolor aColor);
}  // namespace detail

class nsZenBoostsBackend final : public nsISupports {
 public:
  NS_DECL_ISUPPORTS

  explicit nsZenBoostsBackend() = default;

  /**
   * Indicates whether the current frame being rendered is for anonymous
   * content.
   */
  bool mCurrentFrameIsAnonymousContent = false;

  /**
   * @brief Resolve a color to take into account Zen boosts. This is the single
   * place style colors are filtered; it is reached for every style color via
   * StyleAbsoluteColor::ToColor. Do not add a second StyleColor::ResolveColor
   * filter on top of this or colors get filtered multiple times (which also
   * makes resting colors disagree with composited transition endpoints).
   * @param aColor The color to resolve.
   * @return The resolved color with Zen boost filters applied, or the original
   * color if no boost is active.
   * @see StyleAbsoluteColor::ToColor for reference.
   */
  static auto ResolveStyleColor(nscolor aColor) -> nscolor;

  /**
   * @brief Filter a color based on the current Zen boost settings.
   * @param aColor The color to filter.
   * @param aPresContext The presentation context to use for filtering.
   * @return The filtered color.
   */
  static auto FilterColorFromPresContext(nscolor aColor,
                                         nsPresContext* aPresContext = nullptr)
      -> nscolor;

  /**
   * @brief Called when a presshell is entered during rendering.
   * @param aDocument The document associated with the presshell being entered.
   */
  auto onPresShellEntered(mozilla::dom::Document* aDocument) -> void;

  /**
   * @brief Refresh the cached boost state from the current top BrowsingContext.
   * Called from onPresShellEntered and from BrowsingContext::DidSet hooks when
   * the underlying boost fields change.
   */
  auto RefreshCachedBoostState() -> void;

  /**
   * Resolves the current top BrowsingContext from its stored id. May return
   * null if it has since been discarded. Not on the per-color hot path; the
   * hot path uses the mCachedCurrent* fields instead.
   */
  [[nodiscard]] already_AddRefed<mozilla::dom::BrowsingContext>
  GetCurrentBrowsingContext() const;

  /**
   * Cached boost data for the current top BrowsingContext, refreshed on
   * presshell entry and on DidSet hooks. Read by the per-color hot path so
   * that boost-off pages don't pay for a BrowsingContext walk on every color
   * resolve.
   */
  ZenBoostData mCachedCurrentAccent = 0;
  // Hue rotation in degrees applied to the base accent to derive the
  // complementary accent. Zero means the complementary accent equals the base
  // accent (the duotone collapses to a single-accent tint).
  float mCachedCurrentComplementaryRotation = 0.0f;
  bool mCachedCurrentInverted = false;

 private:
  ~nsZenBoostsBackend() = default;

  /**
   * Id of the top BrowsingContext of the current document being rendered.
   * Stored as an id rather than a strong RefPtr so the process-wide singleton
   * does not keep a navigated-away BrowsingContext (and its subtree) alive
   * until the next presshell entry.
   */
  uint64_t mCurrentBrowsingContextId = 0;

 public:
  /**
   * @brief Get the singleton instance of the ZenBoostsBackend.
   * @return The singleton instance.
   */
  static auto GetInstance() -> nsZenBoostsBackend*;
};

}  // namespace zen

#endif
