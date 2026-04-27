/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "ZenGlobalShortcuts.h"

#include "mozilla/TextEvents.h"
#include "nsReadableUtils.h"
#include "nsString.h"

#import <Carbon/Carbon.h>

namespace zen {
namespace {

using mozilla::CodeNameIndex;
using mozilla::WidgetKeyboardEvent;

constexpr FourCharCode kZenHotKeySignature = 'zen ';

// Mozilla-internal aliases referenced by NativeKeyToDOMCodeName.inc but
// not part of Carbon. Mirrors widget/cocoa/TextInputHandler.h so we
// don't need to drag the whole header in.
enum {
  kVK_PC_ContextMenu = 0x6E,
  kVK_Powerbook_KeypadEnter = 0x34,
};

class MacGlobalShortcuts final {
 public:
  MacGlobalShortcuts() = delete;

  static nsresult Register(ZenGlobalShortcuts::Registration& aReg,
                           const nsACString& aKey, uint32_t aModifiers);
  static void Unregister(ZenGlobalShortcuts::Registration& aReg);
  static void Shutdown();

 private:
  static bool EnsureHandler();
  static OSStatus HandleHotKey(EventHandlerCallRef, EventRef, void*);
  static bool ResolveKey(const nsACString& aKey, UInt32& aOut);
  static UInt32 ToCarbonModifiers(uint32_t aMods);

  static EventHandlerUPP sUPP;
  static EventHandlerRef sHandler;
};

EventHandlerUPP MacGlobalShortcuts::sUPP = nullptr;
EventHandlerRef MacGlobalShortcuts::sHandler = nullptr;

// static
OSStatus MacGlobalShortcuts::HandleHotKey(EventHandlerCallRef, EventRef inEvent,
                                          void*) {
  EventHotKeyID hkID;
  if (GetEventParameter(inEvent, kEventParamDirectObject, typeEventHotKeyID,
                        nullptr, sizeof(hkID), nullptr, &hkID) == noErr) {
    ZenGlobalShortcuts::OnNativeShortcut(hkID.id);
  }
  return noErr;
}

// static
bool MacGlobalShortcuts::EnsureHandler() {
  if (sHandler) return true;

  sUPP = NewEventHandlerUPP(HandleHotKey);
  if (!sUPP) return false;

  EventTypeSpec spec = {kEventClassKeyboard, kEventHotKeyPressed};
  OSStatus status =
      InstallApplicationEventHandler(sUPP, 1, &spec, nullptr, &sHandler);
  if (status != noErr) {
    DisposeEventHandlerUPP(sUPP);
    sUPP = nullptr;
    sHandler = nullptr;
    return false;
  }
  return true;
}

// Convert the JS-friendly key string into a DOM code-name (e.g. "A" ->
// "KeyA", "5" -> "Digit5", "F1"/"f1" -> "F1", "Space"/"space" -> "Space").
// Returns false for inputs we don't accept.
static bool ToDOMCodeName(const nsACString& aKey, nsAString& aOut) {
  aOut.Truncate();
  if (aKey.Length() == 1) {
    char c = aKey[0];
    if (c >= 'a' && c <= 'z') c = char(c - 32);
    if (c >= 'A' && c <= 'Z') {
      aOut.AssignLiteral(u"Key");
    } else if (c >= '0' && c <= '9') {
      aOut.AssignLiteral(u"Digit");
    } else {
      return false;
    }
    aOut.Append(char16_t(c));
    return true;
  }
  // Multi-character: assume it's a DOM code name, normalized to leading
  // upper-case ("space" -> "Space", "f1" -> "F1").
  AppendUTF8toUTF16(aKey, aOut);
  if (!aOut.IsEmpty() && aOut[0] >= 'a' && aOut[0] <= 'z') {
    aOut.BeginWriting()[0] = char16_t(aOut[0] - 32);
  }
  return true;
}

struct CodeIndexToMacKey {
  CodeNameIndex idx;
  UInt32 keyCode;
};

// Generated from widget's mapping table. Order matches the .inc, so when
// multiple native keys map to the same DOM code (e.g. NumpadEnter ->
// kVK_ANSI_KeypadEnter and kVK_Powerbook_KeypadEnter), the first entry
// wins -- which is the one we'd want to pass to RegisterEventHotKey.
static constexpr CodeIndexToMacKey kCodeIndexToMacKeyTable[] = {
#define NS_NATIVE_KEY_TO_DOM_CODE_NAME_INDEX(aNativeKey, aCodeNameIndex) \
  {mozilla::aCodeNameIndex, static_cast<UInt32>(aNativeKey)},
#include "NativeKeyToDOMCodeName.inc"
#undef NS_NATIVE_KEY_TO_DOM_CODE_NAME_INDEX
};

// static
bool MacGlobalShortcuts::ResolveKey(const nsACString& aKey, UInt32& aOut) {
  nsAutoString domCode;
  if (!ToDOMCodeName(aKey, domCode)) return false;

  CodeNameIndex idx = WidgetKeyboardEvent::GetCodeNameIndex(domCode);
  if (idx == mozilla::CODE_NAME_INDEX_USE_STRING) return false;

  for (const auto& entry : kCodeIndexToMacKeyTable) {
    if (entry.idx == idx) {
      aOut = entry.keyCode;
      return true;
    }
  }
  return false;
}

// static
UInt32 MacGlobalShortcuts::ToCarbonModifiers(uint32_t aMods) {
  UInt32 m = 0;
  if (aMods & nsIZenGlobalShortcuts::MODIFIER_SHIFT) m |= shiftKey;
  if (aMods & nsIZenGlobalShortcuts::MODIFIER_CTRL) m |= controlKey;
  if (aMods & nsIZenGlobalShortcuts::MODIFIER_ALT) m |= optionKey;
  if (aMods & nsIZenGlobalShortcuts::MODIFIER_META) m |= cmdKey;
  return m;
}

// static
nsresult MacGlobalShortcuts::Register(ZenGlobalShortcuts::Registration& aReg,
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
void MacGlobalShortcuts::Unregister(ZenGlobalShortcuts::Registration& aReg) {
  if (!aReg.nativeHandle) return;
  UnregisterEventHotKey(static_cast<EventHotKeyRef>(aReg.nativeHandle));
  aReg.nativeHandle = nullptr;
}

// static
void MacGlobalShortcuts::Shutdown() {
  if (sHandler) {
    RemoveEventHandler(sHandler);
    sHandler = nullptr;
  }
  if (sUPP) {
    DisposeEventHandlerUPP(sUPP);
    sUPP = nullptr;
  }
}

}  // namespace

// static
nsresult ZenGlobalShortcuts::NativeRegister(Registration& aReg,
                                            const nsACString& aKey,
                                            uint32_t aModifiers) {
  return MacGlobalShortcuts::Register(aReg, aKey, aModifiers);
}

// static
void ZenGlobalShortcuts::NativeUnregister(Registration& aReg) {
  MacGlobalShortcuts::Unregister(aReg);
}

// static
void ZenGlobalShortcuts::NativeShutdown() { MacGlobalShortcuts::Shutdown(); }

}  // namespace zen
