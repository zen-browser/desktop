/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_nsZenCommonUtils_h__
#define mozilla_nsZenCommonUtils_h__

#include "nsIZenCommonUtils.h"

#include "nsIDOMWindow.h"
#include "nsGlobalWindowOuter.h"
#include "nsIURI.h"

namespace zen {

/**
 * @brief Common utility functions for Zen.
 */
class ZenCommonUtils final : public nsIZenCommonUtils {
  NS_DECL_ISUPPORTS
  NS_DECL_NSIZENCOMMONUTILS

 public:
  explicit ZenCommonUtils() = default;

 private:
  ~ZenCommonUtils() = default;
  /**
   * @brief Check if the current context can share data.
   * @param data The data to share.
   * @returns True if the current context can share data, false otherwise.
   */
  static auto IsSharingSupported() -> bool;
  /**
   * @brief Helper function to share data via the native dialogs.
   * @param aWindow The window to use for the share dialog.
   * @param url The URL to share.
   * @param title The title of the share.
   * @param text The text to share.
   * @returns A promise that resolves when the share is complete.
   */
  static auto ShareInternal(nsCOMPtr<mozIDOMWindowProxy>& aWindow, nsIURI* url,
      const nsACString& title, const nsACString& text, uint32_t aX, uint32_t aY,
      uint32_t aWidth, uint32_t aHeight)
    -> nsresult;
  /**
   * @brief Helper function to play haptic feedback.
   */
#if !defined(XP_MACOSX)
  static auto PlayHapticFeedbackInternal() -> nsresult {
    // No-op on non-macOS platforms
    return NS_OK;
  }
#else
  static auto PlayHapticFeedbackInternal() -> nsresult;
#endif
};

} // namespace zen

#endif
