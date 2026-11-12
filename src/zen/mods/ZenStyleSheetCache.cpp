/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "ZenStyleSheetCache.h"
#include "nsAppDirectoryServiceDefs.h"

#include "nsCOMPtr.h"
#include "nsIFile.h"
#include "nsIIOService.h"
#include "nsIResProtocolHandler.h"
#include "nsNetUtil.h"
#include "nsXULAppAPI.h"

#include "nsStyleSheetService.h"

#include "mozilla/ClearOnShutdown.h"
#include "mozilla/GlobalStyleSheetCache.h"
#include "mozilla/RefPtr.h"
#include "mozilla/ServoStyleConsts.h"
#include "mozilla/StyleSheet.h"

#define GET_MODS_FILE(chromeFile, err)                                        \
  NS_GetSpecialDirectory(NS_APP_USER_CHROME_DIR, getter_AddRefs(chromeFile)); \
  if (!chromeFile) {                                                          \
    return err;                                                               \
  }                                                                           \
  chromeFile->Append(ZEN_MODS_FILENAME);

#define ZEN_MODS_CONTENT_URL "resource://zen-mods/zen-themes-content.css"_ns

namespace zen {

using namespace mozilla;
NS_IMPL_ISUPPORTS(ZenStyleSheetCache, nsISupports)

auto ZenStyleSheetCache::GetModsSheet() -> StyleSheet* {
  if (mModsSheet) {
    // If the mods stylesheet is already loaded, return it.
    return mModsSheet;
  }
  nsCOMPtr<nsIFile> chromeFile;
  GET_MODS_FILE(chromeFile, nullptr);

  // Create the mods stylesheet if it doesn't exist.
  bool exists;
  chromeFile->Exists(&exists);
  if (!exists) {
    nsresult rv = chromeFile->Create(nsIFile::NORMAL_FILE_TYPE, 0644);
    if (NS_FAILED(rv)) {
      return nullptr;
    }
  }

  // Chrome documents only exist in the parent, before any page loads.
  nsCOMPtr<nsIFile> chromeDir;
  chromeFile->GetParent(getter_AddRefs(chromeDir));
  RegisterModsSubstitution(chromeDir);

  LoadSheetFile(chromeFile, StyleOrigin::User);
  return mModsSheet;
}

/* static */
auto ZenStyleSheetCache::RegisterModsSubstitution(nsIFile* aChromeDir) -> void {
  static bool sRegistered = false;
  if (sRegistered || !aChromeDir || !XRE_IsParentProcess()) {
    return;
  }
  sRegistered = true;

  nsCOMPtr<nsIFile> contentFile;
  aChromeDir->Clone(getter_AddRefs(contentFile));
  contentFile->Append(ZEN_MODS_CONTENT_FILENAME);
  bool exists = false;
  contentFile->Exists(&exists);
  if (!exists) {
    (void)contentFile->Create(nsIFile::NORMAL_FILE_TYPE, 0644);
  }

  nsCOMPtr<nsIURI> chromeDirURI;
  NS_NewFileURI(getter_AddRefs(chromeDirURI), aChromeDir);
  nsCOMPtr<nsIIOService> io = do_GetIOService();
  nsCOMPtr<nsIProtocolHandler> handler;
  if (!chromeDirURI || !io ||
      NS_FAILED(io->GetProtocolHandler("resource", getter_AddRefs(handler)))) {
    return;
  }
  // Substitutions reach every content process, the ones started later too.
  if (nsCOMPtr<nsIResProtocolHandler> res = do_QueryInterface(handler)) {
    (void)res->SetSubstitution("zen-mods"_ns, chromeDirURI);
  }
}

auto ZenStyleSheetCache::GetModsContentSheet() -> StyleSheet* {
  // A failed load isn't kept: the next document tries again.
  if (!mModsContentSheet) {
    LoadContentSheet();
  }
  return mModsContentSheet;
}

auto ZenStyleSheetCache::LoadContentSheet() -> void {
  nsCOMPtr<nsIURI> uri;
  if (NS_FAILED(NS_NewURI(getter_AddRefs(uri), ZEN_MODS_CONTENT_URL))) {
    return;
  }

  RefPtr<mozilla::css::Loader> loader = new mozilla::css::Loader;
  auto result = loader->LoadSheetSync(uri, StyleOrigin::User,
                                      css::Loader::UseSystemPrincipal::Yes);
  if (MOZ_UNLIKELY(result.isErr())) {
    return;
  }
  mModsContentSheet = result.unwrapOr(nullptr);
}

nsresult ZenStyleSheetCache::ReloadModsContentSheet() {
  RefPtr<StyleSheet> previous = mModsContentSheet.forget();

  LoadContentSheet();

  if (!mModsContentSheet) {
    mModsContentSheet = std::move(previous);
    return NS_ERROR_FAILURE;
  }

  if (auto* sss = nsStyleSheetService::GetInstance()) {
    sss->ZenReplaceModsContentSheet(previous, *mModsContentSheet);
  }

  return NS_OK;
}

auto ZenStyleSheetCache::LoadSheetFile(nsIFile* aFile, StyleOrigin aOrigin)
    -> void {
  nsCOMPtr<nsIURI> uri;
  NS_NewFileURI(getter_AddRefs(uri), aFile);
  if (!uri) {
    return;
  }

  RefPtr<mozilla::css::Loader> loader = new mozilla::css::Loader;
  auto result =
      loader->LoadSheetSync(uri, aOrigin, css::Loader::UseSystemPrincipal::Yes);
  if (MOZ_UNLIKELY(result.isErr())) {
    return;
  }
  mModsSheet = result.unwrapOr(nullptr);
}

/* static */
auto ZenStyleSheetCache::Singleton() -> ZenStyleSheetCache* {
  MOZ_ASSERT(NS_IsMainThread());
  if (!gZenModsCache) {
    gZenModsCache = new ZenStyleSheetCache;
    ClearOnShutdown(&gZenModsCache);
  }
  return gZenModsCache;
}

nsresult ZenStyleSheetCache::ReloadModsSheet() {
  nsCOMPtr<nsIFile> chromeFile;
  GET_MODS_FILE(chromeFile, NS_ERROR_FAILURE);

  RefPtr<StyleSheet> previous = mModsSheet.forget();

  LoadSheetFile(chromeFile, StyleOrigin::User);

  if (!mModsSheet) {
    mModsSheet = std::move(previous);
    return NS_ERROR_FAILURE;
  }

  // No document asked for the sheet yet; they'll get the new one.
  if (!previous) {
    return NS_OK;
  }

  if (auto* sss = nsStyleSheetService::GetInstance()) {
    sss->ZenReplaceModsSheet(*previous, *mModsSheet);
  }

  return NS_OK;
}

mozilla::StaticRefPtr<ZenStyleSheetCache> ZenStyleSheetCache::gZenModsCache;

}  // namespace zen
