/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "ZenGlobalShortcuts.h"

#include "nsString.h"

#include <windows.h>

namespace zen {
namespace {

constexpr wchar_t kWindowClassName[] = L"ZenGlobalShortcutsWindow";

HWND gMessageWindow = nullptr;
ATOM gWindowClass = 0;

LRESULT CALLBACK WndProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
  if (msg == WM_HOTKEY) {
    ZenGlobalShortcuts::OnNativeShortcut(static_cast<uint32_t>(wParam));
    return 0;
  }
  return DefWindowProcW(hwnd, msg, wParam, lParam);
}

bool EnsureWindow() {
  if (gMessageWindow) return true;

  HINSTANCE module = GetModuleHandleW(nullptr);
  if (!gWindowClass) {
    WNDCLASSEXW wc = {};
    wc.cbSize = sizeof(wc);
    wc.lpfnWndProc = WndProc;
    wc.hInstance = module;
    wc.lpszClassName = kWindowClassName;
    gWindowClass = RegisterClassExW(&wc);
    if (!gWindowClass) return false;
  }

  gMessageWindow = CreateWindowExW(0, kWindowClassName, L"", 0, 0, 0, 0, 0,
                                    HWND_MESSAGE, nullptr, module, nullptr);
  return gMessageWindow != nullptr;
}

bool ResolveKey(const nsACString& aKey, UINT& aOut) {
  if (aKey.Length() == 1) {
    char c = aKey[0];
    if (c >= 'a' && c <= 'z') c = char(c - 32);
    if ((c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')) {
      aOut = static_cast<UINT>(c);
      return true;
    }
    return false;
  }
  if (aKey.LowerCaseEqualsLiteral("space")) { aOut = VK_SPACE; return true; }
  if ((aKey.Length() == 2 || aKey.Length() == 3) &&
      (aKey[0] == 'F' || aKey[0] == 'f')) {
    int n = aKey[1] - '0';
    if (n < 0 || n > 9) return false;
    if (aKey.Length() == 3) {
      int d = aKey[2] - '0';
      if (d < 0 || d > 9) return false;
      n = n * 10 + d;
    }
    if (n >= 1 && n <= 12) {
      aOut = VK_F1 + (n - 1);
      return true;
    }
  }
  return false;
}

UINT ToWinModifiers(uint32_t aMods) {
  UINT m = MOD_NOREPEAT;
  if (aMods & nsIZenGlobalShortcuts::MODIFIER_SHIFT) m |= MOD_SHIFT;
  if (aMods & nsIZenGlobalShortcuts::MODIFIER_CTRL)  m |= MOD_CONTROL;
  if (aMods & nsIZenGlobalShortcuts::MODIFIER_ALT)   m |= MOD_ALT;
  if (aMods & nsIZenGlobalShortcuts::MODIFIER_META)  m |= MOD_WIN;
  return m;
}

}  // namespace

// static
nsresult ZenGlobalShortcuts::NativeRegister(Registration& aReg,
                                            const nsACString& aKey,
                                            uint32_t aModifiers) {
  if (!EnsureWindow()) return NS_ERROR_FAILURE;

  UINT vk;
  if (!ResolveKey(aKey, vk)) return NS_ERROR_INVALID_ARG;

  if (!RegisterHotKey(gMessageWindow, static_cast<int>(aReg.internalId),
                      ToWinModifiers(aModifiers), vk)) {
    return NS_ERROR_FAILURE;
  }
  aReg.nativeHandle =
      reinterpret_cast<void*>(static_cast<uintptr_t>(aReg.internalId));
  return NS_OK;
}

// static
void ZenGlobalShortcuts::NativeUnregister(Registration& aReg) {
  if (!gMessageWindow || !aReg.nativeHandle) return;
  UnregisterHotKey(gMessageWindow,
                   static_cast<int>(reinterpret_cast<uintptr_t>(
                       aReg.nativeHandle)));
  aReg.nativeHandle = nullptr;
}

// static
void ZenGlobalShortcuts::NativeShutdown() {
  if (gMessageWindow) {
    DestroyWindow(gMessageWindow);
    gMessageWindow = nullptr;
  }
  if (gWindowClass) {
    UnregisterClassW(kWindowClassName, GetModuleHandleW(nullptr));
    gWindowClass = 0;
  }
}

}  // namespace zen
