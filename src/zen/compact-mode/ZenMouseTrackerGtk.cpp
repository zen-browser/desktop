/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "ZenMouseTracker.h"
#include "ZenMouseTrackerInternal.h"

#include "mozilla/WidgetUtilsGtk.h"

#include <gdk/gdk.h>
#include <glib.h>

namespace zen {

// X11 has no way to observe global pointer motion events without pulling in
// extra library dependencies (XInput2 raw events need libXi, XRecord needs
// libXtst), so we poll the pointer from a GLib timeout instead. This only
// runs during the short periods a window is registered, i.e. while the
// pointer is outside of the window with an edge element held open.
static guint sTimerId = 0;

static gboolean OnTimer(gpointer) {
  GdkDevice* pointer = mozilla::widget::GdkGetPointer();
  if (pointer) {
    gint x = 0, y = 0;
    gdk_device_get_position(pointer, nullptr, &x, &y);
    ZenMouseTracker::OnNativePointerMove(
        mozilla::DesktopPoint(float(x), float(y)));
  }
  return G_SOURCE_CONTINUE;
}

nsresult ZenNativeMouseMonitor::Start() {
  if (!mozilla::widget::GdkIsX11Display()) {
    // Wayland doesn't expose the pointer position while it is outside of our
    // surfaces
    return NS_ERROR_NOT_AVAILABLE;
  }
  if (!sTimerId) {
    sTimerId = g_timeout_add(1000 / 60, OnTimer, nullptr);
  }
  return NS_OK;
}

void ZenNativeMouseMonitor::Stop() {
  if (sTimerId) {
    g_source_remove(sTimerId);
    sTimerId = 0;
  }
}

}  // namespace zen
