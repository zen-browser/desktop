/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsZenDragAndDrop.h"
#include "nsBaseDragService.h"

namespace zen {
namespace {

static constexpr auto kZenDefaultDragImageOpacity =
#if defined(MOZ_WIDGET_GTK)
// For GTK, the default is 0.5 (DRAG_IMAGE_ALPHA_LEVEL) to match 
// the native behavior. Make sure its synced with the following variable:
// https://searchfox.org/firefox-main/rev/14c08f0368ead8bfdddec62f43e0bb5c8fd61289/widget/gtk/nsDragService.cpp#75
    0.5f;
#else
// For other platforms, the default is whatever the value of DRAG_TRANSLUCENCY
// is, defined in nsBaseDragService.h
    DRAG_TRANSLUCENCY;
#endif

} // namespace: <empty>

// Use the macro to inject all of the definitions for nsISupports.
NS_IMPL_ISUPPORTS(nsZenDragAndDrop, nsIZenDragAndDrop)

nsZenDragAndDrop::nsZenDragAndDrop() {
  (void)this->OnDragEnd();
}

auto nsZenDragAndDrop::GetZenDragAndDropInstance() -> nsCOMPtr<nsZenDragAndDrop> {
  return do_GetService(ZEN_BOOSTS_BACKEND_CONTRACTID);
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

} // namespace: zen
