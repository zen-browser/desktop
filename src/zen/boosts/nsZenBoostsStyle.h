/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_ZenBoostsStyle_h_
#define mozilla_ZenBoostsStyle_h_

#include "nsColor.h"
#include "nsString.h"
#include "nsZenBoostData.h"

namespace zen::detail {

/**
 * @brief Builds the packed accent of a boost.
 * @param aHueDeg The accent hue, in degrees.
 * @param aBoost The boost supplying saturation, brightness and contrast.
 */
nscolor BuildAccentColor(float aHueDeg, const nsZenBoost& aBoost);

/**
 * @brief The hue of an RGB color in degrees, 0 for achromatic colors.
 */
float HueOfColor(nscolor aColor);

/**
 * @brief Generates the CSS of a boost. Empty when the boost has no rules.
 */
nsCString BuildStyleRules(const nsZenBoostStyle& aStyle);

/**
 * @brief Generates the stylesheet of a boost as a data URI.
 */
nsCString BuildStyleSheetURI(const nsZenBoostStyle& aStyle);

}  // namespace zen::detail

#endif
