/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include <cmath>
#include <algorithm>
#include <cstdint>

#include "nsZenBoostsBackend.h"

#include "nsIXULRuntime.h"
#include "nsPresContext.h"

#include "mozilla/ClearOnShutdown.h"
#include "mozilla/StaticPtr.h"

#include "mozilla/ServoStyleConsts.h"
#include "mozilla/ServoStyleConstsInlines.h"
#include "mozilla/MediaFeatureChange.h"

#include "mozilla/dom/Document.h"
#include "mozilla/dom/DocumentInlines.h"
#include "mozilla/dom/BrowsingContext.h"

#include "mozilla/StaticPrefs_zen.h"

// Lower bound applied to inverted channels so that pure white doesn't invert
// all the way to pure black, which makes inverted pages feel too dark.
#define INVERT_CHANNEL_FLOOR() \
  (mozilla::StaticPrefs::zen_boosts_invert_channel_floor_AtStartup())

#define SHOULD_APPLY_BOOSTS_TO_ANONYMOUS_CONTENT() \
  (!mozilla::StaticPrefs::zen_boosts_disable_on_anonymous_content_AtStartup())

#if defined(__clang__) || defined(__GNUC__)
#  define ZEN_HOT_FUNCTION __attribute__((hot))
#else
#  define ZEN_HOT_FUNCTION
#endif

// It's a bit of a hacky solution, but instead of using alpha as what it is
// (opacity), we use it to store contrast information for now.
// We do this primarily to avoid having to deal with WebIDL structs and
// serialization/deserialization between parent and content processes.
#define NS_GET_CONTRAST(_c) NS_GET_A(_c)

