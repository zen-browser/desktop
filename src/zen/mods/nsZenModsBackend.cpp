/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsZenModsBackend.h"

#include "nsIXULRuntime.h"
#include "nsStyleSheetService.h"

#include "mozilla/PresShell.h"
#include "mozilla/dom/ContentParent.h"

#include "nsIURI.h"
#include "nsIFile.h"

#include "ZenStyleSheetCache.h"

namespace zen {

namespace {
/// @brief Helper function to get the singleton instance of ZenStyleSheetCache.
/// @return A pointer to the singleton instance of ZenStyleSheetCache.
static auto GetZenStyleSheetCache() -> ZenStyleSheetCache* {
  return ZenStyleSheetCache::Singleton();
}
}

// Use the macro to inject all of the definitions for nsISupports.
NS_IMPL_ISUPPORTS(nsZenModsBackend, nsIZenModsBackend)

nsZenModsBackend::nsZenModsBackend() {
  (void)CheckEnabled();
}

auto nsZenModsBackend::CheckEnabled() -> void {
  // Check if the mods backend is enabled based on the preference.
  nsCOMPtr<nsIXULRuntime> appInfo =
      do_GetService("@mozilla.org/xre/app-info;1");
  bool inSafeMode = false;
  if (appInfo) {
    appInfo->GetInSafeMode(&inSafeMode);
  }
  mEnabled = !inSafeMode &&
             !mozilla::Preferences::GetBool("zen.themes.disable-all", false);
}

auto nsZenModsBackend::RebuildModsStyles(const nsACString& aContents) -> nsresult {
  // Notify that the mods stylesheets have been rebuilt.
  return GetZenStyleSheetCache()->RebuildModsStylesheets(aContents);
}

} // namespace: zen

auto nsStyleSheetService::ZenMarkStylesAsChanged() -> void {
  for (auto& presShell : mPresShells) {
    if (presShell) {
      if (auto doc = presShell->GetDocument(); doc && doc->IsInChromeDocShell()) {
        // Notify the document that styles have changed.
        doc->ApplicableStylesChanged();
      }
    }
  }
}
