/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "ZenGlobalShortcuts.h"

#include "TextInputHandler.h"
#include "mozilla/EventForwards.h"

#import <Carbon/Carbon.h>
#import <Cocoa/Cocoa.h>

namespace zen {

static const OSType kHotKeySignature = 'ZenG';

static EventHandlerRef sEventHandler = nullptr;

/**
 * @brief Gecko only converts key codes the other way, from the one a key
 *   event has to the DOM one, which is how it decides that a <key> was
 *   pressed. The key to register is the one that conversion gives aKeyCode
 *   for on the current keyboard layout.
 * @returns The virtual key code of that key, or -1 if the layout has none.
 */
static int32_t VirtualKeyCodeFor(uint32_t aKeyCode, bool aCmdIsPressed) {
  static const UInt32 kVirtualKeyCodeCount = 0x80;
  mozilla::widget::TISInputSourceWrapper& inputSource =
      mozilla::widget::TISInputSourceWrapper::CurrentInputSource();
  UInt32 keyboardType = ::LMGetKbdType();
  for (UInt32 nativeKeyCode = 0; nativeKeyCode < kVirtualKeyCodeCount;
       nativeKeyCode++) {
    if (inputSource.ComputeGeckoKeyCode(nativeKeyCode, keyboardType,
                                        aCmdIsPressed) == aKeyCode) {
      return static_cast<int32_t>(nativeKeyCode);
    }
  }
  return -1;
}

static OSStatus HandleHotKey(EventHandlerCallRef aCallRef, EventRef aEvent,
                             void* aUserData) {
  EventHotKeyID hotKeyId;
  OSStatus status =
      ::GetEventParameter(aEvent, kEventParamDirectObject, typeEventHotKeyID,
                          nullptr, sizeof(hotKeyId), nullptr, &hotKeyId);
  if (status != noErr || hotKeyId.signature != kHotKeySignature) {
    return eventNotHandledErr;
  }
  ZenGlobalShortcuts::OnHotKey(hotKeyId.id);
  return noErr;
}

static bool EnsureEventHandler() {
  if (sEventHandler) {
    return true;
  }
  static const EventTypeSpec kEventTypes[] = {
      {kEventClassKeyboard, kEventHotKeyPressed}};
  OSStatus status = ::InstallEventHandler(
      ::GetEventDispatcherTarget(), ::NewEventHandlerUPP(HandleHotKey),
      GetEventTypeCount(kEventTypes), kEventTypes, nullptr, &sEventHandler);
  return status == noErr;
}

/* static */
bool ZenGlobalShortcuts::PlatformRegister(uint32_t aHotKeyId, uint32_t aKeyCode,
                                          mozilla::Modifiers aModifiers,
                                          void** aNativeHotKey) {
  int32_t virtualKeyCode =
      VirtualKeyCodeFor(aKeyCode, !!(aModifiers & mozilla::MODIFIER_META));
  if (virtualKeyCode < 0 || !EnsureEventHandler()) {
    return false;
  }
  UInt32 modifiers = 0;
  if (aModifiers & mozilla::MODIFIER_SHIFT) {
    modifiers |= shiftKey;
  }
  if (aModifiers & mozilla::MODIFIER_CONTROL) {
    modifiers |= controlKey;
  }
  if (aModifiers & mozilla::MODIFIER_ALT) {
    modifiers |= optionKey;
  }
  if (aModifiers & mozilla::MODIFIER_META) {
    modifiers |= cmdKey;
  }
  EventHotKeyID hotKeyId = {kHotKeySignature, aHotKeyId};
  EventHotKeyRef hotKey = nullptr;
  OSStatus status =
      ::RegisterEventHotKey(static_cast<UInt32>(virtualKeyCode), modifiers,
                            hotKeyId, ::GetEventDispatcherTarget(), 0, &hotKey);
  if (status != noErr || !hotKey) {
    return false;
  }
  *aNativeHotKey = hotKey;
  return true;
}

/* static */
void ZenGlobalShortcuts::PlatformUnregister(uint32_t aHotKeyId,
                                            void* aNativeHotKey) {
  if (aNativeHotKey) {
    ::UnregisterEventHotKey(static_cast<EventHotKeyRef>(aNativeHotKey));
  }
}

/* static */
void ZenGlobalShortcuts::PlatformWillRunKey() {}

/* static */
void ZenGlobalShortcuts::PlatformShutdown() {
  if (sEventHandler) {
    ::RemoveEventHandler(sEventHandler);
    sEventHandler = nullptr;
  }
}

}  // namespace zen
