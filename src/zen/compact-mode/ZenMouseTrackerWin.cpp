/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "ZenMouseTracker.h"
#include "ZenMouseTrackerInternal.h"

#include <windows.h>

namespace zen {

static HHOOK sMouseHook = nullptr;

// Runs on the thread that installed the hook (the main thread). Keep this as
// light as possible: the system silently removes hooks that take too long.
static LRESULT CALLBACK MouseHookProc(int aCode, WPARAM aWParam,
                                      LPARAM aLParam) {
  if (aCode == HC_ACTION && aWParam == WM_MOUSEMOVE) {
    const auto* info = reinterpret_cast<MSLLHOOKSTRUCT*>(aLParam);
    // Screen physical pixels, which are what desktop pixels map to on Windows
    ZenMouseTracker::OnNativePointerMove(
        mozilla::DesktopPoint(float(info->pt.x), float(info->pt.y)));
  }
  return ::CallNextHookEx(nullptr, aCode, aWParam, aLParam);
}

nsresult ZenNativeMouseMonitor::Start() {
  if (sMouseHook) {
    return NS_OK;
  }
  // Pass the module that actually contains the hook proc (xul.dll), not the
  // executable's module
  HMODULE module = nullptr;
  if (!::GetModuleHandleExW(GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS |
                                GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT,
                            reinterpret_cast<LPCWSTR>(&MouseHookProc),
                            &module)) {
    return NS_ERROR_NOT_AVAILABLE;
  }
  sMouseHook = ::SetWindowsHookExW(WH_MOUSE_LL, MouseHookProc, module, 0);
  return sMouseHook ? NS_OK : NS_ERROR_NOT_AVAILABLE;
}

void ZenNativeMouseMonitor::Stop() {
  if (sMouseHook) {
    ::UnhookWindowsHookEx(sMouseHook);
    sMouseHook = nullptr;
  }
}

}  // namespace zen
