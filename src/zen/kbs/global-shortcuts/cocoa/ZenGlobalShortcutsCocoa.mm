/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "ZenGlobalShortcuts.h"

#include "nsString.h"

#import <Carbon/Carbon.h>

namespace zen {
namespace {

EventHandlerUPP gEventHandlerUPP = nullptr;
EventHandlerRef gEventHandler = nullptr;
constexpr FourCharCode kZenHotKeySignature = 'zen ';

OSStatus HotKeyHandler(EventHandlerCallRef, EventRef inEvent, void*) {
  EventHotKeyID hkID;
  if (GetEventParameter(inEvent, kEventParamDirectObject, typeEventHotKeyID,
                        nullptr, sizeof(hkID), nullptr, &hkID) == noErr) {
    ZenGlobalShortcuts::OnNativeShortcut(hkID.id);
  }
  return noErr;
}

bool EnsureHandler() {
  if (gEventHandler) return true;
  gEventHandlerUPP = NewEventHandlerUPP(HotKeyHandler);
  if (!gEventHandlerUPP) return false;

  EventTypeSpec spec = {kEventClassKeyboard, kEventHotKeyPressed};
  OSStatus status = InstallApplicationEventHandler(gEventHandlerUPP, 1, &spec,
                                                    nullptr, &gEventHandler);
  if (status != noErr) {
    DisposeEventHandlerUPP(gEventHandlerUPP);
    gEventHandlerUPP = nullptr;
    gEventHandler = nullptr;
    return false;
  }
  return true;
}

bool ResolveKey(const nsACString& aKey, UInt32& aOut) {
  if (aKey.Length() == 1) {
    char c = aKey[0];
    if (c >= 'a' && c <= 'z') c = char(c - 32);
    switch (c) {
      case 'A': aOut = kVK_ANSI_A; return true;
      case 'B': aOut = kVK_ANSI_B; return true;
      case 'C': aOut = kVK_ANSI_C; return true;
      case 'D': aOut = kVK_ANSI_D; return true;
      case 'E': aOut = kVK_ANSI_E; return true;
      case 'F': aOut = kVK_ANSI_F; return true;
      case 'G': aOut = kVK_ANSI_G; return true;
      case 'H': aOut = kVK_ANSI_H; return true;
      case 'I': aOut = kVK_ANSI_I; return true;
      case 'J': aOut = kVK_ANSI_J; return true;
      case 'K': aOut = kVK_ANSI_K; return true;
      case 'L': aOut = kVK_ANSI_L; return true;
      case 'M': aOut = kVK_ANSI_M; return true;
      case 'N': aOut = kVK_ANSI_N; return true;
      case 'O': aOut = kVK_ANSI_O; return true;
      case 'P': aOut = kVK_ANSI_P; return true;
      case 'Q': aOut = kVK_ANSI_Q; return true;
      case 'R': aOut = kVK_ANSI_R; return true;
      case 'S': aOut = kVK_ANSI_S; return true;
      case 'T': aOut = kVK_ANSI_T; return true;
      case 'U': aOut = kVK_ANSI_U; return true;
      case 'V': aOut = kVK_ANSI_V; return true;
      case 'W': aOut = kVK_ANSI_W; return true;
      case 'X': aOut = kVK_ANSI_X; return true;
      case 'Y': aOut = kVK_ANSI_Y; return true;
      case 'Z': aOut = kVK_ANSI_Z; return true;
      case '0': aOut = kVK_ANSI_0; return true;
      case '1': aOut = kVK_ANSI_1; return true;
      case '2': aOut = kVK_ANSI_2; return true;
      case '3': aOut = kVK_ANSI_3; return true;
      case '4': aOut = kVK_ANSI_4; return true;
      case '5': aOut = kVK_ANSI_5; return true;
      case '6': aOut = kVK_ANSI_6; return true;
      case '7': aOut = kVK_ANSI_7; return true;
      case '8': aOut = kVK_ANSI_8; return true;
      case '9': aOut = kVK_ANSI_9; return true;
    }
    return false;
  }
  if (aKey.LowerCaseEqualsLiteral("space")) { aOut = kVK_Space; return true; }
  if (aKey.LowerCaseEqualsLiteral("f1"))  { aOut = kVK_F1;  return true; }
  if (aKey.LowerCaseEqualsLiteral("f2"))  { aOut = kVK_F2;  return true; }
  if (aKey.LowerCaseEqualsLiteral("f3"))  { aOut = kVK_F3;  return true; }
  if (aKey.LowerCaseEqualsLiteral("f4"))  { aOut = kVK_F4;  return true; }
  if (aKey.LowerCaseEqualsLiteral("f5"))  { aOut = kVK_F5;  return true; }
  if (aKey.LowerCaseEqualsLiteral("f6"))  { aOut = kVK_F6;  return true; }
  if (aKey.LowerCaseEqualsLiteral("f7"))  { aOut = kVK_F7;  return true; }
  if (aKey.LowerCaseEqualsLiteral("f8"))  { aOut = kVK_F8;  return true; }
  if (aKey.LowerCaseEqualsLiteral("f9"))  { aOut = kVK_F9;  return true; }
  if (aKey.LowerCaseEqualsLiteral("f10")) { aOut = kVK_F10; return true; }
  if (aKey.LowerCaseEqualsLiteral("f11")) { aOut = kVK_F11; return true; }
  if (aKey.LowerCaseEqualsLiteral("f12")) { aOut = kVK_F12; return true; }
  return false;
}

UInt32 ToCarbonModifiers(uint32_t aMods) {
  UInt32 m = 0;
  if (aMods & nsIZenGlobalShortcuts::MODIFIER_SHIFT) m |= shiftKey;
  if (aMods & nsIZenGlobalShortcuts::MODIFIER_CTRL)  m |= controlKey;
  if (aMods & nsIZenGlobalShortcuts::MODIFIER_ALT)   m |= optionKey;
  if (aMods & nsIZenGlobalShortcuts::MODIFIER_META)  m |= cmdKey;
  return m;
}

}  // namespace

// static
nsresult ZenGlobalShortcuts::NativeRegister(Registration& aReg,
                                            const nsACString& aKey,
                                            uint32_t aModifiers) {
  if (!EnsureHandler()) return NS_ERROR_FAILURE;

  UInt32 keyCode;
  if (!ResolveKey(aKey, keyCode)) return NS_ERROR_INVALID_ARG;

  EventHotKeyID hkID;
  hkID.signature = kZenHotKeySignature;
  hkID.id = aReg.internalId;

  EventHotKeyRef ref = nullptr;
  OSStatus status =
      RegisterEventHotKey(keyCode, ToCarbonModifiers(aModifiers), hkID,
                          GetApplicationEventTarget(), 0, &ref);
  if (status != noErr || !ref) return NS_ERROR_FAILURE;

  aReg.nativeHandle = static_cast<void*>(ref);
  return NS_OK;
}

// static
void ZenGlobalShortcuts::NativeUnregister(Registration& aReg) {
  if (!aReg.nativeHandle) return;
  UnregisterEventHotKey(static_cast<EventHotKeyRef>(aReg.nativeHandle));
  aReg.nativeHandle = nullptr;
}

// static
void ZenGlobalShortcuts::NativeShutdown() {
  if (gEventHandler) {
    RemoveEventHandler(gEventHandler);
    gEventHandler = nullptr;
  }
  if (gEventHandlerUPP) {
    DisposeEventHandlerUPP(gEventHandlerUPP);
    gEventHandlerUPP = nullptr;
  }
}

}  // namespace zen
