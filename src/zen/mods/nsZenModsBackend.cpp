/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsZenModsBackend.h"

#include "nsIXULRuntime.h"
#include "nsIStyleSheetService.h"

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
  CheckEnabled();
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

auto nsZenModsBackend::InsertModsStylesheetIfEnabled(
  mozilla::dom::Document* aDocument, mozilla::ServoStyleSet& aStylesSet) -> void {
  if (!mEnabled || !aDocument->IsInChromeDocShell()) {
    return;
  }
  // Get the mods stylesheet from the cache.
  auto modsSheet = GetZenStyleSheetCache()->GetModsSheet();
  if (!modsSheet) {
    // If the mods stylesheet is not available, we do nothing.
    return;
  }
  // Insert the mods stylesheet into the style set.
  aStylesSet.AppendStyleSheet(*modsSheet);
}

auto nsZenModsBackend::RebuildModsStyles() -> nsresult {
  CheckEnabled();

  if (!mEnabled) {
    return NS_OK; // If not enabled, nothing to do.
  }

  // Invalidate the mods stylesheet cache.
  GetZenStyleSheetCache()->InvalidateModsSheet();

  // Rebuild the mods stylesheets.
  auto modsSheet = GetZenStyleSheetCache()->GetModsSheet();
  if (!modsSheet) {
    return NS_OK; // No mods stylesheet to rebuild.
  }

  // Get the service from @mozilla.org/content/style-sheet-service;1
  nsCOMPtr<nsIStyleSheetService> styleSheetService =
      do_GetService(NS_STYLESHEETSERVICE_CONTRACTID);
  if (!styleSheetService) {
    return NS_ERROR_FAILURE;
  }

  // Unload and unregister the existing mods stylesheet if it exists.
  nsIURI* modsSheetURI = modsSheet->GetSheetURI();
  if (modsSheetURI) {
    nsresult rv = styleSheetService->UnregisterSheet(
        modsSheetURI, nsIStyleSheetService::USER_SHEET);
    // Ignore result as it may not be registered yet.
    rv = styleSheetService->RegisterSheet(
        modsSheetURI, nsIStyleSheetService::USER_SHEET);
    mozilla::Unused << rv;
  }

  // Notify that the mods stylesheets have been rebuilt.
  return NS_OK;
}

NS_IMETHODIMP
nsZenModsBackend::InvalidateModsSheet() {
  if (!mEnabled) {
    return NS_ERROR_NOT_AVAILABLE;
  }

  GetZenStyleSheetCache()->InvalidateModsSheet();
  return NS_OK;
}

} // namespace: zen