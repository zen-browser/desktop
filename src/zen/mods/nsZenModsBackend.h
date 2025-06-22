/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_ZenModsBackend_h__
#define mozilla_ZenModsBackend_h__

#include "nsIZenModsBackend.h"
#include "nsIZenCommonUtils.h"

#include "mozilla/ServoStyleSet.h"
#include "mozilla/dom/Document.h"

namespace zen {

class nsZenModsBackend final : public nsIZenModsBackend {
  NS_DECL_ISUPPORTS
  NS_DECL_NSIZENMODSBACKEND

 public:
  explicit nsZenModsBackend();

  /**
   * @brief Insert the mods stylesheet into the document
   *  if it is enabled and it is a chrome document.
   * @param aDocument The document to insert the mods stylesheet into.
   * @param aStylesSet The style set to insert the mods stylesheet into.
   * @returns void
   */
  auto InsertModsStylesheetIfEnabled(mozilla::dom::Document* aDocument, 
      mozilla::ServoStyleSet& aStylesSet) -> void;
 protected:
  /**
   * @brief Check for the preference and see if the app is on safe mode.
   */
  auto CheckEnabled() -> void;

 private:
  ~nsZenModsBackend() = default;
  bool mEnabled = false;
};

} // namespace zen

#endif
