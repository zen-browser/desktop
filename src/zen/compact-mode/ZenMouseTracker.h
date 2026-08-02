/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_ZenMouseTracker_h_
#define mozilla_ZenMouseTracker_h_

#include "nsIZenMouseTracker.h"

#include "mozilla/Maybe.h"
#include "nsIObserver.h"
#include "nsCOMPtr.h"
#include "nsPIDOMWindow.h"
#include "nsTArray.h"
#include "Units.h"

class nsIWidget;

// Fired with the tracked window as subject once the pointer breaks the
// tracking conditions; tracking for that window has already stopped.
#define ZEN_MOUSE_TRACKER_EXITED_TOPIC "zen-mouse-tracker:exited"

namespace zen {

/**
 * @brief Watches the global OS pointer position for registered windows and
 *   notifies observers once the pointer moves too far away from the window
 *   edge it left through.
 */
class ZenMouseTracker final : public nsIZenMouseTracker, public nsIObserver {
 public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIZENMOUSETRACKER
  NS_DECL_NSIOBSERVER

  ZenMouseTracker();

  /**
   * @brief Called by the platform backends whenever the OS pointer moves.
   * @param aPoint The pointer position in desktop pixels, relative to the
   *   origin of the (primary) screen. May be called outside of a clean event
   *   loop iteration (e.g. from a low level hook), evaluation is coalesced
   *   onto the main thread.
   */
  static void OnNativePointerMove(const mozilla::DesktopPoint& aPoint);

 private:
  ~ZenMouseTracker();

  enum class TrackedEdge : uint8_t { Left, Right, Top, Bottom };

  struct TrackedWindow {
    nsCOMPtr<nsPIDOMWindowOuter> mWindow;
    TrackedEdge mEdge;
    float mMaxEdgeOffset;  // In CSS pixels
  };

  static mozilla::Maybe<TrackedEdge> ParseEdge(const nsACString& aScreenEdge);

  /**
   * @brief Check every tracked window against the given pointer position and
   *   notify + stop tracking the ones the pointer moved too far away from.
   */
  void Evaluate(const mozilla::DesktopPoint& aPoint);

  /**
   * @brief Whether the pointer is still allowed to keep the window's edge
   *   element open, given the window's bounds on screen.
   */
  static bool IsPointerWithinBounds(const TrackedWindow& aTracked,
                                    const mozilla::DesktopPoint& aPoint,
                                    nsIWidget* aWidget);

  void StopTrackingWindow(nsPIDOMWindowOuter* aWindow);

  /**
   * @brief Tear down the native monitor and our observers once the last
   *   tracked window is gone, so the service is fully idle while nothing is
   *   being tracked.
   */
  void OnTrackedListChanged();

  void AddObservers();
  void RemoveObservers();

  nsTArray<TrackedWindow> mTracked;
  bool mObserving = false;
};

}  // namespace zen

#endif
