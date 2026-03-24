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
#include "mozilla/dom/DocumentInlines.h"
#include "mozilla/dom/BrowsingContext.h"

#define COLOR_CHANNEL_MIDPOINT 128

// It's a bit of a hacky solution, but instead of using alpha as what it is
// (opacity), we use it to store contrast information for now.
// We do this primarily to avoid having to deal with WebIDL structs and
// serialization/deserialization between parent and content processes.
#define NS_GET_CONTRAST(_c) NS_GET_A(_c)

#define MARK_MEDIA_FEATURE_CHANGED(_pc)                                \
  (_pc)->MediaFeatureValuesChanged(                                    \
      {mozilla::RestyleHint::RecascadeSubtree(), NS_STYLE_HINT_VISUAL, \
       mozilla::MediaFeatureChangeReason::PreferenceChange},           \
      mozilla::MediaFeatureChangePropagation::All);

#define TRIGGER_PRES_CONTEXT_RESTYLE() \
  WalkPresContexts(                    \
      [&](nsPresContext* aPc) { MARK_MEDIA_FEATURE_CHANGED(aPc); });

using BrowsingContext = mozilla::dom::BrowsingContext;

template <typename Callback>
void BrowsingContext::WalkPresContexts(Callback&& aCallback) {
  PreOrderWalk([&](BrowsingContext* aContext) {
    if (nsIDocShell* shell = aContext->GetDocShell()) {
      if (RefPtr pc = shell->GetPresContext()) {
        aCallback(pc.get());
      }
    }
  });
}

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
  TRIGGER_PRES_CONTEXT_RESTYLE();
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
  TRIGGER_PRES_CONTEXT_RESTYLE();
}

