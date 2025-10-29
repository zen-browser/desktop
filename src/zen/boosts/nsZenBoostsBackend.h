/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_ZenBoostsBackend_h__
#define mozilla_ZenBoostsBackend_h__

#include "nsIZenBoostsBackend.h"
#include "nsPresContext.h"
#include "mozilla/PresShell.h"

namespace zen {

class nsZenBoostsBackend final : public nsIZenBoostsBackend {
  NS_DECL_ISUPPORTS
  NS_DECL_NSIZENBOOSTSBACKEND

 public:
  explicit nsZenBoostsBackend();

  /*
   * @brief Called when the presshell is entered.
   */
  auto onPressShellEntered(mozilla::PresShell* aPresShell) -> void;

  /*
   * @brief Called when the presshell is exited.
   */
  auto onPressShellExited(mozilla::PresShell* aPresShell) -> void;

 private:
  ~nsZenBoostsBackend() = default;

  /**
   * The presshell of the current document being rendered.
   */
  static nsPresContext* mCurrentPresContext;
};

} // namespace zen

#endif
