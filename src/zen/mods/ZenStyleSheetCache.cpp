/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "ZenStyleSheetCache.h"
#include "nsAppDirectoryServiceDefs.h"

#include "nsCOMPtr.h"
#include "nsIFile.h"
#include "nsNetUtil.h"

#include "nsStyleSheetService.h"

#include "mozilla/css/SheetParsingMode.h"
#include "mozilla/GlobalStyleSheetCache.h"
#include "mozilla/RefPtr.h"

#define GET_MODS_FILE(chromeFile, err) \
  NS_GetSpecialDirectory(NS_APP_USER_CHROME_DIR, getter_AddRefs(chromeFile)); \
  if (!chromeFile) { \
    return err; \
  } \
  chromeFile->Append(ZEN_MODS_FILENAME);

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

  LoadSheetFile(chromeFile, css::eUserSheetFeatures);
  return mModsSheet;
}

auto ZenStyleSheetCache::LoadSheetFile(nsIFile* aFile,
                                        css::SheetParsingMode aParsingMode)
    -> void {
  nsCOMPtr<nsIURI> uri;
  NS_NewFileURI(getter_AddRefs(uri), aFile);
  if (!uri) {
    return;
  }

  RefPtr<mozilla::css::Loader> loader = new mozilla::css::Loader;
  auto result = loader->LoadSheetSync(uri, aParsingMode,
                                      css::Loader::UseSystemPrincipal::Yes);
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
  }
  return gZenModsCache;
}

nsresult ZenStyleSheetCache::RebuildModsStylesheets(const nsACString& aContents) {
  // Re-parse the mods stylesheet. By doing so, we read 
  // Once we have the data as a nsACString, we call ReparseSheet from the
  // StyleSheet class to re-parse the stylesheet.
  auto sheet = GetModsSheet();
  if (!sheet) {
    return NS_ERROR_FAILURE;
  }
  ErrorResult aRv;
  sheet->ReparseSheet(aContents, aRv);
  if (auto sss = nsStyleSheetService::GetInstance()) {
    sss->ZenMarkStylesAsChanged();
  }
  return aRv.StealNSResult();
}


mozilla::StaticRefPtr<ZenStyleSheetCache> ZenStyleSheetCache::gZenModsCache; 

} // namespace: zen