namespace zen {

nsZenAccentOklab nsZenBoostsBackend::mCachedAccent{0};

namespace {

struct Lab {
  float L, a, b;
};

struct RGB {
  float r, g, b;
};

/**
 * @brief Clamps a value to the range [0, 255] using branchless operations.
 * @param v The value to clamp.
 * @return The clamped value in the range [0, 255].
 */
static __inline int32_t clamp255(int32_t v) {
  // llvm x86 is poor at ternary operator, so use branchless min/max.
  v = v & ~(v >> 31);
  return (v | ((255 - v) >> 31)) & 255;
}

/**
 * @brief A fast approximation of the cube root function using bit manipulation
 * and two Newton-Raphson iterations. This is used to optimize the Oklab color
 * conversion in the color filtering process.
 */
inline static float fast_cbrt(float x) {
  // Bit-level initial approximation (works for positive floats only — fine
  // here)
  uint32_t bits;
  memcpy(&bits, &x, 4);
  bits = (bits / 3) + 0x2A512400u;  // magic constant for cube root
  float y;
  memcpy(&y, &bits, 4);
  // Two Newton-Raphson iterations: y = y - (y³ - x) / (3y²)
  y = (2.0f / 3.0f) * y + (1.0f / 3.0f) * x / (y * y);
  y = (2.0f / 3.0f) * y + (1.0f / 3.0f) * x / (y * y);
  return y;
}

/**
 * @brief Converts an Oklab color back to the RGB color space.
 * @param c The Oklab color to convert.
 * @return The corresponding RGB color.
 */
[[nodiscard]]
static inline auto oklab2rgb(Lab c) -> RGB {
  float l_ = c.L + 0.3963377774f * c.a + 0.2158037573f * c.b;
  float m_ = c.L - 0.1055613458f * c.a - 0.0638541728f * c.b;
  float s_ = c.L - 0.0894841775f * c.a - 1.2914855480f * c.b;

  // Cubing is just 2 multiplies — no cbrtf needed on the way back
  return {
      4.0767416621f * (l_ * l_ * l_) - 3.3077115913f * (m_ * m_ * m_) +
          0.2309699292f * (s_ * s_ * s_),
      -1.2684380046f * (l_ * l_ * l_) + 2.6097574011f * (m_ * m_ * m_) -
          0.3413193965f * (s_ * s_ * s_),
      -0.0041960863f * (l_ * l_ * l_) - 0.7034186147f * (m_ * m_ * m_) +
          1.7076147010f * (s_ * s_ * s_),
  };
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
[[nodiscard]]
static inline Lab rgb2oklab_fast(RGB c) {
  float l = 0.4122214708f * c.r + 0.5363325363f * c.g + 0.0514459929f * c.b;
  float m = 0.2119034982f * c.r + 0.6806995451f * c.g + 0.1073969566f * c.b;
  float s = 0.0883024619f * c.r + 0.2817188376f * c.g + 0.6299787005f * c.b;
  float l_ = fast_cbrt(l), m_ = fast_cbrt(m), s_ = fast_cbrt(s);
  return {
      0.2104542553f * l_ + 0.7936177850f * m_ - 0.0040720468f * s_,
      1.9779984951f * l_ - 2.4285922050f * m_ + 0.4505937099f * s_,
      0.0259040371f * l_ + 0.7827717662f * m_ - 0.8086757660f * s_,
  };
}

inline static auto zenPrecomputeAccent(nscolor aAccentColor)
    -> nsZenAccentOklab {
  constexpr float kInv255 = 1.0f / 255.0f;
  RGB rgb = {NS_GET_R(aAccentColor) * kInv255, NS_GET_G(aAccentColor) * kInv255,
             NS_GET_B(aAccentColor) * kInv255};
  auto lab = rgb2oklab_fast(rgb);
  float contrast = NS_GET_CONTRAST(aAccentColor);
  float vibranceBase = 1.0f - ((contrast - 128.0f) * (1.0f / 128.0f));
  return {lab.L, lab.a, lab.b, vibranceBase, 0.25f + lab.L};
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
[[nodiscard]]
static nscolor zenFilterColorChannel(nscolor aOriginalColor,
                                     const nsZenAccentOklab& aAccent) {
  const uint8_t a1 = NS_GET_A(aOriginalColor);
  if (a1 == 0) return aOriginalColor;

  constexpr float kInv255 = 1.0f / 255.0f;
  constexpr float kTint = 0.6f;
  constexpr float kInvTint = 1.0f - kTint;

  RGB orig = {
      NS_GET_R(aOriginalColor) * kInv255,
      NS_GET_G(aOriginalColor) * kInv255,
      NS_GET_B(aOriginalColor) * kInv255,
  };
  const auto lab = rgb2oklab_fast(orig);

  const float aBlend = kInvTint * lab.a + kTint * aAccent.a;
  const float bBlend = kInvTint * lab.b + kTint * aAccent.b;

  // Avoid sqrt: compare squared chroma against squared threshold (0.4^2 = 0.16)
  // vibranceFactor = chromaMixed/chromaBlend which simplifies to just
  // vibranceFactor since the sqrt cancels in the normalize+scale round-trip
  // (see below)
  const float chromaSq = aBlend * aBlend + bBlend * bBlend;
  const float saturation =
      (chromaSq < 0.16f) ? chromaSq * (1.0f / 0.16f) : 1.0f;
  const float vibranceFactor =
      1.0f + aAccent.vibranceBase * (1.0f - saturation);

  // sqrt cancellation: chromaMixed/chromaBlend =
  // (chromaBlend*vibranceFactor)/chromaBlend = vibranceFactor, so we multiply
  // directly with no sqrt needed
  const float aMixed = aBlend * vibranceFactor;
  const float bMixed = bBlend * vibranceFactor;

  float LMixed = 0.5f + (lab.L - 0.5f) * (1.0f + aAccent.vibranceBase * 0.5f);
  LMixed *= aAccent.accentLOffset;
  if (LMixed < 0.0f) LMixed = 0.0f;
  if (LMixed > 1.0f) LMixed = 1.0f;

  const auto rgb = oklab2rgb({LMixed, aMixed, bMixed});

  return NS_RGBA(clamp255((int32_t)(rgb.r * 255.0f + 0.5f)),
                 clamp255((int32_t)(rgb.g * 255.0f + 0.5f)),
                 clamp255((int32_t)(rgb.b * 255.0f + 0.5f)), a1);
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

  return NS_RGBA(rShifted, gShifted, bShifted, a);
}

/**
 * @brief Retrieves the current boost data from the browsing context.
 */
inline static void GetZenBoostsDataFromBrowsingContext(
    ZenBoostData* aData, bool* aIsInverted,
    nsPresContext* aPresContext = nullptr) {
  auto zenBoosts = nsZenBoostsBackend::GetInstance();
  if (!zenBoosts || (zenBoosts->mCurrentFrameIsAnonymousContent)) {
    return;
  }
  if (aPresContext) {
    if (auto document = aPresContext->Document()) {
      if (auto browsingContext = document->GetBrowsingContext()) {
        *aData = browsingContext->ZenBoostsData();
        *aIsInverted = browsingContext->IsZenBoostsInverted();
      }
    }
  } else if (auto currentBrowsingContext =
                 zenBoosts->GetCurrentBrowsingContext()) {
    *aData = currentBrowsingContext->ZenBoostsData();
    *aIsInverted = currentBrowsingContext->IsZenBoostsInverted();
  }
}

}  // namespace

auto nsZenBoostsBackend::GetInstance() -> nsZenBoostsBackend* {
  static nsZenBoostsBackend* zenBoosts;
  if (!XRE_IsContentProcess()) {
    // Zen boosts are only supported in content, so if we're in the parent
    // process, just return null.
    return nullptr;
  }
  if (!zenBoosts) {
    zenBoosts = new nsZenBoostsBackend();
  }
  return zenBoosts;
}

auto nsZenBoostsBackend::onPresShellEntered(mozilla::dom::Document* aDocument)
    -> void {
  // Note that aDocument can be null when entering anonymous content frames.
  // We explicitly do this to prevent applying boosts to anonymous content, such
  // as devtools or screenshots.
  mozilla::dom::BrowsingContext* browsingContext =
      aDocument ? aDocument->GetBrowsingContext() : nullptr;
  if (!browsingContext) {
    return;
  }
  mCurrentBrowsingContext = browsingContext;
}

auto nsZenBoostsBackend::FilterColorFromPresContext(nscolor aColor,
                                                    nsPresContext* aPresContext)
    -> nscolor {
  if (!XRE_IsContentProcess()) {
    // Zen boosts are only supported in content, so if we somehow end up here
    // without a prescontext or in the parent process, just return the original
    // color.
    return aColor;
  }
  ZenBoostData accentNS = 0;
  bool invertColors = false;
  GetZenBoostsDataFromBrowsingContext(&accentNS, &invertColors, aPresContext);
  if (accentNS) {
    if (mCachedAccent.accentNS != accentNS) {
      mCachedAccent = zenPrecomputeAccent(accentNS);
    }
    // Apply a filter-like tint:
    // - Preserve the original color's perceived luminance
    // - Map hue/chroma toward the accent by scaling the accent's RGB
    //   to match the original luminance
    // - Keep the original alpha
    // Convert both colors to nscolor to access channels
    aColor = zenFilterColorChannel(aColor, mCachedAccent);
  }
  if (invertColors) {
    aColor = zenInvertColorChannel(aColor);
  }
  return aColor;
}

auto nsZenBoostsBackend::ResolveStyleColor(mozilla::StyleAbsoluteColor aColor)
    -> mozilla::StyleAbsoluteColor {
  if (aColor.alpha == 0) {
    // Skip processing fully transparent colors since they won't be visible and
    // we want to avoid unnecessary computations. This also prevents issues with
    // using the alpha channel for contrast information in the accent color.
    return aColor;
  }
  const auto resultColor = FilterColorFromPresContext(aColor.ToColor());
  aColor = mozilla::StyleAbsoluteColor::FromColor(resultColor);
  return aColor;
}

}  // namespace zen
