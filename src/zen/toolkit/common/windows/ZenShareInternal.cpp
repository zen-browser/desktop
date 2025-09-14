/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "ZenShareInternal.h"
#include "WindowsUIUtils.h"

namespace zen {
/**
* @brief Helper function to convert UTF-8 to UTF-16.
* @param aStr The UTF-8 string to convert.
* @returns The converted UTF-16 string.
*/
inline NS_ConvertUTF8toUTF16 NS_ConvertUTF8toUTF16_MaybeVoid(
    const nsACString& aStr) {
  auto str = NS_ConvertUTF8toUTF16(aStr);
  str.SetIsVoid(aStr.IsVoid());
  return str;
}
} // namespace: zen

auto nsZenNativeShareInternal::ShowNativeDialog(
      nsCOMPtr<mozIDOMWindowProxy>& aWindow, nsIURI* aUrl, const nsACString& aTitle, 
      const nsACString& aText, uint32_t aX, uint32_t aY, uint32_t aWidth, uint32_t aHeight)
    -> nsresult {
  nsAutoCString urlString;
  if (aUrl) {
    nsresult rv = aUrl->GetSpec(urlString);
    MOZ_ASSERT(NS_SUCCEEDED(rv));
    mozilla::Unused << rv;
  } else {
    urlString.SetIsVoid(true);
  }
  (void)WindowsUIUtils::Share(zen::NS_ConvertUTF8toUTF16_MaybeVoid(aTitle),
                              zen::NS_ConvertUTF8toUTF16_MaybeVoid(aText),
                              zen::NS_ConvertUTF8toUTF16_MaybeVoid(urlString));
  return NS_OK;
}
