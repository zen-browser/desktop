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
  mozilla::Unused << CheckEnabled();
}

auto nsZenModsBackend::CheckEnabled() -> bool {
  // Check if the mods backend is enabled based on the preference.
  nsCOMPtr<nsIXULRuntime> appInfo =
      do_GetService("@mozilla.org/xre/app-info;1");
  bool inSafeMode = false;
  if (appInfo) {
    appInfo->GetInSafeMode(&inSafeMode);
  }
  mEnabled = !inSafeMode &&
             !mozilla::Preferences::GetBool("zen.themes.disable-all", false);
  return mEnabled; 
}

auto nsZenModsBackend::RebuildModsStyles() -> nsresult {
  // Invalidate the mods stylesheet cache.
  GetZenStyleSheetCache()->InvalidateModsSheet();
  // Rebuild the mods stylesheets.
  auto modsSheet = GetZenStyleSheetCache()->GetModsSheet();
  if (!modsSheet) {
    return NS_ERROR_FAILURE;
  }
  // Get the service from @mozilla.org/content/style-sheet-service;1
  if (auto* sss = nsStyleSheetService::GetInstance()) {
    // Register the mods stylesheet.
    sss->UpdateZenModStyles(modsSheet, modsSheet->GetSheetURI(), CheckEnabled());
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

void nsStyleSheetService::UpdateZenModStyles(mozilla::StyleSheet* aSheet, nsIURI* aURI, bool aInsert) {
  auto sheetType = nsStyleSheetService::USER_SHEET;
  this->UnregisterSheet(aURI, sheetType);
  if (!aSheet || !aInsert) {
    return; // Nothing to update.
  }
  mSheets[sheetType].AppendElement(aSheet);
  // Hold on to a copy of the registered PresShells.
  for (mozilla::PresShell* presShell : mPresShells.Clone()) {
    // Only allow on chrome documents.
    auto doc = presShell->GetDocument();
    if (doc && !doc->IsInChromeDocShell()) {
      continue;
    }
    presShell->NotifyStyleSheetServiceSheetAdded(aSheet, sheetType);
  }

  if (XRE_IsParentProcess()) {
    nsTArray<mozilla::dom::ContentParent*> children;
    mozilla::dom::ContentParent::GetAll(children);

    if (children.IsEmpty()) {
      return;
    }

    for (uint32_t i = 0; i < children.Length(); i++) {
      mozilla::Unused << children[i]->SendLoadAndRegisterSheet(aURI, sheetType);
    }
  }
}
