/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "ZenGlobalShortcuts.h"

#include "nsString.h"

#include <windows.h>

namespace zen {
namespace {

constexpr wchar_t kWindowClassName[] = L"ZenGlobalShortcutsWindow";

class WinGlobalShortcuts final {
 public:
  WinGlobalShortcuts() = delete;

  static nsresult Register(ZenGlobalShortcuts::Registration& aReg,
                           const nsACString& aKey, uint32_t aModifiers);
  static void Unregister(ZenGlobalShortcuts::Registration& aReg);
  static void Shutdown();

 private:
  static bool EnsureWindow();
  static LRESULT CALLBACK WndProc(HWND, UINT, WPARAM, LPARAM);
  static bool ResolveKey(const nsACString& aKey, UINT& aOut);
  static UINT ToWinModifiers(uint32_t aMods);

  static HWND sWindow;
  static ATOM sClass;
};

HWND WinGlobalShortcuts::sWindow = nullptr;
ATOM WinGlobalShortcuts::sClass = 0;

// static
LRESULT CALLBACK WinGlobalShortcuts::WndProc(HWND hwnd, UINT msg, WPARAM wParam,
                                             LPARAM lParam) {
  if (msg == WM_HOTKEY) {
    ZenGlobalShortcuts::OnNativeShortcut(static_cast<uint32_t>(wParam));
    return 0;
  }
  return DefWindowProcW(hwnd, msg, wParam, lParam);
}

// static
bool WinGlobalShortcuts::EnsureWindow() {
  if (sWindow) return true;

  HINSTANCE module = GetModuleHandleW(nullptr);
  if (!sClass) {
    WNDCLASSEXW wc = {};
    wc.cbSize = sizeof(wc);
    wc.lpfnWndProc = WndProc;
    wc.hInstance = module;
    wc.lpszClassName = kWindowClassName;
    sClass = RegisterClassExW(&wc);
    if (!sClass) return false;
  }

  sWindow = CreateWindowExW(0, kWindowClassName, L"", 0, 0, 0, 0, 0,
                            HWND_MESSAGE, nullptr, module, nullptr);
  return sWindow != nullptr;
}

// static
bool WinGlobalShortcuts::ResolveKey(const nsACString& aKey, UINT& aOut) {
  if (aKey.Length() == 1) {
    char c = aKey[0];
    if (c >= 'a' && c <= 'z') c = char(c - 32);
    if ((c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')) {
      aOut = static_cast<UINT>(c);
      return true;
    }
    return false;
  }
  if (aKey.LowerCaseEqualsLiteral("space")) {
    aOut = VK_SPACE;
    return true;
  }
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

// static
UINT WinGlobalShortcuts::ToWinModifiers(uint32_t aMods) {
  UINT m = MOD_NOREPEAT;
  if (aMods & nsIZenGlobalShortcuts::MODIFIER_SHIFT) m |= MOD_SHIFT;
  if (aMods & nsIZenGlobalShortcuts::MODIFIER_CTRL) m |= MOD_CONTROL;
  if (aMods & nsIZenGlobalShortcuts::MODIFIER_ALT) m |= MOD_ALT;
  if (aMods & nsIZenGlobalShortcuts::MODIFIER_META) m |= MOD_WIN;
  return m;
}

// static
nsresult WinGlobalShortcuts::Register(ZenGlobalShortcuts::Registration& aReg,
                                      const nsACString& aKey,
                                      uint32_t aModifiers) {
  if (!EnsureWindow()) return NS_ERROR_FAILURE;

  UINT vk;
  if (!ResolveKey(aKey, vk)) return NS_ERROR_INVALID_ARG;

  if (!RegisterHotKey(sWindow, static_cast<int>(aReg.internalId),
                      ToWinModifiers(aModifiers), vk)) {
    return NS_ERROR_FAILURE;
  }
  aReg.nativeHandle =
      reinterpret_cast<void*>(static_cast<uintptr_t>(aReg.internalId));
  return NS_OK;
}

// static
void WinGlobalShortcuts::Unregister(ZenGlobalShortcuts::Registration& aReg) {
  if (!sWindow || !aReg.nativeHandle) return;
  UnregisterHotKey(
      sWindow,
      static_cast<int>(reinterpret_cast<uintptr_t>(aReg.nativeHandle)));
  aReg.nativeHandle = nullptr;
}

// static
void WinGlobalShortcuts::Shutdown() {
  if (sWindow) {
    DestroyWindow(sWindow);
    sWindow = nullptr;
  }
  if (sClass) {
    UnregisterClassW(kWindowClassName, GetModuleHandleW(nullptr));
    sClass = 0;
  }
}

}  // namespace

// static
nsresult ZenGlobalShortcuts::NativeRegister(Registration& aReg,
                                            const nsACString& aKey,
                                            uint32_t aModifiers) {
  return WinGlobalShortcuts::Register(aReg, aKey, aModifiers);
}

// static
void ZenGlobalShortcuts::NativeUnregister(Registration& aReg) {
  WinGlobalShortcuts::Unregister(aReg);
}

// static
void ZenGlobalShortcuts::NativeShutdown() { WinGlobalShortcuts::Shutdown(); }

}  // namespace zen
