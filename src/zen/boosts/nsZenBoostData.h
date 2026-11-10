/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_ZenBoostData_h_
#define mozilla_ZenBoostData_h_

#include "js/TypeDecls.h"
#include "nsString.h"
#include "nsTArray.h"

class nsIURI;

namespace zen {

/**
 * @brief Everything a boost changes on a page, as registered for a domain.
 * The color values are the raw editor values.
 */
struct nsZenBoost {
  bool colorEnabled = false;
  bool autoTheme = false;
  bool smartInvert = false;
  float hueDeg = 0.0f;
  float saturation = 0.0f;
  float brightness = 0.0f;
  float contrast = 0.0f;
  float complementaryRotation = 0.0f;
  nsCString styleSheet;
};

/**
 * @brief The style rules of a boost, before they become a stylesheet.
 */
struct nsZenBoostStyle {
  nsCString fontFamily;
  nsCString textTransform;
  nsTArray<nsCString> zapSelectors;
  nsTArray<nsCString> focusSelectors;
  nsCString customCSS;
};

/**
 * @brief Reads the boost data object stored by ZenBoostsManager, and builds
 * the boost's stylesheet from it.
 * @param aBoostData The boost data.
 * @return False when reading threw, with the exception pending on aCx.
 */
bool ReadBoostData(JSContext* aCx, JS::Handle<JS::Value> aBoostData,
                   nsZenBoost& aBoost);

/**
 * @brief The host of a document URI, in the form boosts are registered
 * under. Empty when it has no host.
 */
void GetBoostHost(nsIURI* aURI, nsACString& aHost);

}  // namespace zen

#endif
