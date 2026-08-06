/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsZenDragAndDrop.h"
#include "nsBaseDragService.h"

#include "mozilla/WidgetUtils.h"
#include "nsIWidget.h"
#include "nsPIDOMWindow.h"

#if defined(XP_WIN)
#  include <windows.h>
#elif defined(MOZ_WIDGET_GTK)
#  include <gdk/gdk.h>
#  include "mozilla/WidgetUtilsGtk.h"
#endif

namespace zen {

#if defined(XP_MACOSX)
nsresult StartNativeWindowMoveCocoa(nsIWidget* aWidget);
#endif

/**
 * @brief Start a native, OS-driven move of the window backing aWidget.
 * @see nsIZenDragAndDrop::beginNativeWindowMove for more details.
 */
static nsresult StartNativeWindowMove(nsIWidget* aWidget) {
#if defined(XP_MACOSX)
  return StartNativeWindowMoveCocoa(aWidget);
#elif defined(XP_WIN)
  HWND hwnd = static_cast<HWND>(aWidget->GetNativeData(NS_NATIVE_WINDOW));
  NS_ENSURE_TRUE(hwnd, NS_ERROR_FAILURE);
  // Hand the drag over to the OS as if the titlebar was grabbed; this
  // enters the native move loop.
  ::ReleaseCapture();
  ::PostMessageW(hwnd, WM_NCLBUTTONDOWN, HTCAPTION, 0);
  return NS_OK;
#elif defined(MOZ_WIDGET_GTK)
  auto* gdkWindow =
      static_cast<GdkWindow*>(aWidget->GetNativeData(NS_NATIVE_WINDOW));
  NS_ENSURE_TRUE(gdkWindow, NS_ERROR_FAILURE);
  GdkWindow* toplevel = gdk_window_get_toplevel(gdkWindow);
  GdkDevice* pointer = mozilla::widget::GdkGetPointer();
  NS_ENSURE_TRUE(pointer, NS_ERROR_FAILURE);
  // A native move works on both X11 and Wayland, unlike moving the
  // window programmatically.
  gint rootX = 0;
  gint rootY = 0;
  gdk_device_get_position(pointer, nullptr, &rootX, &rootY);
  gdk_window_begin_move_drag_for_device(toplevel, pointer, 1, rootX, rootY,
                                        GDK_CURRENT_TIME);
  return NS_OK;
#else
  return NS_ERROR_NOT_IMPLEMENTED;
#endif
}
namespace {

static constexpr auto kZenDefaultDragImageOpacity =
#if defined(MOZ_WIDGET_GTK)
    // For GTK, the default is 0.5 (DRAG_IMAGE_ALPHA_LEVEL) to match
    // the native behavior. Make sure its synced with the following variable:
    // https://searchfox.org/firefox-main/rev/14c08f0368ead8bfdddec62f43e0bb5c8fd61289/widget/gtk/nsDragService.cpp#75
    0.5f;
#else
    // For other platforms, the default is whatever the value of
    // DRAG_TRANSLUCENCY is, defined in nsBaseDragService.h
    DRAG_TRANSLUCENCY;
#endif

}  // namespace

// Use the macro to inject all of the definitions for nsISupports.
NS_IMPL_ISUPPORTS(nsZenDragAndDrop, nsIZenDragAndDrop)

nsZenDragAndDrop::nsZenDragAndDrop() { (void)this->OnDragEnd(); }

auto nsZenDragAndDrop::GetZenDragAndDropInstance()
    -> nsCOMPtr<nsZenDragAndDrop> {
  return do_GetService(ZEN_DND_MANAGER_CONTRACTID);
}

NS_IMETHODIMP
nsZenDragAndDrop::OnDragStart(float opacity) {
  mDragImageOpacity = opacity;
  return NS_OK;
}

NS_IMETHODIMP
nsZenDragAndDrop::OnDragEnd() {
  mDragImageOpacity = kZenDefaultDragImageOpacity;
  return NS_OK;
}

NS_IMETHODIMP
nsZenDragAndDrop::BeginNativeWindowMove(mozIDOMWindowProxy* aWindow) {
  NS_ENSURE_ARG_POINTER(aWindow);
  nsCOMPtr<nsPIDOMWindowOuter> outer = nsPIDOMWindowOuter::From(aWindow);
  NS_ENSURE_TRUE(outer, NS_ERROR_INVALID_ARG);
  RefPtr<nsIWidget> widget =
      mozilla::widget::WidgetUtils::DOMWindowToWidget(outer);
  NS_ENSURE_TRUE(widget, NS_ERROR_FAILURE);
  return StartNativeWindowMove(widget);
}

}  // namespace zen