namespace zen {

nsZenAccentOklab nsZenBoostsBackend::mCachedAccent{0};
nsZenAccentOklab nsZenBoostsBackend::mCachedComplementary{0};
float nsZenBoostsBackend::mCachedComplementaryRotationDeg = 0.0f;

namespace {

/**
 * @brief Converts an sRGB color component to linear space.
 * @param c The sRGB color component value (0.0 to 1.0).
 * @return The linear color component value.
 */
static inline float srgbToLinear(float c) {
  return c <= 0.04045f ? c * (1.0f / 12.92f)
                       : std::pow((c + 0.055f) * (1.0f / 1.055f), 2.4f);
}

/**
 * @brief Converts a linear color component to sRGB space.
 * @param c The linear color component value.
 * @return The sRGB color component value (0.0 to 1.0).
 */
static inline float linearToSrgb(float c) {
  c = std::max(0.0f, c);
  return c <= 0.0031308f ? 12.92f * c
                         : 1.055f * std::pow(c, 1.0f / 2.4f) - 0.055f;
}

/*
 * @brief Fast approximation of the cube root of a number.
 * @param x The input value.
 * @return The approximate cube root of the input value.
 */
static inline float fastCbrt(float x) {
  if (x == 0.0f) return 0.0f;
  float a = std::abs(x);
  union {
    float f;
    uint32_t i;
  } u = {a};
  u.i = u.i / 3 + 0x2a504a2e;
  float y = u.f;
  y = (2.0f * y + a / (y * y)) * (1.0f / 3.0f);
  y = (2.0f * y + a / (y * y)) * (1.0f / 3.0f);
  return x < 0.0f ? -y : y;
}

/**
 * @brief Precomputes the Oklab values for a given accent color. This allows us
 * to efficiently apply the accent color as a filter to other colors without
 * having to convert the accent color from sRGB to Oklab space on every filter
 * operation.
 * @param aAccentColor The accent color in nscolor format.
 * @return A struct containing the precomputed Oklab values and contrast factor
 * for the accent color.
 */
ZEN_HOT_FUNCTION
inline static auto zenPrecomputeAccent(nscolor aAccentColor) {
  constexpr float inv255 = 1.0f / 255.0f;

  const float r = NS_GET_R(aAccentColor) * inv255;
  const float g = NS_GET_G(aAccentColor) * inv255;
  const float b = NS_GET_B(aAccentColor) * inv255;

  const float lr = srgbToLinear(r);
  const float lg = srgbToLinear(g);
  const float lb = srgbToLinear(b);

  const float l_ =
      fastCbrt(0.4122214708f * lr + 0.5363325363f * lg + 0.0514459929f * lb);
  const float m_ =
      fastCbrt(0.2119034982f * lr + 0.6806995451f * lg + 0.1073969566f * lb);
  const float s_ =
      fastCbrt(0.0883024619f * lr + 0.2817188376f * lg + 0.6299787005f * lb);

  return nsZenAccentOklab{
      .accentNS = aAccentColor,
      .accL = 0.2104542553f * l_ + 0.7936177850f * m_ - 0.0040720468f * s_,
      .accA = 1.9779984951f * l_ - 2.4285922050f * m_ + 0.4505937099f * s_,
      .accB = 0.0259040371f * l_ + 0.7827717662f * m_ - 0.8086757660f * s_,
      .contrastFactor = NS_GET_CONTRAST(aAccentColor) * inv255,
  };
}

/**
 * @brief Derives the complementary accent from the base accent by rotating its
 * hue in the Oklab a/b plane by the given angle. Lightness, contrast and the
 * source nscolor are kept; only the hue changes. A zero rotation returns the
 * base accent unchanged so the duotone collapses to a single-accent tint.
 * @param aBase The precomputed base accent.
 * @param aRotationDeg The hue rotation to apply, in degrees.
 * @return The complementary accent.
 */
ZEN_HOT_FUNCTION
inline static nsZenAccentOklab zenRotateAccent(const nsZenAccentOklab& aBase,
                                               float aRotationDeg) {
  constexpr float kDegToRad = 3.14159265358979323846f / 180.0f;
  const float angle = aRotationDeg * kDegToRad;
  const float cosR = std::cos(angle);
  const float sinR = std::sin(angle);
  return nsZenAccentOklab{
      .accentNS = aBase.accentNS,
      .accL = aBase.accL,
      .accA = aBase.accA * cosR - aBase.accB * sinR,
      .accB = aBase.accA * sinR + aBase.accB * cosR,
      .contrastFactor = aBase.contrastFactor,
  };
}

/**
 * @brief Applies a duotone color filter to transform an original color toward
 * one of two accent colors. The original color's perceived lightness decides
 * which accent it is tinted toward: dark colors are pulled to the base accent,
 * light colors to the complementary accent, with a smooth crossfade between
 * them. The contrast value (stored in the accent's alpha channel) controls both
 * the overall tint strength and how hard that dark/light split is. The
 * original color's perceived luminance is otherwise preserved.
 * @param aOriginalColor The original color to filter.
 * @param aAccent The base accent, tinted toward by dark colors (alpha channel
 * contains the contrast value).
 * @param aComplementary The complementary accent, tinted toward by light
 * colors.
 * @return The filtered color with transformations applied.
 */
[[nodiscard]] ZEN_HOT_FUNCTION static inline nscolor zenFilterColorChannel(
    nscolor aOriginalColor, const nsZenAccentOklab& aAccent,
    const nsZenAccentOklab& aComplementary) {
  const uint8_t oL = NS_GET_A(aOriginalColor);
  const uint8_t contrast = NS_GET_CONTRAST(aAccent.accentNS);
  if (oL == 0) {
    return aOriginalColor;
  }

  constexpr float inv255 = 1.0f / 255.0f;
  const float blendFactor = contrast * inv255;

  // sRGB -> linear
  const float lr = srgbToLinear(NS_GET_R(aOriginalColor) * inv255);
  const float lg = srgbToLinear(NS_GET_G(aOriginalColor) * inv255);
  const float lb = srgbToLinear(NS_GET_B(aOriginalColor) * inv255);

  // Linear RGB -> LMS -> cube root -> Oklab (fused)
  const float l_ =
      fastCbrt(0.4122214708f * lr + 0.5363325363f * lg + 0.0514459929f * lb);
  const float m_ =
      fastCbrt(0.2119034982f * lr + 0.6806995451f * lg + 0.1073969566f * lb);
  const float s_ =
      fastCbrt(0.0883024619f * lr + 0.2817188376f * lg + 0.6299787005f * lb);

  const float origL =
      0.2104542553f * l_ + 0.7936177850f * m_ - 0.0040720468f * s_;
  const float origA =
      1.9779984951f * l_ - 2.4285922050f * m_ + 0.4505937099f * s_;
  const float origB =
      0.0259040371f * l_ + 0.7827717662f * m_ - 0.8086757660f * s_;

  // Duotone selection. origL is the original color's Oklab lightness (~0..1).
  // A smoothstep around a fixed mid-lightness pivot crossfades from the base
  // accent (dark colors, t=0) to the complementary accent (light colors, t=1).
  // A stronger tint (higher blendFactor) narrows the crossfade band toward a
  // hard two-tone split; a weaker one keeps it a gentle gradient.
  constexpr float kPivot = 0.5f;
  const float halfWidth = std::clamp(0.5f - blendFactor * 0.45f, 0.05f, 0.5f);
  float t = std::clamp((origL - (kPivot - halfWidth)) / (2.0f * halfWidth),
                       0.0f, 1.0f);
  t = t * t * (3.0f - 2.0f * t);

  const float selA = aAccent.accA + (aComplementary.accA - aAccent.accA) * t;
  const float selB = aAccent.accB + (aComplementary.accB - aAccent.accB) * t;
  const float selL = aAccent.accL + (aComplementary.accL - aAccent.accL) * t;
  const float selContrastFactor =
      aAccent.contrastFactor +
      (aComplementary.contrastFactor - aAccent.contrastFactor) * t;

  // Blend chroma toward the selected accent
  const float bA = origA + (selA - origA) * blendFactor;
  const float bB = origB + (selB - origB) * blendFactor;

  // Luminance: at low contrast stay near the original, the higher the contrast,
  // the more we shift toward the accent luminance, but we never go fully to
  // the accent luminance to preserve some of the original color's character.
  const float lumDelta = selL - origL;
  const float fL = origL + lumDelta * (blendFactor * selContrastFactor * 0.5f);

  // Rotate hue in the Oklab a/b plane. Direction follows the luminance shift:
  // pushing darker rotates clockwise ("right"), pushing lighter rotates the
  // other way. Magnitude scales with blend strength so subtle accents stay
  // subtle.
  const float rotAngle = (lumDelta > 0.0f ? -1.0f : 1.0f) * blendFactor *
                         selContrastFactor * 0.25f;
  const float cosR = std::cos(rotAngle);
  const float sinR = std::sin(rotAngle);
  const float fA = bA * cosR - bB * sinR;
  const float fB = bA * sinR + bB * cosR;

  // Oklab -> LMS
  const float fl_ = fL + 0.3963377774f * fA + 0.2158037573f * fB;
  const float fm_ = fL - 0.1055613458f * fA - 0.0638541728f * fB;
  const float fs_ = fL - 0.0894841775f * fA - 1.2914855480f * fB;

  // Cube
  const float fl = fl_ * fl_ * fl_;
  const float fm = fm_ * fm_ * fm_;
  const float fs = fs_ * fs_ * fs_;

  // LMS -> linear RGB
  const float rF = 4.0767416621f * fl - 3.3077115913f * fm + 0.2309699292f * fs;
  const float gF =
      -1.2684380046f * fl + 2.6097574011f * fm - 0.3413193965f * fs;
  const float bF =
      -0.0041960863f * fl - 0.7034186147f * fm + 1.7076147010f * fs;

  // Linear -> sRGB -> uint8
  return NS_RGBA(static_cast<uint8_t>(std::clamp(
                     linearToSrgb(rF) * 255.0f + 0.5f, 0.0f, 255.0f)),
                 static_cast<uint8_t>(std::clamp(
                     linearToSrgb(gF) * 255.0f + 0.5f, 0.0f, 255.0f)),
                 static_cast<uint8_t>(std::clamp(
                     linearToSrgb(bF) * 255.0f + 0.5f, 0.0f, 255.0f)),
                 oL);
}

/**
 * @brief Inverts a color by inverting each RGB channel while preserving
 * perceived luminance. This is done by inverting the color and then shifting it
 * based on the sum of the inverted channels.
 * @param aColor The color to invert.
 * @return The inverted color with luminance preservation.
 */
ZEN_HOT_FUNCTION
inline static nscolor zenInvertColorChannel(nscolor aColor) {
  const auto r = NS_GET_R(aColor);
  const auto g = NS_GET_G(aColor);
  const auto b = NS_GET_B(aColor);
  const auto a = NS_GET_A(aColor);
  if (a == 0) {
    // Skip processing fully transparent colors since they won't be visible and
    // we want to avoid unnecessary computations.
    return aColor;
  }

  const auto rInv = 255 - r;
  const auto gInv = 255 - g;
  const auto bInv = 255 - b;

  const auto max = std::max({rInv, gInv, bInv});
  const auto min = std::min({rInv, gInv, bInv});
  const auto sum = max + min;

  const auto rShifted = sum - rInv;
  const auto gShifted = sum - gInv;
  const auto bShifted = sum - bInv;

  // Compress the channel range into [FLOOR, 255] so dark inversions are
  // lifted while light inversions are left untouched. This preserves hue
  // since all three channels are scaled by the same factor.
  const auto channelFloor = INVERT_CHANNEL_FLOOR();
  const uint32_t range = 255 - channelFloor;
  const auto lift = [channelFloor, range](uint8_t c) -> uint8_t {
    return static_cast<uint8_t>(channelFloor + (c * range) / 255);
  };

  return NS_RGBA(lift(rShifted), lift(gShifted), lift(bShifted), a);
}

/**
 * @brief Retrieves the current boost data from the browsing context. When
 * called without aPresContext, reads the precomputed cache populated on
 * presshell entry; otherwise resolves from the supplied PresContext.
 */
ZEN_HOT_FUNCTION
inline static void GetZenBoostsDataFromBrowsingContext(
    ZenBoostData* aData, float* aComplementaryRotation, bool* aIsInverted,
    nsPresContext* aPresContext = nullptr) {
  auto zenBoosts = nsZenBoostsBackend::GetInstance();
  if (!zenBoosts || (zenBoosts->mCurrentFrameIsAnonymousContent &&
                     !SHOULD_APPLY_BOOSTS_TO_ANONYMOUS_CONTENT())) {
    return;
  }
  if (!aPresContext) {
    *aData = zenBoosts->mCachedCurrentAccent;
    *aComplementaryRotation = zenBoosts->mCachedCurrentComplementaryRotation;
    *aIsInverted = zenBoosts->mCachedCurrentInverted;
    return;
  }
  mozilla::dom::BrowsingContext* browsingContext = nullptr;
  if (auto document = aPresContext->Document()) {
    browsingContext = document->GetBrowsingContext();
  }
  if (!browsingContext) {
    return;
  }
  browsingContext = browsingContext->Top();
  *aData = browsingContext->ZenBoostsData();
  *aComplementaryRotation = browsingContext->ZenBoostsComplementaryRotation();
  *aIsInverted = browsingContext->IsZenBoostsInverted();
}

}  // namespace

static mozilla::StaticAutoPtr<nsZenBoostsBackend> sZenBoostsBackend;

auto nsZenBoostsBackend::GetInstance() -> nsZenBoostsBackend* {
  if (!XRE_IsContentProcess()) {
    // Zen boosts are only supported in content, so if we're in the parent
    // process, just return null.
    return nullptr;
  }
  if (!sZenBoostsBackend) {
    sZenBoostsBackend = new nsZenBoostsBackend();
    mozilla::ClearOnShutdown(&sZenBoostsBackend);
  }
  return sZenBoostsBackend.get();
}

auto nsZenBoostsBackend::onPresShellEntered(mozilla::dom::Document* aDocument)
    -> void {
  if (auto displayDoc = aDocument->GetDisplayDocument()) {
    onPresShellEntered(displayDoc);
    return;
  }
  // Note that aDocument can be null when entering anonymous content frames.
  // We explicitly do this to prevent applying boosts to anonymous content, such
  // as devtools or screenshots.
  mozilla::dom::BrowsingContext* browsingContext =
      aDocument ? aDocument->GetBrowsingContext() : nullptr;
  if (!browsingContext) {
    return;
  }
  mCurrentBrowsingContext = browsingContext;
  RefreshCachedBoostState();
}

auto nsZenBoostsBackend::RefreshCachedBoostState() -> void {
  if (!mCurrentBrowsingContext) {
    mCachedCurrentAccent = 0;
    mCachedCurrentComplementaryRotation = 0.0f;
    mCachedCurrentInverted = false;
    return;
  }
  auto top = mCurrentBrowsingContext->Top();
  mCachedCurrentAccent = top->ZenBoostsData();
  mCachedCurrentComplementaryRotation = top->ZenBoostsComplementaryRotation();
  mCachedCurrentInverted = top->IsZenBoostsInverted();
}

[[nodiscard]] ZEN_HOT_FUNCTION auto
nsZenBoostsBackend::FilterColorFromPresContext(nscolor aColor,
                                               nsPresContext* aPresContext)
    -> nscolor {
  ZenBoostData accentNS = 0;
  float complementaryRotation = 0.0f;
  bool invertColors = false;
  GetZenBoostsDataFromBrowsingContext(&accentNS, &complementaryRotation,
                                      &invertColors, aPresContext);
  if (accentNS) {
    if (mCachedAccent.accentNS != accentNS) {
      mCachedAccent = zenPrecomputeAccent(accentNS);
      // Trigger a recompute of the complementary accent since
      / it depends on the base accent.mCachedComplementary.accentNS = 0;
    }
    // Derive the complementary accent by rotating the base accent's hue by the
    // boost's complementary rotation. Cached so the per-color hot path only
    // recomputes it when the base accent or rotation changes.
    if (mCachedComplementary.accentNS != accentNS ||
        mCachedComplementaryRotationDeg != complementaryRotation) {
      mCachedComplementary =
          zenRotateAccent(mCachedAccent, complementaryRotation);
      mCachedComplementaryRotationDeg = complementaryRotation;
    }
    // Apply a filter-like tint:
    // - Preserve the original color's perceived luminance
    // - Map hue/chroma toward the base or complementary accent depending on
    //   the original color's lightness
    // - Keep the original alpha
    aColor = zenFilterColorChannel(aColor, mCachedAccent, mCachedComplementary);
  }
  if (invertColors) {
    aColor = zenInvertColorChannel(aColor);
  }
  return aColor;
}

[[nodiscard]] ZEN_HOT_FUNCTION auto nsZenBoostsBackend::ResolveStyleColor(
    mozilla::StyleAbsoluteColor aColor) -> mozilla::StyleAbsoluteColor {
  const auto resultColor = FilterColorFromPresContext(aColor.ToColor());
  return mozilla::StyleAbsoluteColor::FromColor(resultColor);
}

[[nodiscard]] ZEN_HOT_FUNCTION auto nsZenBoostsBackend::ResolveStyleColor(
    nscolor aColor) -> nscolor {
  if (NS_GET_A(aColor) == 0) {
    // Skip processing fully transparent colors since they won't be visible and
    // we want to avoid unnecessary computations. This also prevents issues with
    // using the alpha channel for contrast information in the accent color.
    return aColor;
  }
  return FilterColorFromPresContext(aColor);
}

}  // namespace zen
