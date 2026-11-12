/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsZenModsBackend.h"

#include "nsIXULRuntime.h"
#include "nsStyleSheetService.h"

#include "mozilla/GlobalStyleSheetCache.h"
#include "mozilla/PresShell.h"
#include "mozilla/PresShellInlines.h"
#include "mozilla/StyleSheet.h"
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
}  // namespace

// Use the macro to inject all of the definitions for nsISupports.
NS_IMPL_ISUPPORTS(nsZenModsBackend, nsIZenModsBackend)

nsZenModsBackend::nsZenModsBackend() { (void)CheckEnabled(); }

auto nsZenModsBackend::CheckEnabled() -> void {
  // Check if the mods backend is enabled based on the preference.
  bool inSafeMode = false;
  if (nsCOMPtr<nsIXULRuntime> appInfo =
          do_GetService("@mozilla.org/xre/app-info;1")) {
    appInfo->GetInSafeMode(&inSafeMode);
  }
  mEnabled = !inSafeMode &&
             !mozilla::Preferences::GetBool("zen.themes.disable-all", false);
}

auto nsZenModsBackend::ReloadModsStyles() -> nsresult {
  return GetZenStyleSheetCache()->ReloadModsSheet();
}

auto nsZenModsBackend::ReloadModsContentStyles() -> nsresult {
  return GetZenStyleSheetCache()->ReloadModsContentSheet();
}

}  // namespace zen

auto nsStyleSheetService::ZenReplaceModsSheet(mozilla::StyleSheet& aOld,
                                              mozilla::StyleSheet& aNew)
    -> void {
  // A document fills its style set when it gets a pres shell, so every
  // document that has the old sheet is reachable from here.
  for (const RefPtr<mozilla::PresShell>& presShell : mPresShells.Clone()) {
    if (!presShell) {
      continue;
    }

    RefPtr<mozilla::dom::Document> doc = presShell->GetDocument();

    if (!doc || !doc->IsInChromeDocShell()) {
      continue;
    }

    mozilla::ServoStyleSet* styleSet = presShell->StyleSet();
    bool hasOldSheet = false;

    for (size_t i = 0, count = styleSet->SheetCount(mozilla::StyleOrigin::User);
         i < count; ++i) {
      if (styleSet->SheetAt(mozilla::StyleOrigin::User, i) == &aOld) {
        hasOldSheet = true;
        break;
      }
    }

    if (!hasOldSheet) {
      continue;
    }

    // Same position as before, so userChrome.css still comes after the mods.
    styleSet->InsertStyleSheetBefore(aNew, aOld);
    styleSet->RemoveStyleSheet(aOld);
    doc->ApplicableStylesChanged();
  }
}

auto nsStyleSheetService::ZenReplaceModsContentSheet(mozilla::StyleSheet* aOld,
                                                     mozilla::StyleSheet& aNew)
    -> void {
  mozilla::StyleSheet* userContent =
      mozilla::GlobalStyleSheetCache::Singleton()->GetUserContentSheet();

  for (const RefPtr<mozilla::PresShell>& presShell : mPresShells.Clone()) {
    if (!presShell) {
      continue;
    }

    RefPtr<mozilla::dom::Document> doc = presShell->GetDocument();

    // Like Document::FillStyleSetUserAndUASheets: privileged pages, like
    // about:preferences, never get the mods' styles.
    if (!doc || doc->IsInChromeDocShell() ||
        doc->NodePrincipal()->IsSystemPrincipal()) {
      continue;
    }

    mozilla::ServoStyleSet* styleSet = presShell->StyleSet();
    bool hasOldSheet = false;
    bool hasUserContent = false;

    for (size_t i = 0, count = styleSet->SheetCount(mozilla::StyleOrigin::User);
         i < count; ++i) {
      mozilla::StyleSheet* sheet =
          styleSet->SheetAt(mozilla::StyleOrigin::User, i);
      hasOldSheet = hasOldSheet || (aOld && sheet == aOld);
      hasUserContent = hasUserContent || (userContent && sheet == userContent);
    }

    // Where it was, or where a new document puts it: before userContent.css,
    // so the user's own styles still win.
    if (hasOldSheet) {
      styleSet->InsertStyleSheetBefore(aNew, *aOld);
      styleSet->RemoveStyleSheet(*aOld);
    } else if (hasUserContent) {
      styleSet->InsertStyleSheetBefore(aNew, *userContent);
    } else {
      styleSet->AppendStyleSheet(aNew);
    }

    doc->ApplicableStylesChanged();
  }
}
