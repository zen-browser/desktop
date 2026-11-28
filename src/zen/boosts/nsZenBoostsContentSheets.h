/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_ZenBoostsContentSheets_h_
#define mozilla_ZenBoostsContentSheets_h_

#include "nsCOMPtr.h"
#include "nsIObserver.h"
#include "nsIURI.h"
#include "nsString.h"
#include "nsTHashMap.h"

#include "mozilla/RefPtr.h"
#include "mozilla/StyleSheet.h"

namespace mozilla::dom {
class Document;
}

namespace zen {

class nsZenBoostsContentSheets final : public nsIObserver {
 public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIOBSERVER

  static nsZenBoostsContentSheets* Get();

  void Update(const nsACString& aDomain, const nsACString& aSpec);

 private:
  nsZenBoostsContentSheets() = default;
  ~nsZenBoostsContentSheets() = default;

  struct Entry {
    nsCString spec;
    nsCOMPtr<nsIURI> uri;
    RefPtr<mozilla::StyleSheet> parsed;
  };

  /**
   * @brief Attaches the stylesheet registered for the document's host, if
   * there is one. Safe to call for a document that already has it.
   */
  void AttachTo(mozilla::dom::Document& aDocument);

  nsTHashMap<nsCStringHashKey, Entry> mSheets;
};

}  // namespace zen

#endif
