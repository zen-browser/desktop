/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsZenBoostsBackend.h"

#include "nsIXULRuntime.h"
#include "nsPresContext.h"

#include "mozilla/RefPtr.h"
#include "mozilla/StaticPtr.h"

#include "mozilla/ServoStyleConsts.h"
#include "mozilla/ServoStyleConstsInlines.h"
#include "mozilla/MediaFeatureChange.h"

#include "mozilla/dom/Document.h"
#include "mozilla/dom/BrowsingContext.h"

using BrowsingContext = mozilla::dom::BrowsingContext;
using BoostData = nscolor; // For now, Zen boosts data is just a color.

void BrowsingContext::DidSet(FieldIndex<IDX_ZenBoostsData>,
                                          BoostData aOldValue) {
  MOZ_ASSERT(IsTop());
  if (ZenBoostsData() == aOldValue) {
    return;
  }
  PresContextAffectingFieldChanged();
}

namespace zen {
namespace {

// llvm x86 is poor at ternary operator, so use branchless min/max.
static __inline int32_t clamp255(int32_t v) {
  return (((255 - (v)) >> 31) | (v)) & 255;
}

#define COLOR_CHANNEL_MIDPOINT 128

static nscolor zenFilterColorChannel(nscolor aOriginalColor, nscolor aAccentColor) {
  auto r1 = NS_GET_R(aOriginalColor);
  auto g1 = NS_GET_G(aOriginalColor);
  auto b1 = NS_GET_B(aOriginalColor);

  auto r2 = NS_GET_R(aAccentColor);
  auto g2 = NS_GET_G(aAccentColor);
  auto b2 = NS_GET_B(aAccentColor);

  // It's a bit of a hacky solution, but instead of using alpha as what it is
  // (opacity), we use it to store contrast information for now.
  // We do this primarily to avoid having to deal with WebIDL structs and
  // serialization/deserialization between parent and content processes.
  auto contrast = NS_GET_A(aAccentColor);

  // Approximate perceived luminance in sRGB space
  // Coefficients per Rec.709; gamma correction ignored for speed
  double origLum = 0.2126 * r1 + 0.7152 * g1 + 0.0722 * b1;
  double accentLum = 0.2126 * r2 + 0.7152 * g2 + 0.0722 * b2;

  double scale = accentLum > 0.0 ? (origLum / accentLum) : 1.0;

  double fr = r2 * scale;
  double fg = g2 * scale;
  double fb = b2 * scale;

  // Apply contrast adjustment: map contrast from 0–255 to -1.0–+1.0
  // contrast = 0: maximum darkening (mix toward black)
  // contrast = 127.5: no change
  // contrast = 255: maximum lightening (mix toward white)
  double contrastFactor = (contrast - 128.0) / 128.0;

  // Compute perceived luminance for the filtered color
  double lum = 0.2126 * fr + 0.7152 * fg + 0.0722 * fb;

  // If it's bright, mix toward white; if dark, mix toward black
  if (lum >= COLOR_CHANNEL_MIDPOINT) {
    double mix = (lum - COLOR_CHANNEL_MIDPOINT) / COLOR_CHANNEL_MIDPOINT;
    double amount = contrastFactor * mix;
    fr = fr + (255.0 - fr) * amount;
    fg = fg + (255.0 - fg) * amount;
    fb = fb + (255.0 - fb) * amount;
  } else {
    double mix = (COLOR_CHANNEL_MIDPOINT - lum) / COLOR_CHANNEL_MIDPOINT;
    double amount = -contrastFactor * mix;
    fr = fr * (1.0 - amount);
    fg = fg * (1.0 - amount);
    fb = fb * (1.0 - amount);
  }

  // Clamp to [0,255] using fast branchless clamp
  uint8_t fr8 = clamp255(fr);
  uint8_t fg8 = clamp255(fg);
  uint8_t fb8 = clamp255(fb);

  return NS_RGB(fr8, fg8, fb8);
}

} // namespace

// Use the macro to inject all of the definitions for nsISupports.
NS_IMPL_ISUPPORTS(nsZenBoostsBackend, nsIZenBoostsBackend)
nsZenBoostsBackend::nsZenBoostsBackend() {};

auto nsZenBoostsBackend::onPressShellEntered(nsPresContext* aPresContext) -> void {
  if (!aPresContext) {
    return;
  }

  mCurrentPresContext = aPresContext;
}

auto nsZenBoostsBackend::onPressShellLeave(nsPresContext* aPresContext) -> void {
  // TODO: We should set it as a null as well, but this prevents borders and shadows
  // from being drawn into our Zen boosts modifications.
  if (!aPresContext) {
    return;
  }
  mCurrentPresContext = aPresContext;
}

auto nsZenBoostsBackend::RecomputeBrowsingContextDependentData(
    nsPresContext* aPresContext, mozilla::dom::BrowsingContext* aBrowsingContext) -> void {
  if (!aPresContext || aPresContext->IsChrome()) {
    return;
  }

  auto previousData = aPresContext->mZenBoostsPresContextData;
  aPresContext->mZenBoostsPresContextData = aBrowsingContext->ZenBoostsData();
  if (previousData != aPresContext->mZenBoostsPresContextData) {
    // Lets ask the prescontext to restyle the document
    aPresContext->MediaFeatureValuesChanged(
      {mozilla::RestyleHint::RecascadeSubtree(), NS_STYLE_HINT_VISUAL,
       mozilla::MediaFeatureChangeReason::PreferenceChange},
      mozilla::MediaFeatureChangePropagation::JustThisDocument);
  }
}

auto nsZenBoostsBackend::ResolveStyleColor(
    mozilla::StyleAbsoluteColor aColor) -> mozilla::StyleAbsoluteColor {
  static nsCOMPtr<zen::nsZenBoostsBackend> zenBoosts(
      do_GetService(ZEN_BOOSTS_BACKEND_CONTRACTID));

  if (zenBoosts) {
    if (auto presContext = zenBoosts->mCurrentPresContext) {
      if (auto accentNS = presContext->mZenBoostsPresContextData) {
        // Apply a filter-like tint:
        // - Preserve the original color's perceived luminance
        // - Map hue/chroma toward the accent by scaling the accent's RGB
        //   to match the original luminance
        // - Keep the original alpha

        // Convert both colors to nscolor to access channels
        nscolor originalNS = aColor.ToColor();
        nscolor filteredNS = zenFilterColorChannel(originalNS, accentNS);
        
        auto filtered = mozilla::StyleAbsoluteColor::FromColor(filteredNS);
        filtered.alpha = aColor.alpha;
        return filtered;
      }
    }
  }

  return aColor;
}

} // namespace zen
