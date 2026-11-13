/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_ZenMouseTrackerInternal_h_
#define mozilla_ZenMouseTrackerInternal_h_

#include "nscore.h"

class nsIWidget;

// On Linux there's no reliable way to observe the global pointer (Wayland
// doesn't expose it at all), so we don't track there and callers fall back
// to their timeout based behavior
#if defined(XP_MACOSX) || defined(XP_WIN)
#  define NS_ZEN_CAN_TRACK_POINTER 1
#endif

namespace zen {

/**
 * @brief Platform backend that delivers global pointer movements to
 *   ZenMouseTracker::OnNativePointerMove, including movements outside of any
 *   of our windows.
 */
class ZenNativeMouseMonitor final {
 public:
#ifdef NS_ZEN_CAN_TRACK_POINTER
  /**
   * @brief Start delivering pointer moves. Safe to call while already
   *   started.
   * @throws NS_ERROR_NOT_AVAILABLE when the platform cannot observe the
   *   global pointer (e.g. on Linux).
   */
  static nsresult Start();
  /**
   * @brief Stop delivering pointer moves. Safe to call while stopped.
   */
  static void Stop();
#else
  static nsresult Start() { return NS_ERROR_NOT_AVAILABLE; }
  static void Stop() {}
#endif

#ifdef XP_WIN
  /**
   * @brief Whether the screen point (device pixels) belongs to another window
   *   that draws nothing there, i.e. lies on its invisible border.
   */
  static bool IsCoveredByForeignBorder(nsIWidget* aWidget, int32_t aX,
                                       int32_t aY);
  // In device pixels; false when the cursor position can't be read
  static bool GetCursorPosition(int32_t* aX, int32_t* aY);
#else
  static bool IsCoveredByForeignBorder(nsIWidget*, int32_t, int32_t) {
    return false;
  }
#endif

  ZenNativeMouseMonitor() = delete;
};

}  // namespace zen

#endif
