/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsZenBoostsBackend.h"

#include "nsIXULRuntime.h"
#include "nsPresContext.h"

#include "mozilla/StaticPtr.h"

#include "mozilla/ServoStyleConsts.h"
#include "mozilla/ServoStyleConstsInlines.h"
#include "mozilla/MediaFeatureChange.h"

#include "mozilla/dom/Document.h"
#include "mozilla/dom/BrowsingContext.h"

#define COLOR_CHANNEL_MIDPOINT 128

// It's a bit of a hacky solution, but instead of using alpha as what it is
// (opacity), we use it to store contrast information for now.
// We do this primarily to avoid having to deal with WebIDL structs and
// serialization/deserialization between parent and content processes.
#define NS_GET_CONTRAST(_c) NS_GET_A(_c)

using BrowsingContext = mozilla::dom::BrowsingContext;

/**
 * @brief Called when the ZenBoostsData field is set on a browsing context.
 * Triggers a restyle if the boost data has changed.
 * @param aOldValue The previous value of the boost data.
 */
void BrowsingContext::DidSet(FieldIndex<IDX_ZenBoostsData>,
                             ZenBoostData aOldValue) {
  MOZ_ASSERT(IsTop());
  if (ZenBoostsData() == aOldValue) {
    return;
  }
  PresContextAffectingFieldChanged();
}

/**
 * @brief Called when the IsZenBoostsInverted field is set on a browsing
 * context. Triggers a restyle if the value has changed.
 * @param aOldValue The previous value of the IsZenBoostsInverted flag.
 */
void BrowsingContext::DidSet(FieldIndex<IDX_IsZenBoostsInverted>,
                             bool aOldValue) {
  MOZ_ASSERT(IsTop());
  if (IsZenBoostsInverted() == aOldValue) {
    return;
  }
  PresContextAffectingFieldChanged();
}

