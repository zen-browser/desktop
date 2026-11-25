/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_ZenGlobalShortcuts_h_
#define mozilla_ZenGlobalShortcuts_h_

#include <cstdint>

#include "mozilla/Attributes.h"
#include "mozilla/EventForwards.h"

namespace mozilla::dom {
class Element;
}  // namespace mozilla::dom

namespace zen {

/**
 * @brief Makes the <key> elements of chrome documents that carry
 *   global="true" work whichever application has the focus, by registering
 *   them with the system.
 *
 *   Controlled by the zen.keyboard.global-shortcuts.enabled preference.
 *   Only there on macOS and Windows. Main thread only.
 */
class ZenGlobalShortcuts final {
 public:
  /**
   * @param aKeyset A <keyset> that key events are now listened for.
   */
#if defined(XP_MACOSX) || defined(XP_WIN)
  static void AttachKeyset(mozilla::dom::Element* aKeyset);
#else
  static void AttachKeyset(mozilla::dom::Element* aKeyset) {}
#endif
  /**
   * @param aKeyset A <keyset> that key events are no longer listened for.
   */
#if defined(XP_MACOSX) || defined(XP_WIN)
  static void DetachKeyset(mozilla::dom::Element* aKeyset);
#else
  static void DetachKeyset(mozilla::dom::Element* aKeyset) {}
#endif
  /**
   * @param aKeyset A <keyset> whose keys may have changed, so that what the
   *   system has registered follows a shortcut being customized rather than
   *   staying on the combination the key was first read with.
   */
#if defined(XP_MACOSX) || defined(XP_WIN)
  static void RefreshKeyset(mozilla::dom::Element* aKeyset);
#else
  static void RefreshKeyset(mozilla::dom::Element* aKeyset) {}
#endif

  /**
   * @brief Called by the platform code, on the main thread, when a registered
   *   shortcut is pressed. The key runs from a fresh event rather than from
   *   inside the system's event handler.
   * @param aHotKeyId The number the shortcut was registered with.
   */
  static void OnHotKey(uint32_t aHotKeyId);

 private:
  ZenGlobalShortcuts() = delete;

  /**
   * @brief Takes a keyset to have its global keys read once the DOM has
   *   settled, which coalesces the several attribute changes one
   *   customization makes into a single read.
   */
  static void QueueKeyset(mozilla::dom::Element* aKeyset);
  /**
   * @brief Reads the global keys of the keysets reported since the last
   *   time, which by now have their keys.
   */
  static void ReadPendingKeysets();
  /**
   * @brief Makes what is registered with the system match the global keys
   *   that are still in a document, dropping the ones that are not.
   */
  static void Sync();
  MOZ_CAN_RUN_SCRIPT_BOUNDARY static void Fire(uint32_t aHotKeyId);
  static void OnPrefChanged(const char* aPref, void* aData);

  /**
   * @brief Reads what a key should be registered as, the way Firefox reads
   *   it to match key events.
   * @returns Whether the key can be registered. It cannot without a key, or
   *   when it has no modifier but Shift.
   */
  static bool BindingOf(mozilla::dom::Element* aKey, uint32_t* aKeyCode,
                        mozilla::Modifiers* aModifiers);

  /**
   * @param aHotKeyId     A number, unique among the registered shortcuts, to
   *   report the shortcut to OnHotKey() with.
   * @param aKeyCode      A KeyboardEvent.DOM_VK_* constant.
   * @param aModifiers    Which of Shift, Control, Alt and Meta go with it.
   * @param aNativeHotKey Set to what PlatformUnregister() needs back.
   * @returns Whether the system took the shortcut. It does not when the key
   *   has no equivalent on the keyboard layout or another application already
   *   owns the combination.
   */
  static bool PlatformRegister(uint32_t aHotKeyId, uint32_t aKeyCode,
                               mozilla::Modifiers aModifiers,
                               void** aNativeHotKey);
  static void PlatformUnregister(uint32_t aHotKeyId, void* aNativeHotKey);
  /**
   * @brief Lets go of what registering shortcuts needed. Every shortcut has
   *   been unregistered by then.
   */
  static void PlatformShutdown();
  /**
   * @brief Called right before a pressed shortcut runs its key, for what the
   *   platform needs so that a window the key opens can come to the front
   *   although another application has the focus. The windows Zen already
   *   has are to stay where they are.
   */
  static void PlatformWillRunKey();
};

}  // namespace zen

#endif
