/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "ZenGlobalShortcuts.h"

#include "KeyboardLayout.h"
#include "mozilla/EventForwards.h"

#include <windows.h>

namespace zen {

static const wchar_t kWindowClassName[] = L"ZenGlobalShortcutsWindow";

static const uint32_t kMaxHotKeyId = 0xBFFF;

// A window that is never shown, there to receive WM_HOTKEY on the main
// thread.
static HWND sMessageWindow = nullptr;

static LRESULT CALLBACK MessageWindowProc(HWND aWindow, UINT aMessage,
                                          WPARAM aWParam, LPARAM aLParam) {
  if (aMessage == WM_HOTKEY) {
    ZenGlobalShortcuts::OnHotKey(static_cast<uint32_t>(aWParam));
    return 0;
  }
  return ::DefWindowProcW(aWindow, aMessage, aWParam, aLParam);
}

static HWND EnsureMessageWindow() {
  if (sMessageWindow) {
    return sMessageWindow;
  }
  HINSTANCE instance = ::GetModuleHandleW(nullptr);
  WNDCLASSW windowClass = {};
  windowClass.lpfnWndProc = MessageWindowProc;
  windowClass.hInstance = instance;
  windowClass.lpszClassName = kWindowClassName;
  if (!::RegisterClassW(&windowClass) &&
      ::GetLastError() != ERROR_CLASS_ALREADY_EXISTS) {
    return nullptr;
  }
  sMessageWindow = ::CreateWindowExW(0, kWindowClassName, L"", 0, 0, 0, 0, 0,
                                     HWND_MESSAGE, nullptr, instance, nullptr);
  return sMessageWindow;
}

/**
 * @brief Gecko only converts key codes the other way, from the one a key
 *   message has to the DOM one, which is how it decides that a <key> was
 *   pressed. The key to register is the one that conversion gives aKeyCode
 *   for on the loaded keyboard layout.
 * @returns The virtual-key code of that key, or 0 if the layout has none.
 */
static UINT VirtualKeyCodeFor(uint32_t aKeyCode) {
  mozilla::widget::KeyboardLayout* layout =
      mozilla::widget::KeyboardLayout::GetInstance();
  for (UINT virtualKeyCode = 1; virtualKeyCode < 0xFF; virtualKeyCode++) {
    if (layout->ConvertNativeKeyCodeToDOMKeyCode(virtualKeyCode) == aKeyCode) {
      return virtualKeyCode;
    }
  }
  return 0;
}

/* static */
bool ZenGlobalShortcuts::PlatformRegister(uint32_t aHotKeyId, uint32_t aKeyCode,
                                          mozilla::Modifiers aModifiers,
                                          void** aNativeHotKey) {
  UINT virtualKeyCode = VirtualKeyCodeFor(aKeyCode);
  if (!virtualKeyCode || aHotKeyId > kMaxHotKeyId) {
    return false;
  }
  HWND window = EnsureMessageWindow();
  if (!window) {
    return false;
  }
  UINT modifiers = MOD_NOREPEAT;
  if (aModifiers & mozilla::MODIFIER_SHIFT) {
    modifiers |= MOD_SHIFT;
  }
  if (aModifiers & mozilla::MODIFIER_CONTROL) {
    modifiers |= MOD_CONTROL;
  }
  if (aModifiers & mozilla::MODIFIER_ALT) {
    modifiers |= MOD_ALT;
  }
  if (aModifiers & mozilla::MODIFIER_META) {
    modifiers |= MOD_WIN;
  }
  // Windows tells hot keys apart by their number alone.
  *aNativeHotKey = nullptr;
  return !!::RegisterHotKey(window, static_cast<int>(aHotKeyId), modifiers,
                            virtualKeyCode);
}

/* static */
void ZenGlobalShortcuts::PlatformUnregister(uint32_t aHotKeyId,
                                            void* aNativeHotKey) {
  if (sMessageWindow) {
    ::UnregisterHotKey(sMessageWindow, static_cast<int>(aHotKeyId));
  }
}

/* static */
void ZenGlobalShortcuts::PlatformShutdown() {
  if (sMessageWindow) {
    ::DestroyWindow(sMessageWindow);
    sMessageWindow = nullptr;
    ::UnregisterClassW(kWindowClassName, ::GetModuleHandleW(nullptr));
  }
}

}  // namespace zen
