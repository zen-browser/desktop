/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_ZenBoostsBackend_h__
#define mozilla_ZenBoostsBackend_h__

#include "nsColor.h"
#include "nsPresContext.h"
#include "nsIZenBoostsBackend.h"
#include "ZenBoostsPresContext.h"

#include "mozilla/RefPtr.h"

#define ZEN_BOOSTS_BACKEND_CONTRACTID \
  "@mozilla.org/zen/boosts-backend;1"

namespace zen {

class nsZenBoostsBackend final : public nsIZenBoostsBackend {
  NS_DECL_ISUPPORTS
  NS_DECL_NSIZENBOOSTSBACKEND

 public:
  explicit nsZenBoostsBackend();

  /*
   * @brief Called when the presshell is entered. See nsDisplayListBuilder::EnterPresShell
   * for context.
   */
  auto onPressShellEntered(nsPresContext* aPresContext) -> void;

  /*
   * @brief Called when the presshell is exited.
   */
  auto onPressShellLeave(nsPresContext* aPresContext) -> void;

  /**
   * Recomputes the data dependent on the browsing context, like zoom and text
   * zoom. We use it to store Zen boosts related data too.
   */
  void RecomputeBrowsingContextDependentData(nsPresContext* aPresContext);

  /**
   * @brief Resolve a StyleAbsoluteColor to take into account Zen boosts.
   * @param aColor The color to resolve.
   * @see StyleColor::ResolveColor for reference.
   */
  static auto ResolveStyleColor(mozilla::StyleAbsoluteColor aColor) -> mozilla::StyleAbsoluteColor;

 private:
  ~nsZenBoostsBackend() = default;

  /**
   * The presshell of the current document being rendered.
   */
  RefPtr<nsPresContext> mCurrentPresContext;
};

} // namespace zen

#endif
