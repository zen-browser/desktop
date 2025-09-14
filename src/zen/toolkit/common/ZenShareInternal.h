/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_nsZenShareInternal_h__
#define mozilla_nsZenShareInternal_h__

#include "nsIZenCommonUtils.h"

#include "nsIDOMWindow.h"
#include "nsGlobalWindowOuter.h"
#include "nsIURI.h"

#if defined(XP_WIN) || defined(XP_MACOSX)
#define NS_ZEN_CAN_SHARE_NATIVE true

class nsZenNativeShareInternal final {
 public:
  /**
  * @brief Use the native share dialog. This only works on Windows and MacOS
  *   since the native share dialog is not available on other platforms.
  *   Macos does need pointer coordinates to show the share dialog while
  *   Windows does not since it just displays a dialog on the middle of the
  *   screen.
  * @param aWindow The window to use for the share dialog.
  * @param aUrl The URL to share.
  * @param aTitle The title of the share.
  * @param aText The text to share.
  * @returns void
  */
  static auto ShowNativeDialog(nsCOMPtr<mozIDOMWindowProxy>& aWindow, nsIURI* aUrl,
      const nsACString& aTitle, const nsACString& aText, uint32_t aX = 0, uint32_t aY = 0,
      uint32_t aWidth = 0, uint32_t aHeight = 0)
    -> nsresult;

  nsZenNativeShareInternal() = default;
  ~nsZenNativeShareInternal() = default;
};

#endif
#endif