namespace zen {
namespace {

/**
 * @brief Clamps a value to the range [0, 255] using branchless operations.
 * @param v The value to clamp.
 * @return The clamped value in the range [0, 255].
 */
static __inline int32_t clamp255(int32_t v) {
  // llvm x86 is poor at ternary operator, so use branchless min/max.
  return (((255 - (v)) >> 31) | (v)) & 255;
}

/**
 * @brief Applies a color filter to transform an original color toward an accent
 * color. Preserves the original color's perceived luminance while shifting
 * hue/chroma toward the accent. Uses the alpha channel of the accent color to
 * store contrast information.
 * @param aOriginalColor The original color to filter.
 * @param aAccentColor The accent color to filter toward (alpha channel contains
 * contrast value).
 * @return The filtered color with transformations applied.
 */
static nscolor zenFilterColorChannel(nscolor aOriginalColor,
                                     nscolor aAccentColor) {
  const auto r1 = NS_GET_R(aOriginalColor);
  const auto g1 = NS_GET_G(aOriginalColor);
  const auto b1 = NS_GET_B(aOriginalColor);

  const auto r2 = NS_GET_R(aAccentColor);
  const auto g2 = NS_GET_G(aAccentColor);
  const auto b2 = NS_GET_B(aAccentColor);

  // It's a bit of a hacky solution, but instead of using alpha as what it is
  // (opacity), we use it to store contrast information for now.
  // We do this primarily to avoid having to deal with WebIDL structs and
  // serialization/deserialization between parent and content processes.
  const auto contrast = NS_GET_CONTRAST(aAccentColor);

  // Approximate perceived luminance in sRGB space
  // Coefficients per Rec.709; gamma correction ignored for speed
  const double origLum = 0.2126 * r1 + 0.7152 * g1 + 0.0722 * b1;
  const double accentLum = 0.2126 * r2 + 0.7152 * g2 + 0.0722 * b2;

  double scale = accentLum > 0.0 ? (origLum / accentLum) : 1.0;

  double fr = r2 * scale;
  double fg = g2 * scale;
  double fb = b2 * scale;

  // Apply contrast adjustment: map contrast from 0–255 to -1.0–+1.0
  // contrast = 0: maximum darkening (mix toward black)
  // contrast = 127.5: no change
  // contrast = 255: maximum lightening (mix toward white)
  const double contrastFactor = (contrast - 128.0) / 128.0;

  // Compute perceived luminance for the filtered color
  const double lum = 0.2126 * fr + 0.7152 * fg + 0.0722 * fb;

  // If it's bright, mix toward white; if dark, mix toward black
  if (lum >= COLOR_CHANNEL_MIDPOINT) {
    const double mix = (lum - COLOR_CHANNEL_MIDPOINT) / COLOR_CHANNEL_MIDPOINT;
    const double amount = contrastFactor * mix;
    fr = fr + (255.0 - fr) * amount;
    fg = fg + (255.0 - fg) * amount;
    fb = fb + (255.0 - fb) * amount;
  } else {
    const double mix = (COLOR_CHANNEL_MIDPOINT - lum) / COLOR_CHANNEL_MIDPOINT;
    const double amount = -contrastFactor * mix;
    fr = fr * (1.0 - amount);
    fg = fg * (1.0 - amount);
    fb = fb * (1.0 - amount);
  }

  const uint8_t fr8 = clamp255(fr);
  const uint8_t fg8 = clamp255(fg);
  const uint8_t fb8 = clamp255(fb);

  return NS_RGB(fr8, fg8, fb8);
}

/**
 * @brief Inverts a color by inverting each RGB channel while preserving
 * perceived luminance. This is done by inverting the color and then shifting it
 * based on the sum of the inverted channels.
 * @param aColor The color to invert.
 * @return The inverted color with luminance preservation.
 */
inline static nscolor zenInvertColorChannel(nscolor aColor) {
  const auto r = NS_GET_R(aColor);
  const auto g = NS_GET_G(aColor);
  const auto b = NS_GET_B(aColor);

  const auto rInv = 255 - r;
  const auto gInv = 255 - g;
  const auto bInv = 255 - b;

  const auto max = std::max({rInv, gInv, bInv});
  const auto min = std::min({rInv, gInv, bInv});
  const auto sum = max + min;

  const auto rShifted = sum - rInv;
  const auto gShifted = sum - gInv;
  const auto bShifted = sum - bInv;

  return NS_RGB(rShifted, gShifted, bShifted);
}

/**
 * @brief Retrieves the current boost data from the browsing context.
 */
inline static void GetZenBoostsDataFromBrowsingContext(ZenBoostData* aData,
                                                       bool* aIsInverted) {
  auto zenBoosts = nsZenBoostsBackend::GetInstance();
  if (!zenBoosts || zenBoosts->mCurrentFrameIsAnonymousContent) {
    return;
  }
  if (auto presContext = zenBoosts->GetCurrentPresContext()) {
    *aData = presContext->mZenBoostsPresContextData;
    *aIsInverted = presContext->mZenBoostsInvert;
  }
}

}  // namespace

// Use the macro to inject all of the definitions for nsISupports.
NS_IMPL_ISUPPORTS(nsZenBoostsBackend, nsIZenBoostsBackend)
nsZenBoostsBackend::nsZenBoostsBackend() {};

auto nsZenBoostsBackend::GetInstance() -> nsCOMPtr<nsZenBoostsBackend> {
  static nsCOMPtr<zen::nsZenBoostsBackend> zenBoosts(
      do_GetService(ZEN_BOOSTS_BACKEND_CONTRACTID));
  return zenBoosts;
}

auto nsZenBoostsBackend::onPressShellEntered(nsPresContext* aPresContext)
    -> void {
  // Note that aPresContext can be null when entering anonymous content frames.
  // We explicitly do this to prevent applying boosts to anonymous content, such
  // as devtools or screenshots.
  mCurrentPresContext = aPresContext;
}

auto nsZenBoostsBackend::onPressShellLeave(nsPresContext* aPresContext)
    -> void {
  // TODO: We should set it as a null as well, but this prevents borders and
  // shadows from being drawn into our Zen boosts modifications.
  if (!aPresContext) {
    return;
  }
  mCurrentPresContext = aPresContext;
}

auto nsZenBoostsBackend::RecomputeBrowsingContextDependentData(
    nsPresContext* aPresContext,
    mozilla::dom::BrowsingContext* aBrowsingContext) -> void {
  if (!aPresContext || aPresContext->IsChrome()) {
    return;
  }

  auto previousData = aPresContext->mZenBoostsPresContextData;
  auto previousInvert = aPresContext->mZenBoostsInvert;
  aPresContext->mZenBoostsPresContextData = aBrowsingContext->ZenBoostsData();
  aPresContext->mZenBoostsInvert = aBrowsingContext->IsZenBoostsInverted();
  if (previousData != aPresContext->mZenBoostsPresContextData ||
      previousInvert != aPresContext->mZenBoostsInvert) {
    // Lets ask the prescontext to restyle the document
    aPresContext->MediaFeatureValuesChanged(
        {mozilla::RestyleHint::RecascadeSubtree(), NS_STYLE_HINT_VISUAL,
         mozilla::MediaFeatureChangeReason::PreferenceChange},
        mozilla::MediaFeatureChangePropagation::JustThisDocument);
  }
}

auto nsZenBoostsBackend::ResolveStyleColor(mozilla::StyleAbsoluteColor aColor)
    -> mozilla::StyleAbsoluteColor {
  ZenBoostData accentNS = 0;
  bool invertColors = false;
  GetZenBoostsDataFromBrowsingContext(&accentNS, &invertColors);

  nscolor resultColor = aColor.ToColor();
  if (accentNS) {
    // Apply a filter-like tint:
    // - Preserve the original color's perceived luminance
    // - Map hue/chroma toward the accent by scaling the accent's RGB
    //   to match the original luminance
    // - Keep the original alpha
    // Convert both colors to nscolor to access channels
    const nscolor originalNS = aColor.ToColor();
    resultColor = zenFilterColorChannel(originalNS, (nscolor)accentNS);
  }
  if (invertColors) {
    resultColor = zenInvertColorChannel(resultColor);
  }
  const auto alpha = aColor.alpha;
  aColor = mozilla::StyleAbsoluteColor::FromColor(resultColor);
  aColor.alpha = alpha;
  return aColor;
}

}  // namespace zen
