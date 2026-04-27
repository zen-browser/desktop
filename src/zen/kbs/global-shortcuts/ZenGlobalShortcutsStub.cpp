/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "ZenGlobalShortcuts.h"

// Linux/other-toolkit fallback. A real implementation needs X11
// XGrabKey on the root window or, on Wayland, the
// org.freedesktop.portal.GlobalShortcuts portal over D-Bus. Until one
// is added, registrations always fail and JS-side code can fall back
// to in-window shortcuts.

namespace zen {

// static
nsresult ZenGlobalShortcuts::NativeRegister(Registration&, const nsACString&,
                                            uint32_t) {
  return NS_ERROR_NOT_IMPLEMENTED;
}

// static
void ZenGlobalShortcuts::NativeUnregister(Registration&) {}

// static
void ZenGlobalShortcuts::NativeShutdown() {}

}  // namespace zen
