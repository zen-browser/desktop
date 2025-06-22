/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "ZenStyleSheetCache.h"
#include "nsAppDirectoryServiceDefs.h"

#include "nsCOMPtr.h"
#include "nsIFile.h"

#include "mozilla/css/SheetParsingMode.h"
#include "mozilla/GlobalStyleSheetCache.h"

namespace zen {

using namespace mozilla;

auto ZenStyleSheetCache::InvalidateModsSheet() -> void {
  mModsSheet = nullptr;
}

auto ZenStyleSheetCache::GetModsSheet() -> RefPtr<StyleSheet> {
  nsCOMPtr<nsIFile> chromeFile;
  auto* cache = GlobalStyleSheetCache::Singleton();

  NS_GetSpecialDirectory(NS_APP_USER_CHROME_DIR, getter_AddRefs(chromeFile));
  if (!chromeFile) {
    // if we don't have a profile yet, that's OK!
    return nullptr;
  }

  chromeFile->Append(ZEN_MODS_FILENAME);
  mModsSheet = LoadSheetFile(chromeFile, css::eUserSheetFeatures);
  return mModsSheet.forget();
}

auto ZenStyleSheetCache::LoadSheetFile(nsIFile* aFile,
                                        css::SheetParsingMode aParsingMode)
    -> RefPtr<StyleSheet> {
  nsCOMPtr<nsIURI> uri;
  NS_NewFileURI(getter_AddRefs(uri), aFile);
  if (!uri) {
    return nullptr;
  }

  if (!gCSSLoader) {
    gCSSLoader = new mozilla::css::Loader;
  }

  auto result = gCSSLoader->LoadSheetSync(uri, aParsingMode,
                                          css::Loader::UseSystemPrincipal::Yes);
  if (MOZ_UNLIKELY(result.isErr())) {
    return nullptr;
  }
  return result.unwrapOr(nullptr);
}
  
/* static */
auto ZenStyleSheetCache::Singleton() -> ZenStyleSheetCache* {
  MOZ_ASSERT(NS_IsMainThread());
  if (!gZenModsCache) {
    gZenModsCache = new ZenStyleSheetCache;
  }
  return gZenModsCache;
}

mozilla::StaticRefPtr<mozilla::css::Loader> ZenStyleSheetCache::gCSSLoader; 
mozilla::StaticRefPtr<ZenStyleSheetCache> ZenStyleSheetCache::gZenModsCache; 

} // namespace: zen