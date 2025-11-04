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
#define APPLY_CONTRAST(channel, factor) \
  ((int32_t)((channel - COLOR_CHANNEL_MIDPOINT) * factor + COLOR_CHANNEL_MIDPOINT))

static nscolor zenFilterColorChannel(nscolor originalNS, nscolor accentNS) {
  auto r1 = NS_GET_R(originalNS);
  auto g1 = NS_GET_G(originalNS);
  auto b1 = NS_GET_B(originalNS);

  // It's a bit of a hacky solution, but instead of using alpha as what it is
  // (opacity), we use it to store contrast information for now.
  // We do this primarily to avoid having to deal with WebIDL structs and
  // serialization/deserialization between parent and content processes.
  auto contrast = NS_GET_A(originalNS);

  auto r2 = NS_GET_R(accentNS);
  auto g2 = NS_GET_G(accentNS);
  auto b2 = NS_GET_B(accentNS);

  // Approximate perceived luminance in sRGB space
  // Coefficients per Rec.709; gamma correction ignored for speed
  double origLum = 0.2126 * r1 + 0.7152 * g1 + 0.0722 * b1;
  double accentLum = 0.2126 * r2 + 0.7152 * g2 + 0.0722 * b2;

  double scale = accentLum > 0.0 ? (origLum / accentLum) : 1.0;

  uint8_t fr = clamp255(r2 * scale);
  uint8_t fg = clamp255(g2 * scale);
  uint8_t fb = clamp255(b2 * scale);

  // Apply contrast adjustment: map contrast from 0-255 to 0.0-2.0
  // contrast = 0: reduce contrast (factor = 0.0, moves toward middle gray)
  // contrast = 127.5: no change (factor = 1.0)
  // contrast = 255: increase contrast (factor = 2.0, lighter/darker extremes)
  double contrastFactor = contrast / 127.5;
  
  // Apply contrast: adjust each channel relative to middle gray
  fr = clamp255(APPLY_CONTRAST(fr, contrastFactor));
  fg = clamp255(APPLY_CONTRAST(fg, contrastFactor));
  fb = clamp255(APPLY_CONTRAST(fb, contrastFactor));

  return NS_RGBA(fr, fg, fb, 1);
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
