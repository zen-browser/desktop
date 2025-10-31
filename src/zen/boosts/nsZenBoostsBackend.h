/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_ZenBoostsBackend_h__
#define mozilla_ZenBoostsBackend_h__

#include "nsColor.h"
#include "nsPresContext.h"
#include "nsIZenBoostsBackend.h"

#include "mozilla/RefPtr.h"

#define ZEN_BOOSTS_BACKEND_CONTRACTID \
  "@mozilla.org/zen/boosts-backend;1"

namespace zen {

class nsZenBoostsBackend final : public nsIZenBoostsBackend {
  NS_DECL_ISUPPORTS

 public:
  explicit nsZenBoostsBackend();

  /**
   * @brief Resolve a StyleAbsoluteColor to take into account Zen boosts.
   * @param aColor The color to resolve.
   * @see StyleColor::ResolveColor for reference.
   */
  static auto ResolveStyleColor(mozilla::StyleAbsoluteColor aColor) -> mozilla::StyleAbsoluteColor;

  // Overrides
  auto onPressShellEntered(nsPresContext* aPresContext) -> void;
  auto onPressShellLeave(nsPresContext* aPresContext) -> void;
  void RecomputeBrowsingContextDependentData(nsPresContext* aPresContext,
                                            mozilla::dom::BrowsingContext* aBrowsingContext);
  NS_DECL_NSIZENBOOSTSBACKEND
 private:
  ~nsZenBoostsBackend() = default;

  /**
   * The presshell of the current document being rendered.
   */
  RefPtr<nsPresContext> mCurrentPresContext;
};

} // namespace zen

#endif
