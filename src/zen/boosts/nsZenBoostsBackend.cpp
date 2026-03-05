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

#define MARK_MEDIA_FEATURE_CHANGED(_pc) \
  (_pc)->MediaFeatureValuesChanged(                                     \
      {mozilla::RestyleHint::RecascadeSubtree(), NS_STYLE_HINT_VISUAL,  \
      mozilla::MediaFeatureChangeReason::PreferenceChange},             \
      mozilla::MediaFeatureChangePropagation::All);

#define TRIGGER_PRES_CONTEXT_RESTYLE()        \
  WalkPresContexts([&](nsPresContext* aPc) {  \
    MARK_MEDIA_FEATURE_CHANGED(aPc);          \
  });

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
namespace {

/** 
 * Inherited from the Oklab blog
 * Source: https://bottosson.github.io/posts/oklab/
 */

struct Lab {float L; float a; float b;};
struct RGB {float r; float g; float b;};

Lab rgb2oklab(RGB c)  {
  float l = 0.4122214708f * c.r + 0.5363325363f * c.g + 0.0514459929f * c.b;
	float m = 0.2119034982f * c.r + 0.6806995451f * c.g + 0.1073969566f * c.b;
	float s = 0.0883024619f * c.r + 0.2817188376f * c.g + 0.6299787005f * c.b;

  float l_ = cbrtf(l);
  float m_ = cbrtf(m);
  float s_ = cbrtf(s);

  return {
      0.2104542553f*l_ + 0.7936177850f*m_ - 0.0040720468f*s_,
      1.9779984951f*l_ - 2.4285922050f*m_ + 0.4505937099f*s_,
      0.0259040371f*l_ + 0.7827717662f*m_ - 0.8086757660f*s_,
  };
}

RGB oklab2rgb(Lab c) {
  float l_ = c.L + 0.3963377774f * c.a + 0.2158037573f * c.b;
  float m_ = c.L - 0.1055613458f * c.a - 0.0638541728f * c.b;
  float s_ = c.L - 0.0894841775f * c.a - 1.2914855480f * c.b;

  float l = l_*l_*l_;
  float m = m_*m_*m_;
  float s = s_*s_*s_;

  return {
  +4.0767416621f * l - 3.3077115913f * m + 0.2309699292f * s,
  -1.2684380046f * l + 2.6097574011f * m - 0.3413193965f * s,
  -0.0041960863f * l - 0.7034186147f * m + 1.7076147010f * s,
  };
}

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
  const auto a1 = NS_GET_A(aOriginalColor);
  if (a1 == 0) {
    // Skip processing fully transparent colors since they won't be visible and
    // we want to avoid unnecessary computations with the accent color's alpha
    // channel used for contrast information.
    return aOriginalColor;
  }

  const auto r2 = NS_GET_R(aAccentColor);
  const auto g2 = NS_GET_G(aAccentColor);
  const auto b2 = NS_GET_B(aAccentColor);

  // It's a bit of a hacky solution, but instead of using alpha as what it is
  // (opacity), we use it to store contrast information for now.
  // We do this primarily to avoid having to deal with WebIDL structs and
  // serialization/deserialization between parent and content processes.
  const auto contrast = NS_GET_CONTRAST(aAccentColor);

  RGB originalRgb(r1 / 255.0, g1 / 255.0, b1 / 255.0);
  const auto originalOklab = rgb2oklab(originalRgb);

  RGB accentRgb(r2 / 255.0, g2 / 255.0, b2 / 255.0);
  const auto accentOklab = rgb2oklab(accentRgb);
  
  double tintStrength = 0.6; // Decides how strongly the accent should influence the original color
  double aBlend = (1.0 - tintStrength) * originalOklab.a + tintStrength * accentOklab.a;
  double bBlend = (1.0 - tintStrength) * originalOklab.b + tintStrength * accentOklab.b;

  // Calculating chroma with the length of the vector of (a b)
  double chromaBlend = sqrt(aBlend * aBlend + bBlend * bBlend);
  
  // Normalizing against 0.4 since usually Oklab chroma maxes out around there
  double vibranceAmount = 1 - ((contrast - 128.0) / 128.0);
  double vibranceFactor = 1.0 + vibranceAmount * (1.0 - std::clamp(chromaBlend / 0.4, 0.0, 1.0));

  // Essentially the equivalent of 'hue' for Oklab
  double chromaMixed = chromaBlend * vibranceFactor;
  double scale = (chromaBlend > 1e-6) ? (chromaMixed / chromaBlend) : 1.0;

  double aMixed = aBlend * scale;
  double bMixed = bBlend * scale;

  // Lightness contrast
  double contrastFactor = 1.0 + vibranceAmount * 0.5;

  // Lightness factor
  double LMixed = 0.5 + (originalOklab.L - 0.5) * contrastFactor;
  LMixed = std::clamp(LMixed * (0.25 + accentOklab.L), 0.0, 1.0);
  
  Lab tintedOklab(LMixed, aMixed, bMixed);

  auto tintedRgb = oklab2rgb(tintedOklab);
  const uint8_t fr8 = clamp255(tintedRgb.r * 255);
  const uint8_t fg8 = clamp255(tintedRgb.g * 255);
  const uint8_t fb8 = clamp255(tintedRgb.b * 255);

  return NS_RGBA(fr8, fg8, fb8, a1);
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
inline static void GetZenBoostsDataFromBrowsingContext(ZenBoostData* aData,
                                                       bool* aIsInverted,
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
  } else if (auto currentBrowsingContext = zenBoosts->GetCurrentBrowsingContext()) {
    *aData = currentBrowsingContext->ZenBoostsData();
    *aIsInverted = currentBrowsingContext->IsZenBoostsInverted();
  }
}

}  // namespace

auto nsZenBoostsBackend::GetInstance() -> nsZenBoostsBackend* {
  static nsZenBoostsBackend* zenBoosts;
  if (!XRE_IsContentProcess()) {
    // Zen boosts are only supported in content, so if we're in the parent process,
    // just return null.
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
  mozilla::dom::BrowsingContext* browsingContext = aDocument
    ? aDocument->GetBrowsingContext()
    : nullptr;
  if (!browsingContext) {
    return;
  }
  mCurrentBrowsingContext = browsingContext;
}

auto nsZenBoostsBackend::FilterColorFromPresContext(nscolor aColor,
    nsPresContext* aPresContext) -> nscolor {
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
    // Apply a filter-like tint:
    // - Preserve the original color's perceived luminance
    // - Map hue/chroma toward the accent by scaling the accent's RGB
    //   to match the original luminance
    // - Keep the original alpha
    // Convert both colors to nscolor to access channels
    aColor = zenFilterColorChannel(aColor, (nscolor)accentNS);
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
