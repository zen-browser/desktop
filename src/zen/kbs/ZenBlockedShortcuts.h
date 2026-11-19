/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_ZenBlockedShortcuts_h_
#define mozilla_ZenBlockedShortcuts_h_

#include "mozilla/AlreadyAddRefed.h"
#include "mozilla/Attributes.h"
#include "mozilla/EventForwards.h"

namespace mozilla {
class GlobalKeyListener;
class KeyEventHandler;
namespace dom {
class Element;
class KeyboardEvent;
}  // namespace dom
}  // namespace mozilla

namespace zen {

/**
 * @brief Lets the browser's shortcuts get past pages that take them over.
 */
class ZenBlockedShortcuts final {
 public:
  /**
   * @brief Called by a GlobalKeyListener for every key event whose default
   *   was prevented before the listener could run its handlers.
   *
   *   Only reply events from a remote page that called preventDefault()
   *   are acted on.
   */
  MOZ_CAN_RUN_SCRIPT static void OnKeyEventPreventedByContent(
      mozilla::GlobalKeyListener* aListener,
      mozilla::dom::KeyboardEvent* aKeyEvent);

  /**
   * @brief Called by BrowserParent for a reply event that the remote process
   *   did not dispatch, which the parent drops.
   *
   * @param aFrameElement The <browser> the event was sent to.
   * @param aEvent        The reply, as received.
   */
  MOZ_CAN_RUN_SCRIPT static void OnKeyPressSuppressedByContent(
      mozilla::dom::Element* aFrameElement,
      const mozilla::WidgetKeyboardEvent& aEvent);

  /**
   * @returns Whether the user prefers Zen for aHandler's <key>, so that
   *   GlobalKeyListener reserves it as if it had reserved="true".
   */
  static bool IsPreferredByZen(mozilla::KeyEventHandler* aHandler);

 private:
  ZenBlockedShortcuts() = delete;

  static bool IsOverridable(const mozilla::WidgetKeyboardEvent& aEvent);

  /**
   * @returns The <key> of aListener that aKeyEvent would have run, if it
   *   could run it.
   */
  MOZ_CAN_RUN_SCRIPT static already_AddRefed<mozilla::dom::Element> FindKey(
      mozilla::GlobalKeyListener* aListener,
      mozilla::dom::KeyboardEvent* aKeyEvent);
};

}  // namespace zen

#endif  // mozilla_ZenBlockedShortcuts_h_
